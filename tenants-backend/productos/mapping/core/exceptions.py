"""
Excepciones custom para el sistema de mapeo v4.

Define una jerarquía clara de excepciones para diferentes
tipos de errores que pueden ocurrir durante el mapeo.
"""


class MappingError(Exception):
    """Base exception para todos los errores de mapeo."""
    pass


class FeatureExtractionError(MappingError):
    """Error durante la extracción de features."""
    pass


class KnowledgeBaseError(MappingError):
    """Error al consultar o usar el knowledge base."""
    pass


class MatcherError(MappingError):
    """Error durante el proceso de matching."""
    pass


class NoMatchFoundError(MappingError):
    """No se encontró ningún match válido."""

    def __init__(self, message: str, candidates_found: int = 0):
        super().__init__(message)
        self.candidates_found = candidates_found


class AmbiguousMatchError(MappingError):
    """Se encontraron múltiples matches con scores similares."""

    def __init__(self, message: str, candidates: list):
        super().__init__(message)
        self.candidates = candidates


class InvalidInputError(MappingError):
    """Input inválido o malformado."""
    pass


class ConfigurationError(MappingError):
    """Error en la configuración del sistema de mapeo."""
    pass
