
from django.db.models.signals import post_save
from django.dispatch import receiver
from .models.oportunidad import Oportunidad, HistorialOportunidad, ComentarioOportunidad

@receiver(post_save, sender=Oportunidad)
def registrar_creacion_oportunidad(sender, instance, created, **kwargs):
    if created:
        HistorialOportunidad.objects.create(
            oportunidad=instance,
            tipo_evento="creacion",
            descripcion="Oportunidad creada",
            usuario = getattr(instance, "usuario", None)
        )

@receiver(post_save, sender=ComentarioOportunidad)
def registrar_comentario(sender, instance, created, **kwargs):
    if created:
        HistorialOportunidad.objects.create(
            oportunidad=instance.oportunidad,
            tipo_evento="comentario",
            descripcion=f"Nuevo comentario: {instance.texto[:80]}",
            usuario=instance.autor
        )