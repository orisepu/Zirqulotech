# simular_ops_pagadas.py
from __future__ import annotations

import random
from decimal import Decimal
from datetime import datetime, timedelta
from typing import List

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from django.apps import apps
from django.db import transaction
from django_tenants.utils import schema_context, get_tenant_model
from faker import Faker
import json
from django.db.models import Q, Case, When, Value, IntegerField, ForeignKey, OneToOneField, ManyToManyField


def get_model(label: str, *, required: bool = True):
    """
    Devuelve el modelo por 'app_label.ModelName'.
    Si required=False y no existe la app/modelo, devuelve None en lugar de lanzar error.
    """
    try:
        app_label, name = label.split(".")
    except ValueError:
        if required:
            raise CommandError(f"Label inválido: {label}")
        return None
    try:
        app_config = apps.get_app_config(app_label)
    except LookupError:
        if required:
            raise CommandError(f"No hay app instalada con label '{app_label}'.")
        return None
    for m in app_config.get_models():
        if m.__name__.lower() == name.lower():
            return m
    if required:
        raise CommandError(f"Modelo '{label}' no encontrado en la app '{app_label}'.")
    return None

def get_model_by_table(table_name: str):
    """Devuelve el modelo cuya db_table coincide con table_name (o None si no existe)."""
    for m in apps.get_models():
        if getattr(m._meta, "db_table", None) == table_name:
            return m
    return None

def current_quarter_bounds(tz) -> tuple[datetime, datetime]:
    """
    Devuelve (start, end_inclusive) del trimestre actual en tz (aware).
    """
    now = timezone.now().astimezone(tz)
    q = (now.month - 1) // 3  # 0..3
    start_month = q * 3 + 1
    start = now.replace(month=start_month, day=1, hour=0, minute=0, second=0, microsecond=0)
    if start_month == 10:
        next_q_start = start.replace(year=start.year + 1, month=1)
    else:
        next_q_start = start.replace(month=start_month + 3)
    end = next_q_start - timedelta(seconds=1)
    end = min(end, now)
    return start, end


class Command(BaseCommand):
    help = "Simula operaciones ACABADAS (estado='Pagado') con DispositivoReal dentro del TRIMESTRE ACTUAL."

    # -------- Helpers ----------

    def _pairs_from_progeek_roles(self, ProgeekRol, TenantUser, Tienda, schema: str, roles: list[str] | None):
        """
        Construye pares (usuario, tienda) desde la tabla progeek_rolportenant:
        - Filtra por tenant_slug == schema
        - Si 'roles' no es None, aplica rol__in=roles (case-insensitive)
        - Mapea user_role_id -> users.TenantUser(id)
        - Mapea tienda_id -> checkouters.Tienda(id)
        - Dedup por (usuario_id, tienda_id), en orden.
        """
        if not ProgeekRol:
            return []

        qs = ProgeekRol.objects.filter(tenant_slug=schema)
        if roles:
            # Comparación case-insensitive
            or_q = Q()
            for r in roles:
                or_q |= Q(rol__iexact=r)
            qs = qs.filter(or_q)

        rows = list(qs.select_related("user_role__user").order_by("id"))

        # Cache de usuarios/tiendas por id para minimizar queries
        user_ids = {getattr(getattr(row, "user_role", None), "user_id", None) for row in rows}
        user_ids.discard(None)
        tienda_ids = {getattr(row, "tienda_id", None) for row in rows}
        tienda_ids.discard(None)

        tiendas_by_id = {}
        if Tienda and tienda_ids:
            for t in Tienda.objects.filter(id__in=tienda_ids):
                tiendas_by_id[t.id] = t

        users_by_id = {}
        if TenantUser and user_ids:
            for u in TenantUser.objects.filter(id__in=user_ids):
                users_by_id[u.id] = u
        else:
            # Fallback usando la FK user_role.user ya que TenantUser podría no estar disponible
            for row in rows:
                user_role = getattr(row, "user_role", None)
                user = getattr(user_role, "user", None)
                if user:
                    users_by_id[user.id] = user

        pairs = []
        seen = set()
        for row in rows:
            user_role = getattr(row, "user_role", None)
            uid = getattr(user_role, "user_id", None)
            tid = getattr(row, "tienda_id", None)
            u = users_by_id.get(uid)
            t = tiendas_by_id.get(tid)

            if not u:
                # si no existe ese user en este tenant, salta
                continue
            if hasattr(u, "is_superuser") and getattr(u, "is_superuser"):
                continue

            key = (u.id, t.id if t else None)
            if key in seen:
                continue
            seen.add(key)
            pairs.append({"usuario": u, "tienda": t})

        return pairs

    def _assign_fk(self, obj, field_candidates, value) -> bool:
        val_id = getattr(value, "id", value)
        for fname in field_candidates:
            if hasattr(obj, fname):
                setattr(obj, fname, value)
                return True
            if hasattr(obj, f"{fname}_id"):
                setattr(obj, f"{fname}_id", val_id)
                return True
        return False

    def _to_jsonable(self, v):
        from datetime import datetime
        if isinstance(v, Decimal):
            return float(v)
        if isinstance(v, datetime):
            return v.isoformat()
        return v

    def _precio_vigente_capacidad(self, PrecioRecompra, capacidad, canal: str, fecha, schema: str):
        """
        Devuelve Decimal con precio vigente para (capacidad, canal) evaluado en `fecha`.
        Prioriza tenant_schema == schema y, si no existen, cae a tenant_schema IS NULL.
        Vigencia: valid_from <= fecha AND (valid_to IS NULL OR valid_to > fecha)
        """
        if not PrecioRecompra:
            return None
        qs = (
            PrecioRecompra.objects.filter(capacidad_id=capacidad.id, canal=canal)
            .filter(valid_from__lte=fecha)
            .filter(Q(valid_to__isnull=True) | Q(valid_to__gt=fecha))
        )
        if not qs.exists():
            return None
        qs = qs.annotate(
            _prio=Case(
                When(tenant_schema=schema, then=Value(0)),
                When(tenant_schema__isnull=True, then=Value(1)),
                default=Value(2),
                output_field=IntegerField(),
            )
        ).order_by("_prio", "-valid_from", "-id")
        row = qs.first()
        return getattr(row, "precio_neto", None)

    def _serialize_op(self, op, dispositivos):
        op_data = {
            "id": getattr(op, "id", None),
            "estado": getattr(op, "estado", None),
            "fecha_creacion": getattr(op, "fecha_creacion", None),
            "cliente_id": getattr(op, "cliente_id", None),
            "usuario_id": getattr(op, "usuario_id", None),
            "tienda_id": getattr(op, "tienda_id", None),
            "nombre": getattr(op, "nombre", None),
        }
        for k, v in list(op_data.items()):
            op_data[k] = self._to_jsonable(v)

        devs = []
        for dr in dispositivos:
            d = {
                "modelo_id": getattr(dr, "modelo_id", None),
                "capacidad_id": getattr(dr, "capacidad_id", None),
                "precio_final": getattr(dr, "precio_final", None),
                "recibido": getattr(dr, "recibido", None),
                "auditado": getattr(dr, "auditado", None),
                "fecha_recepcion": getattr(dr, "fecha_recepcion", None),
                "fecha_auditoria": getattr(dr, "fecha_auditoria", None),
                "estado_fisico": getattr(dr, "estado_fisico", None),
                "estado_funcional": getattr(dr, "estado_funcional", None),
                "observaciones": getattr(dr, "observaciones", None),
            }
            for k, v in list(d.items()):
                d[k] = self._to_jsonable(v)
            devs.append(d)

        return {"oportunidad": op_data, "dispositivos": devs}

    def _ensure_tiendas_and_pairs(self, Tienda, TenantUser):
        """
        Devuelve pares {'usuario': <TenantUser>, 'tienda': <Tienda|None>} con rotación adecuada.
        - Caso 1 tienda: rota por todos los usuarios válidos manteniendo esa tienda.
        - Caso varias tiendas: prioriza (tienda,responsable) y añade resto usuarios×tiendas.
        - Si no hay tiendas: devuelve usuarios con tienda=None.
        """
        # Usuarios válidos: todos menos superuser (puedes añadir is_active=True si quieres)
        users = []
        if TenantUser:
            qs_users = TenantUser.objects.all().order_by("id")
            users = [u for u in qs_users if not (hasattr(u, "is_superuser") and getattr(u, "is_superuser"))]
        if not users:
            return []

        # Tiendas
        tiendas = []
        if Tienda:
            tiendas = list(Tienda.objects.all().order_by("id"))

        if not tiendas:
            # No hay modelo/filas de tienda → usa usuarios sin tienda
            return [{"usuario": u, "tienda": None} for u in users]

        if len(tiendas) == 1:
            # === CASO 1 TIENDA: rota por usuarios ===
            t = tiendas[0]
            responsable = getattr(t, "responsable", None)
            pairs = []

            # Primero el responsable (si es usuario válido)
            if responsable and not (hasattr(responsable, "is_superuser") and getattr(responsable, "is_superuser")):
                pairs.append({"usuario": responsable, "tienda": t})

            # Después el resto de usuarios
            for u in users:
                if responsable and u.id == getattr(responsable, "id", None):
                    continue
                pairs.append({"usuario": u, "tienda": t})

            # Si por lo que sea quedó vacío, al menos devolvemos usuarios con esa tienda
            if not pairs:
                pairs = [{"usuario": u, "tienda": t} for u in users]
            return pairs

        # === CASO VARIAS TIENDAS ===
        pairs = []
        # 1) (tienda, responsable) primero
        for t in tiendas:
            resp = getattr(t, "responsable", None)
            if resp and not (hasattr(resp, "is_superuser") and getattr(resp, "is_superuser")):
                pairs.append({"usuario": resp, "tienda": t})

        # 2) Añadir usuarios×tiendas para repartir
        for t in tiendas:
            for u in users:
                if getattr(t, "responsable_id", None) == u.id:
                    continue
                pairs.append({"usuario": u, "tienda": t})

        # 3) Deduplicar por (usuario_id, tienda_id)
        seen = set()
        dedup = []
        for p in pairs:
            key = (p["usuario"].id, p["tienda"].id if p["tienda"] else None)
            if key in seen:
                continue
            seen.add(key)
            dedup.append(p)
        return dedup

    def _crear_cliente_from_blueprint(self, Cliente, fake: Faker, tienda=None):
        """
        Crea un Cliente válido usando un blueprint sensato basado en tu esquema real.
        """
        data = {
            "canal": "b2b",                 # choices reales: b2b/b2c (default b2b)
            "tipo_cliente": "empresa",      # choices reales: empresa/autonomo/particular (default empresa)
            "razon_social": f"{fake.company()}",
            "cif": f"B{random.randint(10000000, 99999999)}",
            "contacto": fake.name(),
            "posicion": random.choice(["Compras", "Gerente", "Responsable TI"]),
            "correo": fake.company_email(),
            "telefono": f"+34 {random.randint(600, 799)} {random.randint(100,999)} {random.randint(100,999)}",
            "nombre": fake.first_name(),
            "apellidos": fake.last_name() + " " + fake.last_name(),
            "dni_nie": f"{random.randint(10000000,99999999)}{random.choice(list('TRWAGMYFPDXBNJZSQVHLCKE'))}",
            "nif": f"B{random.randint(10000000, 99999999)}",
            "nombre_comercial": fake.company(),
            "contacto_financiero": fake.name(),
            "telefono_financiero": f"+34 {random.randint(600, 799)} {random.randint(100,999)} {random.randint(100,999)}",
            "correo_financiero": fake.company_email(),
            "numero_empleados": random.choice([1, 5, 10, 20, 50, 100]),
            "direccion_calle": f"C/{fake.street_name()}, {random.randint(1,199)}",
            "direccion_piso": random.choice(["", "1", "2", "3"]),
            "direccion_puerta": random.choice(["", "A", "B", "C"]),
            "direccion_cp": f"{random.randint(10000, 52999)}",
            "direccion_poblacion": fake.city(),
            "direccion_provincia": random.choice(["Madrid","Barcelona","Valencia","Sevilla","Bizkaia"]),
            "direccion_pais": "ES",
            "vertical": random.choice(["Retail","Telco","Servicios","Tecnología"]),
            "vertical_secundaria": random.choice(["Retail","Telco","Servicios","Tecnología"]),
        }
        if tienda is not None:
            data["tienda"] = tienda
        return Cliente.objects.create(**data)

    # -------- CLI args ----------
    def add_arguments(self, parser):
        parser.add_argument(
            "--tenants",
            required=True,
            help="Schemas separados por coma (p.ej. mbs,otro)",
        )
        parser.add_argument("--count", type=int, default=50, help="Número TOTAL de operaciones a crear (se reparte).")
        parser.add_argument("--min-dev", type=int, default=1, help="Mínimo de dispositivos por operación")
        parser.add_argument("--max-dev", type=int, default=4, help="Máximo de dispositivos por operación")
        parser.add_argument(
            "--roles",
            type=str,
            default=None,
            help="Filtra por roles (coma-separado) de progeek_rolportenant, p.ej: vendedor,responsable,tecnico",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Simula la creación sin persistir cambios (rollback).",
        )
        parser.add_argument(
            "--preview",
            type=int,
            default=1,
            help="Nº de operaciones de ejemplo a imprimir en dry-run (por tenant).",
        )
        parser.add_argument(
            "--canal",
            choices=["B2B", "B2C"],
            default="B2B",
            help="Canal de precio a aplicar (por defecto B2B).",
        )
        parser.add_argument(
            "--jitter",
            type=float,
            default=0.0,
            help="Variación aleatoria ±JITTER sobre el precio base (0.0 = sin variación).",
        )

    # -------- Main ----------
    def handle(self, *args, **opts):
        roles_filter = opts.get("roles")
        roles = [r.strip() for r in roles_filter.split(",")] if roles_filter else None
        tenants: List[str] = [t.strip() for t in opts["tenants"].split(",") if t.strip()]
        if not tenants:
            raise CommandError("Debes pasar al menos un tenant en --tenants")
        total = int(opts["count"])
        min_dev = int(opts["min_dev"])
        max_dev = int(opts["max_dev"])
        dry = bool(opts["dry_run"])
        preview = int(opts["preview"])
        canal = str(opts["canal"])
        jitter = float(opts["jitter"])

        if min_dev < 1 or max_dev < min_dev:
            raise CommandError("--min-dev/--max-dev no válidos")

        Tenant = get_tenant_model()
        for s in tenants:
            if not Tenant.objects.filter(schema_name=s).exists():
                raise CommandError(f"Schema '{s}' no existe")

        fake = Faker("es_ES")

        # Modelos
        Oportunidad = get_model("checkouters.Oportunidad")
        DispositivoReal = get_model("checkouters.DispositivoReal")
        Modelo = get_model("productos.Modelo")
        Capacidad = get_model("productos.Capacidad")
        Cliente = get_model("checkouters.Cliente")
        TenantUser = get_model("users.TenantUser")
        PrecioRecompra = get_model("productos.PrecioRecompra", required=False)
        Tienda = get_model("checkouters.Tienda", required=False)
        ProgeekRol = get_model("progeek.RolPorTenant", required=False) or get_model_by_table("progeek_rolportenant")

        per_tenant = max(1, total // len(tenants))
        tz = timezone.get_current_timezone()
        q_start, q_end = current_quarter_bounds(tz)

        resumen = []

        for schema in tenants:
            with schema_context(schema):
                # Asegura catálogo básico si vacío
                self._ensure_catalogo_basico(Modelo, Capacidad)

                # 1) Prioridad: parejas desde progeek_rolportenant (filtrando por roles si procede)
                pairs = self._pairs_from_progeek_roles(ProgeekRol, TenantUser, Tienda, schema, roles)

                # 2) Fallback: deducir desde Tienda/usuarios (rotación)
                if not pairs:
                    pairs = self._ensure_tiendas_and_pairs(Tienda, TenantUser)

                if not pairs:
                    raise CommandError(f"[{schema}] No hay usuarios/tiendas para asignar a las oportunidades.")

                caps = list(Capacidad.objects.select_related("modelo"))
                if not caps:
                    raise CommandError(f"[{schema}] No hay capacidades disponibles.")

                created_ops = 0
                created_dev = 0
                previews = []
                interval_seconds = max(1, (q_end - q_start).total_seconds())

                with transaction.atomic():
                    for _ in range(per_tenant):
                        # Fechas repartidas dentro del trimestre actual
                        idx = created_ops
                        progress = (idx + random.random()) / max(per_tenant, 1)
                        created_at = q_start + timedelta(seconds=interval_seconds * progress)
                        created_at = min(created_at, q_end)
                        fecha_recepcion = min(created_at + timedelta(days=random.randint(0, 7)), q_end)
                        fecha_auditoria = min(fecha_recepcion + timedelta(days=random.randint(0, 3)), q_end)
                        fecha_pagado = min(fecha_auditoria + timedelta(days=random.randint(0, 7)), q_end)

                        # Round-robin de usuario/tienda
                        pair = pairs[created_ops % len(pairs)]
                        usuario = pair["usuario"]
                        tienda = pair["tienda"]

                        # Cliente NUEVO por operación (puedes vincularlo a la tienda de la op)
                        cliente = self._crear_cliente_from_blueprint(Cliente, fake, tienda=tienda)

                        # Oportunidad
                        fecha_inicio_pago = min(
                            fecha_pagado,
                            fecha_auditoria + timedelta(days=random.randint(0, 2)) if fecha_auditoria else created_at,
                        )

                        op = Oportunidad(
                            estado="Pagado",
                            fecha_inicio_pago=fecha_inicio_pago,
                            nombre=fake.name(),
                        )
                        ok_cli = self._assign_fk(op, ["cliente"], cliente)
                        ok_usr = self._assign_fk(op, ["usuario"], usuario)
                        ok_tnd = True
                        if tienda is not None:
                            ok_tnd = self._assign_fk(op, ["tienda"], tienda)

                        op.save()
                        created_ops += 1

                        # Sobrescribe campos auto_now_add con las fechas simuladas
                        Oportunidad.objects.filter(pk=op.pk).update(
                            fecha_creacion=created_at,
                            fecha_inicio_pago=fecha_inicio_pago,
                        )
                        op.fecha_creacion = created_at
                        op.fecha_inicio_pago = fecha_inicio_pago

                        if not ok_usr:
                            raise CommandError(f"[{schema}] No pude asignar usuario a Oportunidad (campo 'usuario').")
                        if not ok_cli:
                            raise CommandError(f"[{schema}] No pude asignar cliente a Oportunidad (campo 'cliente').")
                        if tienda is not None and not ok_tnd:
                            raise CommandError(f"[{schema}] No pude asignar tienda a Oportunidad (campo 'tienda').")

                        if dry and len(previews) < preview:
                            self.stdout.write(
                                f"[{schema}] DEBUG op ids → usuario_id={getattr(op,'usuario_id',None)} "
                                f"cliente_id={getattr(op,'cliente_id',None)} tienda_id={getattr(op,'tienda_id',None)}"
                            )

                        _devs_for_preview = []
                        min_devices = max(1, min_dev * 3)
                        max_devices = max(min_devices, max_dev * 3)
                        num_dev = random.randint(min_devices, max_devices)

                        for _d in range(num_dev):
                            cap = random.choice(caps)

                            # Precio base: vigente para esta capacidad/canal en fecha_recepcion (prioriza tenant)
                            base = self._precio_vigente_capacidad(
                                PrecioRecompra=PrecioRecompra,
                                capacidad=cap,
                                canal=canal,
                                fecha=fecha_recepcion,
                                schema=schema,
                            )
                            if base is None:
                                base = Decimal(random.choice([120, 150, 180, 220, 300, 350]))
                            else:
                                base = Decimal(base)

                            # Jitter ±jitter
                            if jitter > 0:
                                factor = Decimal(1 + random.uniform(-jitter, jitter))
                                final = (base * factor).quantize(Decimal("0.01"))
                            else:
                                final = base.quantize(Decimal("0.01"))

                            dr = DispositivoReal(
                                oportunidad=op,
                                modelo=cap.modelo,
                                capacidad=cap,
                                estado_fisico=random.choice(["perfecto", "bueno", "regular", "dañado"]),
                                estado_funcional=random.choice(["funciona", "no_enciende", "pantalla_rota", "error_hardware"]),
                                precio_final=final,
                                recibido=True,
                                auditado=True,
                                fecha_recepcion=fecha_recepcion,
                                fecha_auditoria=fecha_auditoria,
                            )
                            dr.save()
                            created_dev += 1

                            if len(_devs_for_preview) < preview:
                                _devs_for_preview.append(dr)

                        if len(previews) < preview:
                            previews.append(self._serialize_op(op, _devs_for_preview))

                    if dry:
                        transaction.set_rollback(True)

                resumen.append((schema, created_ops, created_dev, dry, previews))

        for schema, ops, devs, was_dry, previews in resumen:
            flag = "SIMULADO (no guardado)" if was_dry else "CREADO"
            self.stdout.write(self.style.SUCCESS(f"[{schema}] {flag}: {ops} operaciones / {devs} dispositivos"))
            if was_dry and previews:
                self.stdout.write(self.style.NOTICE(f"[{schema}] Ejemplo(s) de lo que se habría creado:"))
                self.stdout.write(json.dumps(previews, ensure_ascii=False, indent=2))

    # ---------- Helpers ----------
    def _ensure_catalogo_basico(self, Modelo, Capacidad):
        if Modelo.objects.exists() and Capacidad.objects.exists():
            return
        m1 = Modelo.objects.create(descripcion="iPhone 12", tipo="iPhone", pantalla="6.1", año=2020, procesador="A14")
        m2 = Modelo.objects.create(descripcion="iPhone 13", tipo="iPhone", pantalla="6.1", año=2021, procesador="A15")
        m3 = Modelo.objects.create(descripcion="iPad Air (4ª gen)", tipo="iPad", pantalla="10.9", año=2020, procesador="A14")
        for m in (m1, m2, m3):
            for size in ["64 GB", "128 GB", "256 GB"]:
                Capacidad.objects.get_or_create(modelo=m, tamaño=size)
