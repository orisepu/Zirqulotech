from django.db import models
from django.conf import settings


class Chat(models.Model):
    cliente = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='chats')
    creado = models.DateTimeField(auto_now_add=True)
    cerrado = models.BooleanField(default=False)

    def __str__(self):
        return f"Chat #{self.id} con {self.cliente.name}"

class Mensaje(models.Model):
    chat = models.ForeignKey(Chat, on_delete=models.CASCADE, related_name='mensajes')
    autor = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    texto = models.TextField()
    enviado = models.DateTimeField(auto_now_add=True)
    es_bot = models.BooleanField(default=False)
    oportunidad = models.ForeignKey(
        'checkouters.Oportunidad',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='mensajes',
    )
    dispositivo = models.ForeignKey(
        'checkouters.Dispositivo',
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='mensajes',
    )

    def __str__(self):
        autor = self.autor.name if self.autor else "BOT"
        return f"[{self.enviado}] {autor}: {self.texto[:30]}"


