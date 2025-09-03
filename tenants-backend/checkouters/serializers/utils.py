from rest_framework import serializers
from django.core.exceptions import ObjectDoesNotExist

class PKOrUUIDRelatedField(serializers.Field):
    """
    Acepta un PK (int/string numérica) o un UUID (string) y lo resuelve
    contra el queryset dado. Representa como UUID si existe ese campo.
    """
    def __init__(self, queryset, uuid_field="uuid", **kwargs):
        super().__init__(**kwargs)
        self.queryset = queryset
        self.uuid_field = uuid_field

    def to_representation(self, value):
        # Si el modelo tiene campo uuid, devolvemos uuid; si no, el pk
        if hasattr(value, self.uuid_field):
            return str(getattr(value, self.uuid_field))
        return value.pk

    def to_internal_value(self, data):
        # PK numérico
        if isinstance(data, int) or (isinstance(data, str) and data.isdigit()):
            try:
                return self.queryset.get(pk=int(data))
            except ObjectDoesNotExist:
                raise serializers.ValidationError("Objeto no encontrado por id.")
        # UUID string
        try:
            return self.queryset.get(**{self.uuid_field: str(data)})
        except ObjectDoesNotExist:
            raise serializers.ValidationError("Objeto no encontrado por uuid.")
        except Exception:
            raise serializers.ValidationError("Valor inválido para relación.")
