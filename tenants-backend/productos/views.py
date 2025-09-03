from django.shortcuts import render
from rest_framework import viewsets, filters
from .models.modelos import Modelo, Capacidad
# Los serializers y viewsets de modelos y capacidades se definen en el
# proyecto principal `checkouters` y se usan a través de esa app. Las
# versiones aquí presentes no se usan en el frontend y se comentan para
# evitar confusión.
# from productos.serializers import ModeloSerializer, CapacidadSerializer
from rest_framework.decorators import api_view
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend


# class ModeloViewSet(viewsets.ModelViewSet):
#     queryset = Modelo.objects.all()
#     serializer_class = ModeloSerializer
#     filter_backends = [DjangoFilterBackend, filters.SearchFilter]  # ✅ CORRECTO
#     filterset_fields = ['tipo']
#     search_fields = ['descripcion', 'tipo']



# class CapacidadViewSet(viewsets.ReadOnlyModelViewSet):
#     serializer_class = CapacidadSerializer
#     filter_backends = [filters.SearchFilter, filters.OrderingFilter]
#     search_fields = ['modelo__descripcion']

#     def get_queryset(self):
#         queryset = Capacidad.objects.all()
#         modelo_id = self.request.query_params.get("modelo")
#         if modelo_id:
#             queryset = queryset.filter(modelo_id=modelo_id)
#         return queryset

#     def get_serializer_context(self):
#         return {"request": self.request}
    
@api_view(['GET'])
def tipos_modelo(request):
    tipos = Modelo.objects.values_list('tipo', flat=True).distinct().order_by('tipo')
    return Response(tipos)