from rest_framework.routers import DefaultRouter
from .views import tipos_modelo
from django.urls import path, include
from .views.admincapacidades import CapacidadAdminListView,SetPrecioRecompraAdminView
from .views.tiposreparacion import PiezaTipoViewSet, ManoObraTipoViewSet
from .views.costespiezas import (
    ReparacionOpcionesView,CostosPiezaCoverageView,
    CostosPiezaListView,
    CostosPiezaSetView,
    CostosPiezaDeleteView,
)
from productos.views import (LanzarActualizacionLikewizeView, EstadoTareaLikewizeView,
  DiffLikewizeView, AplicarCambiosLikewizeView,LogTailLikewizeView,IphoneComercialValoracionView,
  IphoneAuditoriaValoracionView,
  LikewizeCazadorResultadoView,UltimaTareaLikewizeView,CrearDesdeNoMapeadoLikewizeView,LanzarActualizacionB2CView,DiffB2CView,AplicarCambiosB2CView,UltimaTareaB2CView,LanzarActualizacionBackmarketView,DiffBackmarketView,AplicarCambiosBackmarketView,UltimaTareaBackmarketView
)

# El router y el ViewSet de modelos no se utilizan actualmente
# ya que la versión activa se encuentra en la app `checkouters`.
# router = DefaultRouter()
# router.register(r"modelos", ModeloViewSet, basename="modelo")
router = DefaultRouter()
router.register(r"admin/piezas-tipo", PiezaTipoViewSet, basename="admin-piezas-tipo")
router.register(r"admin/mano-obra-tipos", ManoObraTipoViewSet, basename="admin-mano-obra-tipos")

urlpatterns = [
    # path("", include(router.urls)),  # sin uso
    path('tipos-modelo/', tipos_modelo, name='tipos-modelo'),
    path("admin/capacidades/", CapacidadAdminListView.as_view(), name="admin-capacidades-list"),
    path("admin/precios/set/", SetPrecioRecompraAdminView.as_view(), name="admin-precio-set"),
    path("admin/reparacion/opciones/", ReparacionOpcionesView.as_view(), name="admin-reparacion-opciones"),
    path("admin/costos-pieza/", CostosPiezaListView.as_view(), name="admin-costos-pieza-list"),
    path("admin/costos-pieza/set/", CostosPiezaSetView.as_view(), name="admin-costos-pieza-set"),
    path("admin/costos-pieza/<int:pk>/", CostosPiezaDeleteView.as_view(), name="admin-costos-pieza-delete"),
    path("admin/costos-pieza/coverage/", CostosPiezaCoverageView.as_view(), name="admin-costos-pieza-coverage"),
    path("precios/likewize/actualizar/", LanzarActualizacionLikewizeView.as_view()),
    path("precios/likewize/ultima/", UltimaTareaLikewizeView.as_view()),
    path("precios/likewize/tareas/<uuid:tarea_id>/", EstadoTareaLikewizeView.as_view()),
    path("precios/likewize/tareas/<uuid:tarea_id>/diff/", DiffLikewizeView.as_view()),
    path("precios/likewize/tareas/<uuid:tarea_id>/aplicar/", AplicarCambiosLikewizeView.as_view()),
    path("precios/likewize/tareas/<uuid:tarea_id>/log/", LogTailLikewizeView.as_view()),
    path("precios/likewize/tareas/<uuid:tarea_id>/crear-capacidad/", CrearDesdeNoMapeadoLikewizeView.as_view()),
    # B2C (Swappie) staging/diff
    path("precios/b2c/actualizar/", LanzarActualizacionB2CView.as_view()),
    path("precios/b2c/ultima/", UltimaTareaB2CView.as_view()),
    path("precios/b2c/tareas/<uuid:tarea_id>/", EstadoTareaLikewizeView.as_view()),
    path("precios/b2c/tareas/<uuid:tarea_id>/diff/", DiffB2CView.as_view()),
    path("precios/b2c/tareas/<uuid:tarea_id>/aplicar/", AplicarCambiosB2CView.as_view()),
    path("precios/b2c/tareas/<uuid:tarea_id>/log/", LogTailLikewizeView.as_view()),

    # B2C (Back Market) staging/diff
    path("precios/backmarket/actualizar/", LanzarActualizacionBackmarketView.as_view()),
    path("precios/backmarket/ultima/", UltimaTareaBackmarketView.as_view()),
    path("precios/backmarket/tareas/<uuid:tarea_id>/", EstadoTareaLikewizeView.as_view()),
    path("precios/backmarket/tareas/<uuid:tarea_id>/diff/", DiffBackmarketView.as_view()),
    path("precios/backmarket/tareas/<uuid:tarea_id>/aplicar/", AplicarCambiosBackmarketView.as_view()),
    path("precios/backmarket/tareas/<uuid:tarea_id>/log/", LogTailLikewizeView.as_view()),
    path("precios/b2c/actualizar/", LanzarActualizacionB2CView.as_view()),
    path('valoraciones/iphone/comercial/', IphoneComercialValoracionView.as_view(), name='iphone-valoracion-comercial'),
    path('valoraciones/iphone/auditoria/', IphoneAuditoriaValoracionView.as_view(), name='iphone-valoracion-auditoria'),
    path("likewize/tareas/<uuid:uuid>/resultado/", LikewizeCazadorResultadoView.as_view()),

    path("", include(router.urls)),
    ]
