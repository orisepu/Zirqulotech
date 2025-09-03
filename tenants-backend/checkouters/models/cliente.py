from django.db import models
from django.conf import settings
from django.db.models import Q


class Cliente(models.Model):
    class TipoCliente(models.TextChoices):
        EMPRESA = "empresa", "Empresa"
        AUTONOMO = "autonomo", "Autónomo"
        PARTICULAR = "particular", "Particular"
    class Canal(models.TextChoices):
        B2B = "b2b", "B2B"
        B2C = "b2c", "B2C"

    canal = models.CharField(
        max_length=4,
        choices=Canal.choices,
        default=Canal.B2B,
        db_index=True,
        help_text="Canal del cliente (B2B/B2C).")
    
    tipo_cliente = models.CharField(
        max_length=20,
        choices=TipoCliente.choices,
        default=TipoCliente.EMPRESA,
        help_text="Empresa / Autónomo / Particular"
    )
    razon_social = models.CharField("Razón social", max_length=255,blank=True)
    cif = models.CharField("CIF", max_length=20,blank=True)
    contacto = models.CharField("Persona de contacto", max_length=100,blank=True)
    posicion = models.CharField("Posición", max_length=100,blank=True)

    # Contacto general
    correo = models.EmailField("Correo electrónico")
    telefono = models.CharField(max_length=30, blank=True)
    tienda = models.ForeignKey('Tienda', on_delete=models.CASCADE,null=True, blank=True)

    # Autónomo / Particular
    nombre = models.CharField(max_length=100, blank=True)
    apellidos = models.CharField(max_length=150, blank=True)
    dni_nie = models.CharField("DNI/NIE", max_length=20, blank=True)
    nif = models.CharField("NIF", max_length=20, blank=True)
    nombre_comercial = models.CharField("Nombre comercial", max_length=150, blank=True)

    # Contacto financiero (empresa normalmente)
    contacto_financiero = models.CharField(max_length=100, blank=True)
    telefono_financiero = models.CharField(max_length=20, blank=True)
    correo_financiero = models.EmailField(blank=True)

     # Datos de empresa
    numero_empleados = models.PositiveIntegerField(null=True, blank=True)

    # Dirección fiscal
    direccion_calle = models.CharField(max_length=255, blank=True)
    direccion_piso = models.CharField(max_length=50, blank=True)
    direccion_puerta = models.CharField(max_length=50, blank=True)
    direccion_cp = models.CharField(max_length=10, blank=True)
    direccion_poblacion = models.CharField(max_length=100, blank=True)
    direccion_provincia = models.CharField(max_length=100, blank=True)
    direccion_pais = models.CharField(max_length=100, blank=True)   

   # Consentimientos / GDPR (versionados)
    aceptaciones = models.JSONField(default=dict, blank=True)

    # Sector
    vertical = models.CharField(max_length=100, blank=True)
    vertical_secundaria = models.CharField(max_length=100, blank=True)

    class Meta:
        constraints = [
            models.CheckConstraint(
                name="cliente_canal_consistente",
                check=(
                    Q(tipo_cliente="particular", canal="b2c") |
                    Q(tipo_cliente__in=["empresa", "autonomo"], canal="b2b")
                ),
            ),
        ]
    def __str__(self):
        # Empresa
        if self.tipo_cliente == self.TipoCliente.EMPRESA and self.razon_social:
            extra = f" ({self.contacto})" if self.contacto else ""
            return f"{self.razon_social}{extra}"
        # Autónomo
        if self.tipo_cliente == self.TipoCliente.AUTONOMO:
            base = f"{(self.nombre or '').strip()} {(self.apellidos or '').strip()}".strip() or "Autónomo"
            if self.nombre_comercial:
                base = f"{base} · {self.nombre_comercial}"
            return base
        # Particular
        base = f"{(self.nombre or '').strip()} {(self.apellidos or '').strip()}".strip() or "Particular"
        return base


class ComentarioCliente(models.Model):
    cliente = models.ForeignKey("checkouters.Cliente", on_delete=models.CASCADE, related_name="comentarios")
    texto = models.TextField()
    autor = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True)
    fecha = models.DateTimeField(auto_now_add=True)


class ConsultaCliente(models.Model):
    cliente = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    asunto = models.CharField(max_length=255)
    mensaje = models.TextField()
    estado = models.CharField(max_length=20, choices=[('pendiente', 'Pendiente'), ('respondida', 'Respondida')], default='pendiente')
    respuesta = models.TextField(blank=True, null=True)
    fecha_envio = models.DateTimeField(auto_now_add=True)
    fecha_respuesta = models.DateTimeField(blank=True, null=True)
