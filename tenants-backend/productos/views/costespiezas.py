from django.db import transaction
from django.utils import timezone
from rest_framework.views import APIView
from rest_framework.generics import DestroyAPIView
from rest_framework.response import Response
from rest_framework.permissions import IsAdminUser
from rest_framework import status

from productos.models.precios import (
    PiezaTipo, ManoObraTipo, CostoPieza
)
from productos.serializers.costespiezas import (
    CostoPiezaListSerializer, CostoPiezaSetSerializer
)


class ReparacionOpcionesView(APIView):
    """
    GET /api/admin/reparacion/opciones/
    -> { piezas: [{value,label}], mano_obra: [{value,label, tarifa_min}] }
    """
    permission_classes = [IsAdminUser]

    def get(self, request, *args, **kwargs):
        piezas = [{"value": p.id, "label": p.nombre} for p in PiezaTipo.objects.filter(activo=True).order_by("nombre")]
        mano_obra = [{
            "value": m.id,
            "label": m.nombre,
            "tarifa_h": str(m.coste_por_hora),
            "descripcion": m.descripcion,
        } for m in ManoObraTipo.objects.all().order_by("nombre")]
        return Response({"piezas": piezas, "mano_obra": mano_obra})


class CostosPiezaListView(APIView):
    """
    GET /api/admin/costos-pieza/?modelo_id=ID[&capacidad_id=ID][&historico=1]
    Por defecto solo devuelve filas vigentes (valid_to IS NULL).
    """
    permission_classes = [IsAdminUser]

    def get(self, request, *args, **kwargs):
        modelo_id = request.query_params.get("modelo_id")
        if not modelo_id:
            return Response({"detail": "modelo_id es obligatorio."}, status=status.HTTP_400_BAD_REQUEST)

        qs = CostoPieza.objects.filter(modelo_id=modelo_id)
        capacidad_id = request.query_params.get("capacidad_id")
        if capacidad_id:
            qs = qs.filter(capacidad_id=capacidad_id)

        historico = request.query_params.get("historico") in ("1", "true", "True")
        if not historico:
            qs = qs.filter(valid_to__isnull=True)

        qs = qs.select_related("pieza_tipo", "mano_obra_tipo").order_by("pieza_tipo__nombre", "id")
        data = CostoPiezaListSerializer(qs, many=True).data
        return Response(data, status=status.HTTP_200_OK)


class CostosPiezaSetView(APIView):
    """
    POST /api/admin/costos-pieza/set/
    Body:
      {
        modelo_id, pieza_tipo_id, mano_obra_tipo_id,
        minutos, coste_neto, mano_obra_fija_neta?, proveedor?,
        capacidad_id?, effective_at?
      }

    Comportamiento:
      - Cierra (valid_to = effective_at) cualquier fila vigente con la misma clave
        (modelo, pieza_tipo, capacidad NULL o igual).
      - Inserta una nueva fila con valid_from = effective_at (o now), valid_to = NULL.
    """
    permission_classes = [IsAdminUser]

    def post(self, request, *args, **kwargs):
        ser = CostoPiezaSetSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        data = ser.validated_data

        modelo_id = data["modelo_id"]
        pieza_tipo_id = data["pieza_tipo_id"]
        mano_obra_tipo_id = data["mano_obra_tipo_id"]
        capacidad_id = data.get("capacidad_id")
        horas = data.get("horas")
        coste_neto = data["coste_neto"]
        mano_obra_fija_neta = data.get("mano_obra_fija_neta")
        proveedor = data.get("proveedor", "")
        effective_at = data.get("effective_at") or timezone.now()

        with transaction.atomic():
            # cierra vigente(s) que coincidan en la clave
            key_filter = {
                "modelo_id": modelo_id,
                "pieza_tipo_id": pieza_tipo_id,
                "valid_to__isnull": True,
            }
            if capacidad_id is None:
                key_filter["capacidad__isnull"] = True
            else:
                key_filter["capacidad_id"] = capacidad_id

            vigentes = CostoPieza.objects.select_for_update().filter(**key_filter)
            for v in vigentes:
                # Si el vigente empieza en o después de effective_at, lo cerramos al mismo instante
                v.valid_to = effective_at
                v.save(update_fields=["valid_to"])

            # crea nueva versión
            nuevo = CostoPieza.objects.create(
                modelo_id=modelo_id,
                capacidad_id=capacidad_id,
                pieza_tipo_id=pieza_tipo_id,
                mano_obra_tipo_id=mano_obra_tipo_id,
                horas=horas,
                coste_neto=coste_neto,
                mano_obra_fija_neta=mano_obra_fija_neta,
                proveedor=proveedor,
                valid_from=effective_at,
                valid_to=None,
            )

        out = CostoPiezaListSerializer(nuevo).data
        return Response(out, status=status.HTTP_201_CREATED)


class CostosPiezaDeleteView(DestroyAPIView):
    """
    DELETE /api/admin/costos-pieza/{id}/
    """
    permission_classes = [IsAdminUser]
    queryset = CostoPieza.objects.all()
    # serializer no necesario para delete, pero DRF lo pide si heredas de DestroyAPIView
    serializer_class = CostoPiezaListSerializer


class CostosPiezaCoverageView(APIView):
    """
    GET /api/admin/costos-pieza/coverage/?modelo_ids=1,2,3[&historico=1]
    -> { by_model: { "1": { piezas: ["pantalla","bateria"], count: 2 }, ... } }
    """
    permission_classes = [IsAdminUser]

    def get(self, request, *args, **kwargs):
        ids_param = (request.query_params.get("modelo_ids") or "").strip()
        if not ids_param:
            return Response({"detail": "modelo_ids es obligatorio (coma separados)."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            modelo_ids = [int(x) for x in ids_param.split(",") if x.strip()]
        except ValueError:
            return Response({"detail": "modelo_ids inválidos."}, status=status.HTTP_400_BAD_REQUEST)

        historico = str(request.query_params.get("historico", "")).lower() in ("1", "true")

        qs = CostoPieza.objects.filter(modelo_id__in=modelo_ids)
        if not historico:
            qs = qs.filter(valid_to__isnull=True)

        # ⚠️ Si pieza_tipo es FK con campo 'nombre':
        pares = qs.values_list("modelo_id", "pieza_tipo__nombre").distinct()
        # ⚠️ Si pieza_tipo es CharField/Slug: usa "pieza_tipo" en vez de "pieza_tipo__nombre"
        # pares = qs.values_list("modelo_id", "pieza_tipo").distinct()

        by_model: dict[int, set[str]] = {}
        for mid, pieza_name in pares:
            by_model.setdefault(mid, set()).add(pieza_name)

        out = {}
        for mid in modelo_ids:
            piezas = sorted(by_model.get(mid, set()))
            out[str(mid)] = {"piezas": piezas, "count": len(piezas)}

        return Response({"by_model": out})

    

