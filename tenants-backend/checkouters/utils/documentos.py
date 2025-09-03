import os
import uuid
import logging
from django.utils.text import slugify
from django.db import connection

logger = logging.getLogger(__name__)

def ruta_documento(instance, filename):
    ext = filename.split('.')[-1]
    nombre_archivo = f"{uuid.uuid4().hex}.{ext}"
    logger.debug(f"📁 Nombre original: {filename} → Generado: {nombre_archivo}")

    # 🔧 Obtener el tenant actual desde la conexión activa
    try:
        tenant = connection.tenant
        tenant_slug = slugify(getattr(tenant, "schema_name", "desconocido"))
        logger.debug(f"🏢 Tenant: {tenant_slug}")
    except Exception as e:
        logger.warning(f"⚠️ Error obteniendo tenant: {e}")
        tenant_slug = "desconocido"

    # Cliente y tienda
    cliente = None
    cliente_id = "0"
    cliente_slug = "sin-cliente"
    tienda_slug = "sin-tienda"

    try:
        if instance.oportunidad:
            # Cliente
            cliente_id = str(instance.oportunidad.cliente_id)
            cliente = getattr(instance.oportunidad, "cliente", None)

            # Tienda
            tienda = getattr(instance.oportunidad, "tienda", None)
            if tienda and hasattr(tienda, "nombre"):
                tienda_slug = slugify(tienda.nombre)
                logger.debug(f"🏬 Tienda: {tienda_slug}")

        elif instance.dispositivo and hasattr(instance.dispositivo, "lote"):
            cliente_id = str(getattr(instance.dispositivo.lote, "cliente_id", "0"))
            cliente = getattr(instance.dispositivo.lote, "cliente", None)

        if cliente and hasattr(cliente, "razon_social"):
            cliente_slug = slugify(cliente.razon_social)
            logger.debug(f"👤 Cliente: {cliente_slug} (ID: {cliente_id})")

    except Exception as e:
        logger.warning(f"⚠️ Error obteniendo cliente o tienda: {e}")

    ruta = os.path.join("documentos", tenant_slug, tienda_slug, f"{cliente_slug}_{cliente_id}", nombre_archivo)
    logger.debug(f"📦 Ruta generada: {ruta}")

    return ruta
