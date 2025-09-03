import re
from django.core.exceptions import ValidationError


def upload_path_anverso(instance, filename):
    return f"kyc/dni/{instance.id}/anverso/{filename}"


def upload_path_reverso(instance, filename):
    return f"kyc/dni/{instance.id}/reverso/{filename}"


def validar_imei(imei: str):
    s = re.sub(r'\D', '', imei or '')
    if not s:
        return
    if len(s) != 15:
        raise ValidationError('El IMEI debe tener 15 dígitos.')
    # Luhn para IMEI
    def luhn_ok(x):
        total = 0
        for i, ch in enumerate(x[::-1]):
            d = int(ch)
            if i % 2 == 1:
                d = d * 2
                if d > 9: d -= 9
            total += d
        return total % 10 == 0
    if not luhn_ok(s):
        raise ValidationError('IMEI inválido (dígito de control).')
