# describe_operaciones_schema.py
from __future__ import annotations
import json
import re
from collections import defaultdict

from django.core.management.base import BaseCommand, CommandError
from django.apps import apps
from django.db.models import (
    Field, ForeignKey, OneToOneField, ManyToManyField, AutoField, BigAutoField
)
from django.db.models.fields import NOT_PROVIDED
from django_tenants.utils import schema_context, get_tenant_model


CANDIDATE_MODELS = [
    "oportunidades.Oportunidad",
    "oportunidades.DispositivoReal",
    "productos.Capacidad",
    "productos.Modelo",
    "checkouters.Cliente",
    "checkouters.Tienda",
    "users.TenantUser",
]

def model_info(model):
    data = {
        "model": f"{model._meta.app_label}.{model.__name__}",
        "db_table": model._meta.db_table,
        "fields": [],
    }
    for f in model._meta.get_fields():
        # omitimos relaciones inversas no directas
        if not isinstance(f, (Field, ForeignKey, OneToOneField, ManyToManyField)):
            continue

        if isinstance(f, (ForeignKey, OneToOneField)):
            data["fields"].append({
                "name": f.name,
                "type": "FK" if isinstance(f, ForeignKey) else "O2O",
                "target": f.related_model._meta.label_lower,
                "null": getattr(f, "null", False),
                "blank": getattr(f, "blank", False),
            })
        elif isinstance(f, ManyToManyField):
            data["fields"].append({
                "name": f.name,
                "type": "M2M",
                "target": f.related_model._meta.label_lower,
            })
        else:
            entry = {
                "name": f.name,
                "type": f.get_internal_type(),
                "null": getattr(f, "null", False),
                "blank": getattr(f, "blank", False),
                "unique": getattr(f, "unique", False),
            }
            if hasattr(f, "max_length") and f.max_length:
                entry["max_length"] = f.max_length
            if getattr(f, "choices", None):
                entry["choices"] = [c for c, _ in f.choices]
            default = getattr(f, "default", NOT_PROVIDED)
            if default is not NOT_PROVIDED:
                entry["default"] = "<callable>" if callable(default) else str(default)
            data["fields"].append(entry)
    return data

def get_model(label: str, required: bool = True):
    try:
        app_label, name = label.split(".")
    except ValueError:
        if required:
            raise CommandError(f"Label inválido: {label}")
        return None
    try:
        app = apps.get_app_config(app_label)
    except LookupError:
        if required:
            raise CommandError(f"No hay app instalada con label '{app_label}'.")
        return None
    for m in app.get_models():
        if m.__name__.lower() == name.lower():
            return m
    if required:
        raise CommandError(f"Modelo '{label}' no encontrado en la app '{app_label}'.")
    return None

# ---------- Generación de blueprint para Cliente ----------
def _guess_sample_value(field: Field):
    """Genera un valor de muestra sensato según nombre/tipo."""
    name = field.name.lower()
    t = field.get_internal_type()
    # Heurísticas por nombre
    if re.search(r"email|correo", name):
        return "cliente@example.com"
    if re.search(r"(nif|cif|vat|tax)", name):
        return "B12345678"
    if re.search(r"(telefono|tel|phone|movil|mobile)", name):
        return "+34 600 123 123"
    if re.search(r"(nombre_comercial)", name):
        return "Comercial de Prueba"
    if re.search(r"(nombre|contacto|responsable)", name):
        return "Juan Pérez"
    if re.search(r"(apellidos)", name):
        return "García López"
    if re.search(r"(razon|empresa|company|social)", name):
        return "Cliente de Prueba S.L."
    if re.search(r"(direccion|address)", name):
        return "Calle Falsa 123"
    if re.search(r"(ciudad|poblacion|city)", name):
        return "Madrid"
    if re.search(r"(provincia|state|region)", name):
        return "Madrid"
    if re.search(r"(cp|postal|zip)", name):
        return "28001"
    if re.search(r"(pais|country)", name):
        return "ES"

    # Heurísticas por tipo
    if t in ("CharField", "TextField"):
        maxlen = getattr(field, "max_length", None)
        base = "Lorem ipsum"
        return base[:maxlen] if maxlen else base
    if t in ("EmailField",):
        return "cliente@example.com"
    if t in ("IntegerField", "BigIntegerField", "SmallIntegerField", "PositiveIntegerField"):
        return 1
    if t in ("DecimalField", "FloatField"):
        return "0.00"
    if t in ("BooleanField",):
        return False
    if t in ("DateField",):
        return "2025-01-01"
    if t in ("DateTimeField",):
        return "2025-01-01T12:00:00Z"
    return None  # por defecto

def _cliente_schema_details(Cliente):
    """Devuelve (fields_info, required_fields, blueprint) para Cliente."""
    info = model_info(Cliente)
    required = []
    blueprint = {}
    # Construir blueprint base
    for f in Cliente._meta.get_fields():
        if not isinstance(f, Field):
            continue
        if isinstance(f, (AutoField, BigAutoField)):
            continue
        if f.auto_created:
            continue

        if isinstance(f, (ForeignKey, OneToOneField)):
            # FK la dejamos en None y que el creador la rellene si quiere
            blueprint[f.name] = None
            continue

        # Base por tipo/nombre
        sample = _guess_sample_value(f)
        if sample is not None:
            blueprint[f.name] = sample

        # Choices reales: coger primera opción válida
        if getattr(f, "choices", None):
            try:
                first = list(f.choices)[0][0]
                blueprint[f.name] = first
            except Exception:
                pass

    # Ajustes finos para campos concretos del JSON que has pasado
    # canal: choices ['b2b','b2c']
    if "canal" in blueprint:
        blueprint["canal"] = "b2b"
    if "tipo_cliente" in blueprint:
        blueprint["tipo_cliente"] = "empresa"

    return info, required, blueprint

# ---------- Pairs usuario↔tienda ----------
def _user_store_pairs(User, Store, limit: int = 200):
    """
    Además de buscar relaciones desde TenantUser hacia Tienda,
    incluye las parejas derivadas de checkouters.Tienda.responsable -> TenantUser.
    """
    from django.db.models import ForeignKey, OneToOneField, ManyToManyField
    pairs = []

    # A) Pairs desde Tienda.responsable
    if Store:
        try:
            for t in Store.objects.select_related("responsable").all().order_by("id"):
                u = getattr(t, "responsable", None)
                if u:
                    if hasattr(u, "is_superuser") and getattr(u, "is_superuser"):
                        continue
                    pairs.append({
                        "usuario_id": u.id,
                        "usuario": getattr(u, "email", getattr(u, "name", f"user_{u.id}")),
                        "tienda_id": t.id,
                        "tienda": getattr(t, "nombre", f"tienda_{t.id}"),
                        "via": "Store.responsable",
                    })
        except Exception:
            pass

    # B) Pairs desde User → Tienda por FK o M2M (por si existe también)
    if User:
        fk_names, m2m_names = [], []
        if Store:
            for f in User._meta.get_fields():
                if isinstance(f, (ForeignKey, OneToOneField)) and getattr(f, "related_model", None) == Store:
                    fk_names.append(f.name)
                if isinstance(f, ManyToManyField) and getattr(f, "related_model", None) == Store:
                    m2m_names.append(f.name)
        fk_names = fk_names or [n for n in ["tienda", "store", "sucursal"] if hasattr(User, n) or hasattr(User, f"{n}_id")]
        m2m_names = m2m_names or [n for n in ["tiendas", "stores"] if hasattr(User, n)]

        for u in User.objects.all().order_by("id"):
            if hasattr(u, "is_superuser") and getattr(u, "is_superuser"):
                continue

            found = False
            for fname in fk_names:
                if hasattr(u, f"{fname}_id") and getattr(u, f"{fname}_id"):
                    tid = getattr(u, f"{fname}_id")
                    pairs.append({
                        "usuario_id": u.id,
                        "usuario": getattr(u, "email", getattr(u, "name", f"user_{u.id}")),
                        "tienda_id": tid,
                        "tienda": None,
                        "via": f"User.FK:{fname}",
                    })
                    found = True
                    break
                if hasattr(u, fname) and getattr(u, fname):
                    t = getattr(u, fname)
                    pairs.append({
                        "usuario_id": u.id,
                        "usuario": getattr(u, "email", getattr(u, "name", f"user_{u.id}")),
                        "tienda_id": getattr(t, "id", None),
                        "tienda": getattr(t, "nombre", None),
                        "via": f"User.FK:{fname}",
                    })
                    found = True
                    break
            if found:
                continue

            for m2m in m2m_names:
                if hasattr(u, m2m):
                    for t in getattr(u, m2m).all():
                        pairs.append({
                            "usuario_id": u.id,
                            "usuario": getattr(u, "email", getattr(u, "name", f"user_{u.id}")),
                            "tienda_id": getattr(t, "id", None),
                            "tienda": getattr(t, "nombre", None),
                            "via": f"User.M2M:{m2m}",
                        })

    # Completar nombres de tienda si solo hay id
    if Store:
        names = dict(Store.objects.values_list("id", "nombre"))
        for p in pairs:
            if p["tienda"] is None and p["tienda_id"] in names:
                p["tienda"] = names[p["tienda_id"]]

    # Limitar y deduplicar por (usuario_id, tienda_id)
    out = []
    seen = set()
    for p in pairs:
        key = (p["usuario_id"], p["tienda_id"])
        if key in seen:
            continue
        seen.add(key)
        out.append(p)
        if len(out) >= limit:
            break
    return out


class Command(BaseCommand):
    help = "Imprime JSON con: modelos, detalles de Cliente (campos obligatorios + blueprint) y parejas (usuario, tienda)."

    def add_arguments(self, parser):
        parser.add_argument("--tenant", required=True, help="schema_name del tenant (partner)")
        parser.add_argument("--limit", type=int, default=200, help="Límite de parejas usuario↔tienda a mostrar.")

    def handle(self, *args, **opts):
        schema = opts["tenant"]
        limit = int(opts["limit"])

        Tenant = get_tenant_model()
        try:
            Tenant.objects.get(schema_name=schema)
        except Tenant.DoesNotExist:
            raise CommandError(f"Schema '{schema}' no existe")

        with schema_context(schema):
            out = {
                "schema": schema,
                "models": [],
                "cliente_schema": None,
                "cliente_required_fields": [],
                "cliente_blueprint": {},
                "user_store_pairs": [],
            }

            # Models
            found = set()
            for m in apps.get_models():
                label = f"{m._meta.app_label}.{m.__name__}"
                if any(label.lower() == cand.lower() for cand in CANDIDATE_MODELS):
                    out["models"].append(model_info(m))
                    found.add(label.lower())

            names = {m._meta.label_lower: m for m in apps.get_models()}
            for want in ["oportunidades.oportunidad", "oportunidades.dispositivoreal"]:
                if want not in found:
                    for label, mod in names.items():
                        if label.endswith(want.split(".")[1]):
                            out["models"].append(model_info(mod))
                            found.add(want)
                            break

            # Cliente details
            Cliente = get_model("checkouters.Cliente", required=False)
            if Cliente:
                info, req, blueprint = _cliente_schema_details(Cliente)
                out["cliente_schema"] = info
                out["cliente_required_fields"] = req
                out["cliente_blueprint"] = blueprint

            # User↔Store pairs (ahora también desde Tienda.responsable)
            User = get_model("users.TenantUser", required=False)
            Store = get_model("checkouters.Tienda", required=False)
            out["user_store_pairs"] = _user_store_pairs(User, Store, limit=limit)

            self.stdout.write(json.dumps(out, ensure_ascii=False, indent=2))
