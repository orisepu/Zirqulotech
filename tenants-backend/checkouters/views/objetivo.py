from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Dict, Iterable, List
from django.contrib.auth import get_user_model
from django.db.models import Count, Sum
from django.db.models.functions import Coalesce
from django.utils import timezone
from django_tenants.utils import get_public_schema_name, schema_context
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.decorators import action

from progeek.models import RolPorTenant

from ..models import DispositivoReal, Objetivo, Oportunidad, Tienda
from ..permissions import IsTenantManagerOrSuper
from ..serializers.objetivo import ObjetivoSerializer, _parse_periodo
from ..utils.role_filters import get_tienda_ids_for_user


def _period_bounds(periodo: str, periodo_tipo: str) -> tuple[date, datetime, datetime]:
    inicio_date = _parse_periodo(periodo, periodo_tipo)
    if periodo_tipo == "mes":
        if inicio_date.month == 12:
            siguiente = date(inicio_date.year + 1, 1, 1)
        else:
            siguiente = date(inicio_date.year, inicio_date.month + 1, 1)
    else:  # trimestre
        month = inicio_date.month
        next_month = month + 3
        if next_month > 12:
            siguiente = date(inicio_date.year + 1, next_month - 12, 1)
        else:
            siguiente = date(inicio_date.year, next_month, 1)

    tz = timezone.get_current_timezone()
    inicio_dt = timezone.make_aware(datetime.combine(inicio_date, time.min), tz)
    fin_dt = timezone.make_aware(datetime.combine(siguiente, time.min), tz) - timedelta(microseconds=1)
    return inicio_date, inicio_dt, fin_dt


def _fetch_usuarios_manager(tenant_slug: str):
    User = get_user_model()
    public_schema = get_public_schema_name() if callable(get_public_schema_name) else "public"
    with schema_context(public_schema):
        ids = list(
            RolPorTenant.objects.filter(
                tenant_slug=tenant_slug,
                rol__in=["manager", "empleado"],
            ).values_list("user_role__user_id", flat=True)
        )
        usuarios = User.objects.filter(id__in=ids).order_by("name", "email")
        return list(usuarios)


class ObjetivoViewSet(viewsets.ModelViewSet):
    queryset = Objetivo.objects.all()
    serializer_class = ObjetivoSerializer
    permission_classes = [IsAuthenticated, IsTenantManagerOrSuper]

    @action(detail=False, methods=["get"], url_path="resumen")
    def resumen(self, request, *args, **kwargs):
        view = ObjetivoResumenAPIView.as_view()
        return view(request._request)
    
    def get_queryset(self):
        qs = super().get_queryset().order_by("-creado_en")
        tipo = self.request.query_params.get("tipo")
        if tipo in {"tienda", "usuario"}:
            qs = qs.filter(tipo=tipo)
        periodo = self.request.query_params.get("periodo")
        periodo_tipo = self.request.query_params.get("periodo_tipo")
        if periodo and periodo_tipo:
            try:
                inicio_date = _parse_periodo(periodo, periodo_tipo)
                qs = qs.filter(periodo_tipo=periodo_tipo, periodo_inicio=inicio_date)
            except Exception:
                pass
        return qs

    def create(self, request, *args, **kwargs):
        # Delegamos en serializer (update_or_create) y devolvemos datos normalizados
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        objetivo = serializer.save()
        out = self.get_serializer(objetivo).data
        return Response(out, status=201)


class ObjetivoResumenAPIView(APIView):
    permission_classes = [IsAuthenticated, IsTenantManagerOrSuper]

    def get(self, request):
        scope = request.query_params.get("scope") or request.query_params.get("tipo") or "tienda"
        scope = scope.lower()
        if scope not in {"tienda", "usuario"}:
            return Response({"detail": "Parámetro 'scope' debe ser 'tienda' o 'usuario'."}, status=400)

        periodo_tipo = request.query_params.get("periodo_tipo", "mes")
        periodo = request.query_params.get("periodo")
        if not periodo:
            return Response({"detail": "Debes indicar el parámetro 'periodo'."}, status=400)

        try:
            periodo_inicio, inicio_dt, fin_dt = _period_bounds(periodo, periodo_tipo)
        except Exception as exc:
            return Response({"detail": str(exc)}, status=400)

        tenant_slug = getattr(getattr(request, "tenant", None), "schema_name", None)
        if not tenant_slug:
            tenant_slug = request.query_params.get("schema")
        tenant_slug = (tenant_slug or "").lower()

        # Obtener IDs de tiendas permitidas según rol del usuario
        tienda_ids_permitidas = get_tienda_ids_for_user(request.user, tenant_slug)

        if scope == "tienda":
            objetivos = Objetivo.objects.filter(
                tipo="tienda",
                periodo_tipo=periodo_tipo,
                periodo_inicio=periodo_inicio,
            ).select_related("tienda")
            objetivos_map: Dict[int, Objetivo] = {obj.tienda_id: obj for obj in objetivos if obj.tienda_id}

            # Filtrar tiendas según rol del usuario
            tiendas_qs = Tienda.objects.all().order_by("nombre")
            if tienda_ids_permitidas is not None:  # None = acceso a todas
                tiendas_qs = tiendas_qs.filter(id__in=tienda_ids_permitidas)
            targets: Iterable[Tienda] = tiendas_qs

            group_field = "oportunidad__tienda_id"
        else:
            objetivos = Objetivo.objects.filter(
                tipo="usuario",
                periodo_tipo=periodo_tipo,
                periodo_inicio=periodo_inicio,
            ).select_related("usuario")
            objetivos_map = {obj.usuario_id: obj for obj in objetivos if obj.usuario_id}
            targets = _fetch_usuarios_manager(tenant_slug)
            group_field = "oportunidad__usuario_id"

        valor_por_target = defaultdict(lambda: Decimal("0"))
        valor_filter = {
            "oportunidad__estado__iexact": "Pagado",
            "oportunidad__fecha_inicio_pago__gte": inicio_dt,
            "oportunidad__fecha_inicio_pago__lte": fin_dt,
        }
        # Filtrar por tiendas permitidas si scope es tienda
        if scope == "tienda" and tienda_ids_permitidas is not None:
            valor_filter["oportunidad__tienda_id__in"] = tienda_ids_permitidas

        valor_rows = (
            DispositivoReal.objects.filter(**valor_filter)
            .values(group_field)
            .annotate(total=Coalesce(Sum("precio_final"), Decimal("0")))
        )
        for row in valor_rows:
            target_id = row[group_field]
            if target_id is not None:
                valor_por_target[target_id] = Decimal(row["total"] or 0)

        operaciones_por_target = defaultdict(int)
        if scope == "tienda":
            group_values = "tienda_id"
        else:
            group_values = "usuario_id"

        operaciones_filter = {
            "estado__iexact": "Pagado",
            "fecha_inicio_pago__gte": inicio_dt,
            "fecha_inicio_pago__lte": fin_dt,
        }
        # Filtrar por tiendas permitidas si scope es tienda
        if scope == "tienda" and tienda_ids_permitidas is not None:
            operaciones_filter["tienda_id__in"] = tienda_ids_permitidas

        operaciones_rows = (
            Oportunidad.objects.filter(**operaciones_filter)
            .values(group_values)
            .annotate(total=Count("id"))
        )
        for row in operaciones_rows:
            target_id = row[group_values]
            if target_id is not None:
                operaciones_por_target[target_id] = int(row["total"] or 0)

        usuarios_por_tienda: Dict[int, Dict[int, dict]] = defaultdict(dict)
        if scope == "tienda":
            usuarios_valor_filter = {
                "oportunidad__estado__iexact": "Pagado",
                "oportunidad__fecha_inicio_pago__gte": inicio_dt,
                "oportunidad__fecha_inicio_pago__lte": fin_dt,
            }
            # Filtrar por tiendas permitidas
            if tienda_ids_permitidas is not None:
                usuarios_valor_filter["oportunidad__tienda_id__in"] = tienda_ids_permitidas

            usuarios_valor_rows = (
                DispositivoReal.objects.filter(**usuarios_valor_filter)
                .values("oportunidad__tienda_id", "oportunidad__usuario_id")
                .annotate(total=Coalesce(Sum("precio_final"), Decimal("0")))
            )

            for row in usuarios_valor_rows:
                tienda_id = row["oportunidad__tienda_id"]
                usuario_id = row["oportunidad__usuario_id"]
                if tienda_id is None or usuario_id is None:
                    continue
                usuarios_por_tienda[tienda_id].setdefault(
                    usuario_id,
                    {
                        "progreso_valor": Decimal("0"),
                        "progreso_operaciones": 0,
                    },
                )["progreso_valor"] = Decimal(row["total"] or 0)

            usuarios_ops_filter = {
                "estado__iexact": "Pagado",
                "fecha_inicio_pago__gte": inicio_dt,
                "fecha_inicio_pago__lte": fin_dt,
            }
            # Filtrar por tiendas permitidas
            if tienda_ids_permitidas is not None:
                usuarios_ops_filter["tienda_id__in"] = tienda_ids_permitidas

            usuarios_ops_rows = (
                Oportunidad.objects.filter(**usuarios_ops_filter)
                .values("tienda_id", "usuario_id")
                .annotate(total=Count("id"))
            )
            for row in usuarios_ops_rows:
                tienda_id = row["tienda_id"]
                usuario_id = row["usuario_id"]
                if tienda_id is None or usuario_id is None:
                    continue
                usuarios_por_tienda.setdefault(
                    tienda_id,
                    {
                        usuario_id: {
                            "progreso_valor": Decimal("0"),
                            "progreso_operaciones": 0,
                        }
                    },
                )
                usuarios_por_tienda[tienda_id].setdefault(
                    usuario_id,
                    {
                        "progreso_valor": Decimal("0"),
                        "progreso_operaciones": 0,
                    },
                )["progreso_operaciones"] = int(row["total"] or 0)

            usuario_objetivos_map: Dict[int, Objetivo] = {
                obj.usuario_id: obj
                for obj in Objetivo.objects.filter(
                    tipo="usuario",
                    periodo_tipo=periodo_tipo,
                    periodo_inicio=periodo_inicio,
                    usuario_id__isnull=False,
                )
            }

            usuarios_ids = {
                usuario_id
                for usuarios in usuarios_por_tienda.values()
                for usuario_id in usuarios.keys()
            }
            usuarios_info = {
                user.id: user
                for user in _fetch_usuarios_manager(tenant_slug)
                if user.id in usuarios_ids
            }

        results: List[dict] = []
        for target in targets:
            if scope == "tienda":
                target_id = target.id
                nombre = target.nombre
                extra = {}
            else:
                target_id = target.id
                nombre = getattr(target, "name", "") or target.email
                extra = {"email": target.email}

            objetivo = objetivos_map.get(target_id)
            objetivo_valor = float(objetivo.objetivo_valor) if objetivo else 0.0
            objetivo_operaciones = objetivo.objetivo_operaciones if objetivo else 0

            progreso_valor = float(valor_por_target.get(target_id, Decimal("0")))
            progreso_operaciones = operaciones_por_target.get(target_id, 0)

            usuarios_detalle: List[dict] = []
            if scope == "tienda":
                usuarios_en_tienda = usuarios_por_tienda.get(target_id, {})
                for usuario_id, detalle in sorted(
                    usuarios_en_tienda.items(),
                    key=lambda item: item[1]["progreso_valor"],
                    reverse=True,
                ):
                    user = usuarios_info.get(usuario_id)
                    objetivo_usuario = usuario_objetivos_map.get(usuario_id)
                    usuarios_detalle.append(
                        {
                            "usuario_id": usuario_id,
                            "nombre": getattr(user, "name", "") or getattr(user, "email", ""),
                            "objetivo_valor": float(objetivo_usuario.objetivo_valor)
                            if objetivo_usuario
                            else 0.0,
                            "objetivo_operaciones": objetivo_usuario.objetivo_operaciones
                            if objetivo_usuario
                            else 0,
                            "progreso_valor": float(detalle.get("progreso_valor", Decimal("0"))),
                            "progreso_operaciones": detalle.get("progreso_operaciones", 0),
                        }
                    )

            results.append(
                {
                    "objetivo_id": objetivo.id if objetivo else None,
                    "target_id": target_id,
                    "target_name": nombre,
                    "tipo": scope,
                    "periodo_tipo": periodo_tipo,
                    "periodo": periodo,
                    "objetivo_valor": objetivo_valor,
                    "objetivo_operaciones": objetivo_operaciones,
                    "progreso_valor": progreso_valor,
                    "progreso_operaciones": progreso_operaciones,
                    **extra,
                    **({"usuarios": usuarios_detalle} if scope == "tienda" else {}),
                }
            )

        return Response(results)

