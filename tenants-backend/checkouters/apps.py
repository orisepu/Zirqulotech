from django.apps import AppConfig


class CheckoutersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'checkouters'

    def ready(self):
        import checkouters.signals  # o el path correcto a tu archivo de señales