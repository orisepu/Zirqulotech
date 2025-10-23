from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views.oportunidad import ComentarioOportunidadViewSet
from .views import (
    # Oportunidad
    OportunidadViewSet,
    HistorialOportunidadViewSet,
    # Dispositivo
    DispositivoViewSet,
    DispositivoRealCreateAPIView,
    DispositivosRealesDeOportunidadView,
    DispositivosRealesDeOportunidadGlobalView,
    ConfirmarRecepcionGlobalView,
    borrar_dispositivo_real,
    crear_dispositivo_real_global,
    actualizar_dispositivo_real_global,
    # Cliente
    ClienteViewSet,
    ComentarioClienteViewSet,
    # Tienda
    TiendaViewSet,
    # Legal
    B2CContratoViewSet,
    B2CContratoFlagsAPIView,
    B2CContratoKycFinalizarAPIView,
    B2CContratoRenovarKYCApiView,
    B2CContratoReenviarKYCApiView,
    B2CContratoPdfPublicAPIView,
    B2CContratoPdfPreviewByToken,
    condiciones_b2c_pdf,
    LegalTemplateView,
    LegalTemplatePublishView,
    LegalTemplateVersionsView,
    LegalRenderPreviewView,
    # User
    UsuarioTenantViewSet,
    cambiar_contraseña,
    cambiar_contraseña_usuario,
    # KPIs
    ValorPorTiendaAPIView,
    mi_dashboard,
    kpi_comisiones_comercial,
    kpi_comisiones_store_manager,
    kpi_comisiones_manager,
    kpi_resumen_por_rol,
    # Documento
    SubirFacturaView,
    descargar_documento,
    ObjetivoViewSet,
    ObjetivoResumenAPIView,
)
# ELIMINADO: DispositivoPersonalizadoViewSet ahora está en productos (SHARED_APPS)
# from .views.dispositivo_personalizado import DispositivoPersonalizadoViewSet
from .views.contrato import generar_pdf_view, generar_pdf_oferta_formal, enviar_correo_oferta

from .views.dispositivo import (
    capacidades_por_modelo
)
from .kpis import (
    RankingProductosAPIView,
    TasaConversionAPIView,
    TiempoEntreEstadosAPIView,
    PipelineEstadosAPIView,
    RechazosPorEstadoAPIView,
    ValorPorUsuarioAPIView,
    ValorPorTiendaManagerAPIView,
)
from .kpimanager.dashboard_manager import DashboardManagerAPIView
from .views.dispositivo import ModeloViewSet, CapacidadViewSet
from .kpisutils import DashboardTotalPagadoAPIView
router = DefaultRouter()
router.register(r'dispositivos', DispositivoViewSet, basename='dispositivo')
# ELIMINADO: dispositivos-personalizados ahora está en productos/urls.py (SHARED_APPS)
# router.register(r'dispositivos-personalizados', DispositivoPersonalizadoViewSet, basename='dispositivo-personalizado')
router.register(r'modelos', ModeloViewSet)
router.register(r'capacidades', CapacidadViewSet)
router.register(r'clientes', ClienteViewSet, basename='cliente')
router.register(r'comentarios-cliente', ComentarioClienteViewSet, basename='comentariocliente')
router.register(r'oportunidades', OportunidadViewSet, basename='oportunidad')
router.register(r'comentarios-oportunidad', ComentarioOportunidadViewSet, basename='comentario-oportunidad')
router.register(r'usuarios-tenant', UsuarioTenantViewSet, basename='usuarios-tenant')
router.register(r'tiendas', TiendaViewSet, basename='tiendas')
router.register(r"b2c/contratos", B2CContratoViewSet, basename="b2c-contratos")
router.register(r"objetivos", ObjetivoViewSet, basename="objetivo")

urlpatterns = [
    # Rutas específicas de oportunidades ANTES del router para que tengan prioridad
    path("oportunidades/<uuid:id>/enviar-correo-oferta/", enviar_correo_oferta, name="enviar_correo_oferta"),
    path("oportunidades/<str:oportunidad_id>/historial/", HistorialOportunidadViewSet.as_view({'get': 'list'})),
    path("oportunidades/<int:pk>/generar-pdf/", generar_pdf_view),
    path("oportunidades/<int:pk>/generar-pdf-formal/", generar_pdf_oferta_formal),
    path("oportunidades/<str:oportunidad_id>/dispositivos-reales/", DispositivosRealesDeOportunidadView.as_view(), name="dispositivos-reales-de-oportunidad"),

    # Router (incluye oportunidades viewset)
    path('', include(router.urls)),

    # Otras rutas
    path('mi-dashboard/', mi_dashboard, name='mi-dashboard'),

    # Endpoints de comisiones por rol jerárquico
    path('kpi/comisiones/comercial/', kpi_comisiones_comercial, name='kpi-comisiones-comercial'),
    path('kpi/comisiones/store-manager/', kpi_comisiones_store_manager, name='kpi-comisiones-store-manager'),
    path('kpi/comisiones/manager/', kpi_comisiones_manager, name='kpi-comisiones-manager'),
    path('kpi/comisiones/resumen/', kpi_resumen_por_rol, name='kpi-comisiones-resumen'),
    path('cambiar-contraseña/', cambiar_contraseña, name='cambiar-contraseña'),
    path('cambiar-password/', cambiar_contraseña_usuario),
    path("oportunidades-globales/<str:schema>/<uuid:oportunidad_id>/confirmar-recepcion/", ConfirmarRecepcionGlobalView.as_view()),
    path("dashboard/valor-por-tienda/", ValorPorTiendaAPIView.as_view()),
    path("dashboard/valor-por-tienda-manager/", ValorPorTiendaManagerAPIView.as_view()),
    path("dashboard/valor-por-usuario/", ValorPorUsuarioAPIView.as_view()),
    path("dashboard/ranking-productos/", RankingProductosAPIView.as_view()),
    path("dashboard/tasa-conversion/", TasaConversionAPIView.as_view()),
    path("dashboard/tiempo-entre-estados/", TiempoEntreEstadosAPIView.as_view()),
    path("dashboard/estado-pipeline/", PipelineEstadosAPIView.as_view()),
    path("dashboard/rechazos-producto/", RechazosPorEstadoAPIView.as_view()),
    path("dashboard/manager/", DashboardManagerAPIView.as_view()),
    path("dashboard/total-pagado/", DashboardTotalPagadoAPIView.as_view(), name="dashboard-total-pagado"),
    path("b2c/contratos/kyc/<uuid:token>/flags/", B2CContratoFlagsAPIView.as_view(), name="b2c-kyc-flags"),
    path("b2c/contratos/kyc/<uuid:token>/finalizar/", B2CContratoKycFinalizarAPIView.as_view(), name="b2c-kyc-finalizar"),
    path("b2c/contratos/kyc/<int:pk>/renovar/", B2CContratoKycFinalizarAPIView.as_view(), name="b2c-kyc-renovar"),
    path("b2c/contratos/kyc/<int:pk>/reenviar-kyc/", B2CContratoReenviarKYCApiView.as_view(), name="b2c-kyc-reenviar"),
    path("b2c/contratos/pdf/<uuid:kyc_token>/", B2CContratoPdfPublicAPIView.as_view(), name="b2c-contrato-pdf-public"),
    path("b2c/contratos/kyc/<uuid:token>/pdf-preview/",B2CContratoPdfPreviewByToken.as_view(),name="b2c-contrato-pdf-preview"),
    path("facturas/subir/", SubirFacturaView.as_view(), name="subir-factura"),
    path("documentos/<int:documento_id>/descargar/", descargar_documento, name="descargar_documento"),
    path("dispositivos-reales/crear/", DispositivoRealCreateAPIView.as_view(), name="crear-dispositivo-real"),
    path("dispositivos-reales-globales/<str:tenant>/<uuid:oportunidad_id>/", DispositivosRealesDeOportunidadGlobalView.as_view()),
    path("dispositivos-reales-globales/<str:tenant>/crear/", crear_dispositivo_real_global),
    path("dispositivos-reales-globales/<str:tenant>/borrar/", borrar_dispositivo_real),
    path("dispositivos-reales-globales/<str:tenant>/editar/<int:id>/", actualizar_dispositivo_real_global),
    path('capacidades-por-modelo/', capacidades_por_modelo, name='capacidades-por-modelo'),
]
