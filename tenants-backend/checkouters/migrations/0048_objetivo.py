from decimal import Decimal
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("checkouters", "0047_alter_cliente_correo"),
    ]

    operations = [
        migrations.CreateModel(
            name="Objetivo",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("tipo", models.CharField(choices=[("tienda", "Tienda"), ("usuario", "Usuario")], max_length=10)),
                ("periodo_tipo", models.CharField(choices=[("mes", "Mensual"), ("trimestre", "Trimestral")], max_length=10)),
                ("periodo_inicio", models.DateField(help_text="Primer día del periodo")),
                ("objetivo_valor", models.DecimalField(decimal_places=2, default=Decimal("0"), max_digits=14)),
                ("objetivo_operaciones", models.PositiveIntegerField(default=0)),
                ("creado_en", models.DateTimeField(auto_now_add=True)),
                ("actualizado_en", models.DateTimeField(auto_now=True)),
                (
                    "tienda",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="objetivos",
                        to="checkouters.tienda",
                    ),
                ),
                (
                    "usuario",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="objetivos",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.AddConstraint(
            model_name="objetivo",
            constraint=models.UniqueConstraint(
                condition=models.Q(("tipo", "tienda")),
                fields=("periodo_tipo", "periodo_inicio", "tienda"),
                name="objetivo_unico_tienda_periodo",
            ),
        ),
        migrations.AddConstraint(
            model_name="objetivo",
            constraint=models.UniqueConstraint(
                condition=models.Q(("tipo", "usuario")),
                fields=("periodo_tipo", "periodo_inicio", "usuario"),
                name="objetivo_unico_usuario_periodo",
            ),
        ),
    ]
