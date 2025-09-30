from rest_framework.routers import DefaultRouter
from .views import tipos_modelo
from .views.admincapacidades import marcas_modelo
from django.urls import path, include
from .views.admincapacidades import (
    CapacidadAdminListView,
    CapacidadAdminDetailView,
    ModeloCreateView,
    ModelosSinCapacidadesView,
    ModeloSearchView,
    AsociarLikewizeModeloView,
    SetPrecioRecompraAdminView,
)
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
  LikewizeCazadorResultadoView,ListarTareasLikewizeView,UltimaTareaLikewizeView,CrearDesdeNoMapeadoLikewizeView,RemapearTareaLikewizeView,LanzarActualizacionB2CView,DiffB2CView,AplicarCambiosB2CView,UltimaTareaB2CView,LanzarActualizacionBackmarketView,DiffBackmarketView,AplicarCambiosBackmarketView,UltimaTareaBackmarketView,LikewizePresetsView
)
from .views.autoaprendizaje_v3 import (
    LanzarActualizacionV3View,
    LearningMetricsView,
    ReviewMappingView,
    KnowledgeBaseStatsView,
    TaskLogV3View,
    TaskStatusV3View,
    DiffV3View,
    AplicarCambiosV3View,
    cleanup_knowledge_base,
    export_learning_data,
    get_unmapped_items
)
from .views.device_mapping_v2_views import (
    validate_mapping,
    get_mappings_for_review,
    get_mapping_statistics,
    get_session_report,
    test_device_mapping,
    get_mapping_details,
    add_knowledge_base_entry,
    search_knowledge_base,
    get_algorithm_comparison,
    apply_manual_correction
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
    path('marcas-modelo/', marcas_modelo, name='marcas-modelo'),
    path("admin/modelos/", ModeloCreateView.as_view(), name="admin-modelos-create"),
    path("admin/modelos/search/", ModeloSearchView.as_view(), name="admin-modelos-search"),
    path("admin/modelos/<int:pk>/asociar-likewize/", AsociarLikewizeModeloView.as_view(), name="admin-modelos-asociar-likewize"),
    path("admin/modelos/sin-capacidades/", ModelosSinCapacidadesView.as_view(), name="admin-modelos-sin-capacidades"),
    path("admin/capacidades/", CapacidadAdminListView.as_view(), name="admin-capacidades-list"),
    path("admin/capacidades/<int:pk>/", CapacidadAdminDetailView.as_view(), name="admin-capacidades-detail"),
    path("admin/precios/set/", SetPrecioRecompraAdminView.as_view(), name="admin-precio-set"),
    path("admin/reparacion/opciones/", ReparacionOpcionesView.as_view(), name="admin-reparacion-opciones"),
    path("admin/costos-pieza/", CostosPiezaListView.as_view(), name="admin-costos-pieza-list"),
    path("admin/costos-pieza/set/", CostosPiezaSetView.as_view(), name="admin-costos-pieza-set"),
    path("admin/costos-pieza/<int:pk>/", CostosPiezaDeleteView.as_view(), name="admin-costos-pieza-delete"),
    path("admin/costos-pieza/coverage/", CostosPiezaCoverageView.as_view(), name="admin-costos-pieza-coverage"),
    path("precios/likewize/actualizar/", LanzarActualizacionLikewizeView.as_view()),
    path("precios/likewize/presets/", LikewizePresetsView.as_view()),
    path("precios/likewize/tareas/", ListarTareasLikewizeView.as_view()),
    path("precios/likewize/ultima/", UltimaTareaLikewizeView.as_view()),
    path("precios/likewize/tareas/<uuid:tarea_id>/", EstadoTareaLikewizeView.as_view()),
    path("precios/likewize/tareas/<uuid:tarea_id>/diff/", DiffLikewizeView.as_view()),
    path("precios/likewize/tareas/<uuid:tarea_id>/aplicar/", AplicarCambiosLikewizeView.as_view()),
    path("precios/likewize/tareas/<uuid:tarea_id>/log/", LogTailLikewizeView.as_view()),
    path("precios/likewize/tareas/<uuid:tarea_id>/crear-capacidad/", CrearDesdeNoMapeadoLikewizeView.as_view()),
    path("precios/likewize/tareas/<uuid:tarea_id>/remapear/", RemapearTareaLikewizeView.as_view()),
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

    # Device Mapping V2 APIs
    path("device-mapping/v2/validate/", validate_mapping, name="device-mapping-v2-validate"),
    path("device-mapping/v2/review/", get_mappings_for_review, name="device-mapping-v2-review"),
    path("device-mapping/v2/statistics/", get_mapping_statistics, name="device-mapping-v2-statistics"),
    path("device-mapping/v2/session-report/<str:tarea_id>/", get_session_report, name="device-mapping-v2-session-report"),
    path("device-mapping/v2/test/", test_device_mapping, name="device-mapping-v2-test"),
    path("device-mapping/v2/details/<uuid:mapping_id>/", get_mapping_details, name="device-mapping-v2-details"),
    path("device-mapping/v2/knowledge-base/", add_knowledge_base_entry, name="device-mapping-v2-knowledge-base-add"),
    path("device-mapping/v2/knowledge-base/search/", search_knowledge_base, name="device-mapping-v2-knowledge-base-search"),
    path("device-mapping/v2/algorithm-comparison/", get_algorithm_comparison, name="device-mapping-v2-algorithm-comparison"),
    path("device-mapping/v2/manual-correction/", apply_manual_correction, name="device-mapping-v2-manual-correction"),

    # Auto-learning V3 APIs
    path("likewize/v3/actualizar/", LanzarActualizacionV3View.as_view(), name="likewize-v3-actualizar"),
    path("likewize/v3/metrics/", LearningMetricsView.as_view(), name="likewize-v3-metrics"),
    path("likewize/v3/metrics/<uuid:tarea_id>/", LearningMetricsView.as_view(), name="likewize-v3-task-metrics"),
    path("likewize/v3/review/", ReviewMappingView.as_view(), name="likewize-v3-review"),
    path("likewize/v3/knowledge-base/stats/", KnowledgeBaseStatsView.as_view(), name="likewize-v3-kb-stats"),
    path("likewize/v3/knowledge-base/cleanup/", cleanup_knowledge_base, name="likewize-v3-cleanup"),
    path("likewize/v3/export/", export_learning_data, name="likewize-v3-export"),

    # V3 Task monitoring endpoints
    path("likewize/v3/tareas/<uuid:tarea_id>/log/", TaskLogV3View.as_view(), name="likewize-v3-task-log"),
    path("likewize/v3/tareas/<uuid:tarea_id>/estado/", TaskStatusV3View.as_view(), name="likewize-v3-task-status"),
    path("likewize/v3/tareas/activas/", TaskStatusV3View.as_view(), name="likewize-v3-active-tasks"),

    # V3 Diff and Apply endpoints
    path("likewize/v3/tareas/<uuid:tarea_id>/diff/", DiffV3View.as_view(), name="likewize-v3-diff"),
    path("likewize/v3/tareas/<uuid:tarea_id>/aplicar/", AplicarCambiosV3View.as_view(), name="likewize-v3-aplicar"),
    path("likewize/v3/tareas/<uuid:tarea_id>/no-mapeados/", get_unmapped_items, name="likewize-v3-unmapped"),

    path("", include(router.urls)),
    ]
