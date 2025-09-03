from rest_framework.pagination import PageNumberPagination

class StandardResultsSetPagination(PageNumberPagination):
    page_size = 25                      # por defecto
    page_size_query_param = "page_size" # habilita ?page_size=...
    max_page_size = 200                 # tapa superior
    page_query_param = "page"           # ?page=2