from rest_framework import serializers
from ..models.dispositivo import Dispositivo, DispositivoReal
from ..models.oportunidad import Oportunidad
# IMPORTANTE: DispositivoPersonalizado ahora está en productos (SHARED_APPS)
from productos.models import DispositivoPersonalizado

from productos.models.modelos import Modelo, Capacidad
from .producto import ModeloSerializer, CapacidadSerializer
# IMPORTANTE: DispositivoPersonalizadoSimpleSerializer ahora está en productos.serializers
from productos.serializers import DispositivoPersonalizadoSimpleSerializer
from decimal import Decimal
from collections import OrderedDict
from .utils import PKOrUUIDRelatedField
import logging

logger = logging.getLogger(__name__)


class DispositivoSerializer(serializers.ModelSerializer):
    modelo = ModeloSerializer(read_only=True)
    modelo_id = serializers.PrimaryKeyRelatedField(queryset=Modelo.objects.all(), write_only=True, source='modelo')

    capacidad = CapacidadSerializer(read_only=True)
    capacidad_id = serializers.PrimaryKeyRelatedField(queryset=Capacidad.objects.all(), write_only=True, source='capacidad')

    # Nuevos campos
    salud_bateria_pct = serializers.IntegerField(min_value=0, max_value=100, required=False, allow_null=True)
    ciclos_bateria = serializers.IntegerField(min_value=0, required=False, allow_null=True)
    funcionalidad_basica = serializers.ChoiceField(choices=[('ok','ok'),('parcial','parcial')], required=False, allow_null=True)

    pantalla_funcional_puntos_bril = serializers.BooleanField(required=False)
    pantalla_funcional_pixeles_muertos = serializers.BooleanField(required=False)
    pantalla_funcional_lineas_quemaduras = serializers.BooleanField(required=False)

    estado_pantalla = serializers.ChoiceField(choices=[c[0] for c in Dispositivo.ESTETICA_CHOICES], required=False, allow_null=True)
    estado_lados = serializers.ChoiceField(choices=[c[0] for c in Dispositivo.ESTETICA_CHOICES], required=False, allow_null=True)
    estado_espalda = serializers.ChoiceField(choices=[c[0] for c in Dispositivo.ESTETICA_CHOICES], required=False, allow_null=True)

    imei = serializers.CharField(allow_blank=True, allow_null=True, required=False, default=None)

    class Meta:
        model = Dispositivo
        fields = [
            'id', 'modelo', 'modelo_id', 'capacidad', 'capacidad_id',
            'tipo',
            'estado_fisico', 'estado_funcional', 'estado_valoracion',
            'precio_orientativo', 'fecha_creacion', 'imei', 'numero_serie',
            'fecha_caducidad', 'oportunidad', 'cantidad',
            # nuevos
            'salud_bateria_pct', 'ciclos_bateria', 'funcionalidad_basica',
            'pantalla_funcional_puntos_bril', 'pantalla_funcional_pixeles_muertos', 'pantalla_funcional_lineas_quemaduras',
            'estado_pantalla', 'estado_lados', 'estado_espalda',
        ]
        # 👇 Evita la validación de choices de DRF en entrada
        extra_kwargs = {
            'estado_fisico': {'read_only': True},
            'estado_funcional': {'read_only': True},
        }

    # --- LOG de lo que llega antes de validar ---
    def to_internal_value(self, data):
        try:
            logger.info("DispositivoSerializer INPUT raw=%s", data)
        except Exception:
            pass
        return super().to_internal_value(data)

    def validate_imei(self, v):
        v = (v or '').strip()
        if not v:
            return v
        oportunidad = self.initial_data.get('oportunidad') or getattr(self.instance, 'oportunidad_id', None)
        if oportunidad:
            exists = Dispositivo.objects.filter(
                oportunidad_id=oportunidad, imei=v
            ).exclude(pk=getattr(self.instance, 'pk', None)).exists()
            if exists:
                raise serializers.ValidationError('Este IMEI ya está en esta oportunidad.')
        return v

    # ---- MAPEOS NUEVA→LEGACY ----
    @staticmethod
    def _map_estado_fisico(front_value, est_pant, est_lados, est_espalda):
        # Si ya viene legacy, úsalo
        if front_value in ('perfecto','bueno','regular','dañado'):
            return front_value

        tabla = {
            'sin_signos': 'perfecto',
            'minimos': 'bueno',
            'algunos': 'regular',
            'desgaste_visible': 'dañado',
            'agrietado': 'dañado',
            'agrietado_roto': 'dañado',
        }
        if front_value:
            return tabla.get(front_value)

        rank = {'sin_signos':0, 'minimos':1, 'algunos':2, 'desgaste_visible':3, 'agrietado_roto':4}
        peor = max(rank.get(est_pant,'sin_signos'), rank.get(est_lados,'sin_signos'), rank.get(est_espalda,'sin_signos'))
        if peor == 0: return 'perfecto'
        if peor == 1: return 'bueno'
        if peor == 2: return 'regular'
        return 'dañado'

    @staticmethod
    def _map_estado_funcional(func_basica, puntos, pixeles, lineas, front_value=None):
        # Si viene legacy explícito, respétalo
        if front_value in ('funciona','no_enciende','pantalla_rota','error_hardware'):
            return front_value
        # Caso nuevo: 'ok'/'parcial' + incidencias de pantalla
        if (func_basica == 'ok') and not (puntos or pixeles or lineas):
            return 'funciona'
        return 'error_hardware'

    def _extract_front_alias(self):
        """Toma valores que el front podría estar enviando con las claves legacy."""
        data = getattr(self, 'initial_data', {}) or {}
        return {
            'estado_fisico_front': data.get('estado_fisico'),        # ej: 'sin_signos'
            'estado_funcional_front': data.get('estado_funcional'),  # ej: 'ok'
        }

    def create(self, validated_data):
        # Logs útiles
        try:
            logger.info("Create validated_data pre-map=%s", validated_data)
        except Exception:
            pass

        aliases = self._extract_front_alias()

        est_pant = validated_data.get('estado_pantalla')
        est_lados = validated_data.get('estado_lados')
        est_espalda = validated_data.get('estado_espalda')
        func_basica = validated_data.get('funcionalidad_basica')
        puntos = validated_data.get('pantalla_funcional_puntos_bril') or False
        pixeles = validated_data.get('pantalla_funcional_pixeles_muertos') or False
        lineas = validated_data.get('pantalla_funcional_lineas_quemaduras') or False

        validated_data['estado_fisico'] = self._map_estado_fisico(
            aliases['estado_fisico_front'], est_pant, est_lados, est_espalda
        )
        validated_data['estado_funcional'] = self._map_estado_funcional(
            func_basica, puntos, pixeles, lineas, front_value=aliases['estado_funcional_front']
        )

        try:
            logger.info("Create validated_data post-map=%s", validated_data)
        except Exception:
            pass

        return super().create(validated_data)

    def update(self, instance, validated_data):
        try:
            logger.info("Update validated_data pre-map=%s", validated_data)
        except Exception:
            pass

        aliases = self._extract_front_alias()

        est_pant = validated_data.get('estado_pantalla', instance.estado_pantalla)
        est_lados = validated_data.get('estado_lados', instance.estado_lados)
        est_espalda = validated_data.get('estado_espalda', instance.estado_espalda)
        func_basica = validated_data.get('funcionalidad_basica', instance.funcionalidad_basica)
        puntos = validated_data.get('pantalla_funcional_puntos_bril', instance.pantalla_funcional_puntos_bril)
        pixeles = validated_data.get('pantalla_funcional_pixeles_muertos', instance.pantalla_funcional_pixeles_muertos)
        lineas = validated_data.get('pantalla_funcional_lineas_quemaduras', instance.pantalla_funcional_lineas_quemaduras)

        validated_data['estado_fisico'] = self._map_estado_fisico(
            aliases['estado_fisico_front'] or validated_data.get('estado_fisico', instance.estado_fisico),
            est_pant, est_lados, est_espalda
        )
        validated_data['estado_funcional'] = self._map_estado_funcional(
            func_basica, puntos, pixeles, lineas,
            front_value=(aliases['estado_funcional_front'] or validated_data.get('estado_funcional', instance.estado_funcional))
        )

        try:
            logger.info("Update validated_data post-map=%s", validated_data)
        except Exception:
            pass

        return super().update(instance, validated_data)

class DispositivoRealSerializer(serializers.ModelSerializer):
    # Catálogo normal (Apple)
    modelo_id = serializers.PrimaryKeyRelatedField(
        queryset=Modelo.objects.all(),
        source='modelo',
        write_only=True,
        required=False,
        allow_null=True
    )
    capacidad_id = serializers.PrimaryKeyRelatedField(
        queryset=Capacidad.objects.all(),
        source='capacidad',
        write_only=True,
        required=False,
        allow_null=True
    )

    # Dispositivos personalizados (no-Apple)
    dispositivo_personalizado = DispositivoPersonalizadoSimpleSerializer(read_only=True)
    dispositivo_personalizado_id = serializers.PrimaryKeyRelatedField(
        queryset=DispositivoPersonalizado.objects.filter(activo=True),
        source='dispositivo_personalizado',
        write_only=True,
        required=False,
        allow_null=True
    )

    modelo = serializers.CharField(source='modelo.descripcion', read_only=True)
    capacidad = serializers.CharField(source='capacidad.tamaño', read_only=True)
    oportunidad = PKOrUUIDRelatedField(queryset=Oportunidad.objects.all(), uuid_field="uuid")
    precio_por_estado = serializers.SerializerMethodField()
    estado_valoracion = serializers.SerializerMethodField()
    precio_orientativo = serializers.SerializerMethodField()
    precio_final = serializers.DecimalField(
        max_digits=10,
        decimal_places=2,
        required=False,
        allow_null=True,
        coerce_to_string=False
    )
    class Meta:
        model = DispositivoReal
        fields = '__all__'

    def validate(self, attrs):
        # Validar IMEI único por oportunidad
        imei = (attrs.get('imei') or getattr(self.instance, 'imei', '') or '').strip()
        if imei:
            oportunidad = attrs.get('oportunidad') or getattr(self.instance, 'oportunidad', None)
            if oportunidad:
                qs = DispositivoReal.objects.filter(oportunidad=oportunidad, imei=imei)
                if self.instance:
                    qs = qs.exclude(pk=self.instance.pk)
                if qs.exists():
                    raise serializers.ValidationError({'imei': 'Este IMEI ya está en esta oportunidad.'})

        # Validar lógica de dispositivo: debe tener (modelo+capacidad) O dispositivo_personalizado
        tiene_catalogo = attrs.get('modelo') and attrs.get('capacidad')
        tiene_personalizado = attrs.get('dispositivo_personalizado')

        if not tiene_catalogo and not tiene_personalizado:
            raise serializers.ValidationError(
                "Debe especificar (modelo + capacidad) o dispositivo_personalizado"
            )

        if tiene_catalogo and tiene_personalizado:
            raise serializers.ValidationError(
                "No puede especificar ambos: catálogo normal y dispositivo personalizado"
            )

        return attrs

    def get_estado_valoracion(self, obj):
        fisico = obj.estado_fisico
        funcional = obj.estado_funcional
        criticos = ['no_enciende', 'pantalla_rota', 'otros']
        if fisico == 'dañado' or funcional in criticos:
            return 'A revision'
        if fisico == 'perfecto' and funcional == 'funciona':
            return 'Excelente'
        if fisico == 'bueno' and funcional == 'funciona':
            return 'Muy bueno'
        return 'Bueno'

    def get_factor(self, precio):
        if precio <= 100: return Decimal('0.76')
        elif precio <= 200: return Decimal('0.77')
        elif precio <= 300: return Decimal('0.79')
        elif precio <= 400: return Decimal('0.81')
        elif precio <= 500: return Decimal('0.83')
        elif precio <= 750: return Decimal('0.85')
        elif precio <= 1000: return Decimal('0.87')
        elif precio <= 1250: return Decimal('0.88')
        elif precio <= 1500: return Decimal('0.88')
        else: return Decimal('0.89')

    def get_precio_final(self, estado, base):
        estado = estado.lower()
        if not isinstance(base, Decimal):
            base = Decimal(base)
        factor = self.get_factor(base)
        if estado == 'excelente':
            return round(base)
        if estado == 'muy bueno':
            return round(base * factor)
        if estado == 'bueno':
            return round(base * factor * factor)
        return 0

    def get_precio_por_estado(self, obj):
        origen = getattr(obj, 'origen', None)
        if not origen or not origen.precio_orientativoexcelente:
            return {}

        try:
            base = Decimal(origen.precio_orientativoexcelente)
        except:
            return {}

        return OrderedDict({
            "excelente": self.get_precio_final("excelente", base),
            "muy_bueno": self.get_precio_final("muy bueno", base),
            "bueno": self.get_precio_final("bueno", base),
            "a_revision": 0,
        })
    def get_precio_orientativo(self, obj):
        origen = getattr(obj, 'origen', None)
        if not origen or not origen.precio_orientativoexcelente:
            return None

        estado = self.get_estado_valoracion(obj).lower()
        base = origen.precio_orientativoexcelente
        precio = self.get_precio_final(estado, base)
        return precio
