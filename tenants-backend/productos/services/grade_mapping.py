# productos/services/grade_mapping.py
"""
Utilidad de mapeo de grados comerciales según documento oficial.
Mapea estados legacy (perfecto/bueno/regular/dañado + funcionales) a grados comerciales (A+/A/B/C/D/R).
"""

# Grados comerciales oficiales
GRADES = ['A+', 'A', 'B', 'C', 'D', 'R']

# Etiquetas españolas oficiales según documento grading_i_phone_v_1_trade_x.md líneas 14-20
GRADE_LABELS = {
    'A+': 'Como nuevo',
    'A': 'Excelente',
    'B': 'Muy bueno',
    'C': 'Correcto',
    'D': 'Defectuoso',
    'R': 'Reciclaje',
}

# Descripciones completas de cada grado (para PDFs y UI)
GRADE_DESCRIPTIONS = {
    'A+': {
        'label': 'Como nuevo',
        'criteria': [
            '100% funcional',
            'Sin marcas en la pantalla',
            'Sin marcas en chasis/trasera',
            'Piezas originales / servicio oficial sin avisos',
            'Aspecto "nuevo"',
        ],
        'short': '100% funcional, sin marcas en pantalla ni chasis, aspecto "nuevo".'
    },
    'A': {
        'label': 'Excelente',
        'criteria': [
            '100% funcional',
            'Sin marcas en la pantalla',
            'Micro-marcas leves en chasis',
            'Piezas originales / servicio oficial sin avisos',
        ],
        'short': '100% funcional, sin marcas en pantalla, micro-marcas leves en chasis.'
    },
    'B': {
        'label': 'Muy bueno',
        'criteria': [
            '100% funcional',
            'Micro-arañazos/marcas en la pantalla',
            'Marcas visibles leves-moderadas o 1 pequeño picotazo en chasis/trasera',
            'Piezas originales / servicio oficial sin avisos',
        ],
        'short': '100% funcional, micro-arañazos en pantalla, marcas leves-moderadas en chasis.'
    },
    'C': {
        'label': 'Correcto',
        'criteria': [
            '100% funcional',
            'Arañazos evidentes en la pantalla (sin roturas)',
            'Arañazos notables y/o pequeños abollones en chasis/trasera',
            'Piezas originales / servicio oficial sin avisos',
        ],
        'short': '100% funcional, arañazos evidentes (sin roturas), desgaste notable.'
    },
    'D': {
        'label': 'Defectuoso',
        'criteria': [
            'No cumple 100% funcional O presenta:',
            '- Pantalla rota o LCD dañado (líneas, manchas, quemados severos)',
            '- Trasera de vidrio rota',
            '- Chasis doblado',
            '- No enciende/no carga',
            '- Fallos críticos (biometría, SIM, llamadas, mic, altavoz, cámara principal)',
            '- Humedad severa',
            '- Piezas no originales/no oficiales con avisos',
        ],
        'short': 'No cumple 100% funcional, pantalla/trasera rota, chasis doblado, o fallos críticos.'
    },
    'R': {
        'label': 'Reciclaje',
        'criteria': [
            'Múltiples fallos críticos simultáneos (≥3)',
            'Daños severos irreparables',
            'Solo valor de componentes para reciclaje',
        ],
        'short': 'Múltiples fallos críticos simultáneos (≥3), solo valor de componentes.'
    },
}


def legacy_to_grade(estado_fisico: str = None, estado_funcional: str = None) -> str:
    """
    Mapea estados legacy (perfecto/bueno/regular/dañado + funcionales) a grado comercial.

    Reglas de mapeo (según frontend gradingCalcs.ts legacyToGrade):
    - Funcionales críticos (no_enciende, pantalla_rota, error_hardware) → D
    - dañado → D
    - perfecto + funciona → A+
    - bueno + funciona → A
    - regular + funciona → B
    - resto → C

    Args:
        estado_fisico: perfecto, bueno, regular, dañado (o None)
        estado_funcional: funciona, no_enciende, pantalla_rota, error_hardware (o None)

    Returns:
        str: Grado comercial A+, A, B, C, o D
    """
    # Normalizar entradas
    fisico = (estado_fisico or '').strip().lower()
    funcional = (estado_funcional or '').strip().lower()

    # Fallos críticos funcionales → D
    criticos = ['no_enciende', 'pantalla_rota', 'error_hardware']
    if funcional in criticos:
        return 'D'

    # Estado físico dañado → D
    if fisico == 'dañado':
        return 'D'

    # Si funciona correctamente, mapeo por estado físico
    if funcional == 'funciona':
        if fisico == 'perfecto':
            return 'A+'
        if fisico == 'bueno':
            return 'A'
        if fisico == 'regular':
            return 'B'
        return 'C'  # fallback conservador

    # Casos sin información funcional clara
    if fisico == 'perfecto':
        return 'A+'
    if fisico == 'bueno':
        return 'A'
    if fisico == 'regular':
        return 'B'

    # Fallback conservador
    return 'C'


def valoracion_to_grade(estado_valoracion: str = None) -> str:
    """
    Mapea estado_valoracion (excelente/muy_bueno/bueno/a_revision) a grado comercial.

    Nota: ESTADOS_VALORACION es un sistema legacy que no coincide exactamente con los grados oficiales.
    Mapeo aproximado:
    - excelente → A+ (asumiendo estado casi perfecto)
    - muy_bueno → A
    - bueno → B
    - a_revision → C (conservador, requiere revisión)

    Args:
        estado_valoracion: excelente, muy_bueno, bueno, a_revision (o None)

    Returns:
        str: Grado comercial A+, A, B, o C
    """
    val = (estado_valoracion or '').strip().lower()

    mapping = {
        'excelente': 'A+',
        'muy_bueno': 'A',
        'bueno': 'B',
        'a_revision': 'C',
    }

    return mapping.get(val, 'C')  # fallback conservador


def grade_to_legacy(grade: str) -> dict:
    """
    Mapeo inverso: grado comercial → estados legacy (para compatibilidad).

    Args:
        grade: A+, A, B, C, D, o R

    Returns:
        dict: {'fisico': str, 'funcional': str}
    """
    mapping = {
        'A+': {'fisico': 'perfecto', 'funcional': 'funciona'},
        'A': {'fisico': 'bueno', 'funcional': 'funciona'},
        'B': {'fisico': 'regular', 'funcional': 'funciona'},
        'C': {'fisico': 'regular', 'funcional': 'funciona'},
        'D': {'fisico': 'dañado', 'funcional': 'no_enciende'},
        'R': {'fisico': 'dañado', 'funcional': 'no_enciende'},
    }

    return mapping.get(grade, {'fisico': 'regular', 'funcional': 'funciona'})


def format_grade_full(grade: str) -> str:
    """
    Formatea un grado como "Etiqueta (Código)".
    Ejemplo: "Como nuevo (A+)", "Excelente (A)"

    Args:
        grade: A+, A, B, C, D, o R

    Returns:
        str: Texto formateado
    """
    label = GRADE_LABELS.get(grade, grade)
    return f"{label} ({grade})"


def get_grade_description_short(grade: str) -> str:
    """
    Obtiene la descripción corta de un grado (para PDFs).

    Args:
        grade: A+, A, B, C, D, o R

    Returns:
        str: Descripción corta del grado
    """
    desc = GRADE_DESCRIPTIONS.get(grade, {})
    return desc.get('short', '')
