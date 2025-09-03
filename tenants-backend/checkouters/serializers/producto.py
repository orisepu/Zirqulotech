from rest_framework import serializers
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.db.models import Q
from productos.models.modelos import Modelo, Capacidad
from productos.models.precios import PrecioRecompra
from ..models.oportunidad import Oportunidad

class ModeloSerializer(serializers.ModelSerializer):
    class Meta:
        model = Modelo
        fields = '__all__'

class CapacidadSerializer(serializers.ModelSerializer):
    precio = serializers.SerializerMethodField()

    class Meta:
        model = Capacidad
        fields = ['id', 'tamaño', 'precio']

    # Mini-caché por petición para evitar N+1 fuerte
    @property
    def _precio_cache(self):
        if not hasattr(self, '__precio_cache'):
            self.__precio_cache = {}
        return self.__precio_cache

    def _resolver_canal(self, request):
        """
        Resuelve 'B2B' | 'B2C' según la oportunidad (o por tipo_cliente).
        Default: 'B2B' si no puede resolver.
        """
        opp_id = request.query_params.get('oportunidad')
        opp_uuid = request.query_params.get('uuid')

        if opp_id or opp_uuid:
            try:
                if opp_id:
                    opp = Oportunidad.objects.select_related('cliente').get(id=opp_id)
                else:
                    opp = Oportunidad.objects.select_related('cliente').get(uuid=opp_uuid)
                canal_raw = (getattr(opp.cliente, 'canal', '') or '').upper()
                if canal_raw in ('B2B', 'B2C'):
                    return canal_raw
                tipo = (getattr(opp.cliente, 'tipo_cliente', '') or '').lower()
                return 'B2B' if tipo == 'empresa' else 'B2C'
            except Oportunidad.DoesNotExist:
                pass
        return 'B2B'

    def _precio_vigente(self, capacidad_id: int, canal: str, fecha):
        """
        Consulta PrecioRecompra vigente [valid_from, valid_to) para (capacidad, canal) a 'fecha'.
        """
        key = (capacidad_id, canal, fecha.date())
        if key in self._precio_cache:
            return self._precio_cache[key]

        qs = (PrecioRecompra.objects
              .filter(capacidad_id=capacidad_id, canal=canal, valid_from__lte=fecha)
              .filter(Q(valid_to__isnull=True) | Q(valid_to__gt=fecha))
              .order_by('-valid_from')
              .values_list('precio_neto', flat=True))

        precio = qs.first()
        self._precio_cache[key] = precio
        return precio

    def get_precio(self, obj):
        request = self.context.get("request")
        if not request:
            return None

        # Permite ?fecha=2025-09-01T00:00:00Z para “precio a esa fecha”
        fecha = parse_datetime(request.query_params.get('fecha') or '') or timezone.now()
        canal = self._resolver_canal(request)

        return self._precio_vigente(obj.id, canal, fecha)
