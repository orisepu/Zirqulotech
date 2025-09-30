import re

_LETRA_NIF = "TRWAGMYFPDXBNJZSQVHLCKE"

def validar_dni_nie(valor: str) -> bool:
    """
    Valida NIF/NIE español:
    - NIF: 8 dígitos + letra (checksum)
    - NIE: X/Y/Z + 7 dígitos + letra (checksum)
    """
    if not valor:
        return False
    s = re.sub(r"\s|-|\.", "", valor).upper()

    # NIE → convertir letra inicial a número
    if re.match(r"^[XYZ]\d{7}[A-Z]$", s):
        mapa = {"X": "0", "Y": "1", "Z": "2"}
        num = mapa[s[0]] + s[1:8]
        letra = s[-1]
    # NIF
    elif re.match(r"^\d{8}[A-Z]$", s):
        num = s[:8]
        letra = s[-1]
    else:
        return False

    try:
        idx = int(num) % 23
        return _LETRA_NIF[idx] == letra
    except Exception:
        return False

def validar_cif(valor: str) -> bool:
    r"""
    Valida CIF español:
    - Formato: [ABCDEFGHJKLMNPQRSUVW]\d{7}[0-9A-J]
    - Control: según tipo, puede ser dígito o letra.
    """
    if not valor:
        return False
    s = re.sub(r"[\s\-.]", "", valor).upper()
    if not re.match(r"^[ABCDEFGHJKLMNPQRSUVW]\d{7}[0-9A-J]$", s):
        return False

    letras = "JABCDEFGHI"
    primera = s[0]
    cuerpo = s[1:8]
    control = s[8]

    pares = sum(int(cuerpo[i]) for i in [1,3,5])
    impares = 0
    for i in [0,2,4,6]:
        d = int(cuerpo[i]) * 2
        impares += (d // 10) + (d % 10)
    suma = pares + impares
    dc_num = (10 - (suma % 10)) % 10
    dc_letra = letras[dc_num]

    # Tipos que usan letra o cifra en control
    usa_letra = primera in "PQSKW"    # entidades públicas, etc.
    usa_num   = primera in "ABEH"      # SA, SL, etc.
    # Resto acepta ambos

    if usa_letra:
        return control == dc_letra
    if usa_num:
        return control == str(dc_num)
    return control == str(dc_num) or control == dc_letra

def detectar_y_validar_documento(valor: str) -> bool:
    """
    Detecta si 'valor' parece DNI/NIE o CIF y valida en consecuencia.
    Devuelve True/False.
    """
    if not valor:
        return False
    s = re.sub(r"[\s\-.]", "", valor).upper()
    if re.match(r"^[XYZ]\d{7}[A-Z]$", s) or re.match(r"^\d{8}[A-Z]$", s):
        return validar_dni_nie(s)
    if re.match(r"^[ABCDEFGHJKLMNPQRSUVW]\d{7}[0-9A-J]$", s):
        return validar_cif(s)
    # Formato desconocido
    return False