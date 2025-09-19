from decimal import Decimal
from django.conf import settings
from django.db import models
from django.db.models import Q


class Objetivo(models.Model):
    TIPO_CHOICES = (
        ("tienda", "Tienda"),
        ("usuario", "Usuario"),
    )
    PERIODO_CHOICES = (
        ("mes", "Mensual"),
        ("trimestre", "Trimestral"),
    )

    tipo = models.CharField(max_length=10, choices=TIPO_CHOICES)
    periodo_tipo = models.CharField(max_length=10, choices=PERIODO_CHOICES)
    periodo_inicio = models.DateField(help_text="Primer día del periodo")

    tienda = models.ForeignKey(
        "Tienda",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="objetivos",
    )
    usuario = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="objetivos",
    )

    objetivo_valor = models.DecimalField(max_digits=14, decimal_places=2, default=Decimal("0"))
    objetivo_operaciones = models.PositiveIntegerField(default=0)

    creado_en = models.DateTimeField(auto_now_add=True)
    actualizado_en = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["periodo_tipo", "periodo_inicio", "tienda"],
                condition=Q(tipo="tienda"),
                name="objetivo_unico_tienda_periodo",
            ),
            models.UniqueConstraint(
                fields=["periodo_tipo", "periodo_inicio", "usuario"],
                condition=Q(tipo="usuario"),
                name="objetivo_unico_usuario_periodo",
            ),
        ]

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.tipo == "tienda" and not self.tienda_id:
            raise ValidationError("Debe asignar una tienda para un objetivo de tipo tienda.")
        if self.tipo == "usuario" and not self.usuario_id:
            raise ValidationError("Debe asignar un usuario para un objetivo de tipo usuario.")
        if self.tipo == "tienda" and self.usuario_id:
            raise ValidationError("No debe asignar usuario en un objetivo de tienda.")
        if self.tipo == "usuario" and self.tienda_id:
            raise ValidationError("No debe asignar tienda en un objetivo de usuario.")

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)

    def __str__(self) -> str:
        if self.tipo == "tienda" and self.tienda:
            target = self.tienda.nombre
        elif self.tipo == "usuario" and self.usuario:
            target = getattr(self.usuario, "name", self.usuario.email)
        else:
            target = "Sin asignar"
        return f"Objetivo {self.tipo} {target} {self.periodo_tipo} {self.periodo_inicio}"
