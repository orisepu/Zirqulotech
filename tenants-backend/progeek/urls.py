from django.urls import path, include,re_path
from rest_framework.routers import DefaultRouter
from .views import (
    LoteGlobalViewSet,busqueda_global,PipelineOportunidadesPublicAPIView,oportunidades_globales_por_estado,GuardarAuditoriaGlobalAPIView,PlantillaCorreoViewSet,
    dispositivos_de_oportunidad,CrearCompanyAPIView,detalle_oportunidad_completo,generar_pdf_oportunidad_global,SubirFacturaGlobalView,BorrarDispositivoGlobalAPIView,
    DispositivoAuditadoViewSet,OportunidadesGlobalesView,YoAPIView,ResumenGlobalOportunidadesAPIView,UserListAPIView,crear_dispositivo_global,cambiar_estado_oportunidad_global,
    verificar_credenciales, detalle_oportunidad_global,historial_oportunidad_global,listar_tenants,tenant_detail,descargar_documento_global,
    AdminB2CContratoViewSet,
)
from progeek.views_kyc import KycPdfPreviewView
from progeek.views_contratos import ContractRenderFullPreviewView,contrato_render_preview
from .views_legales import (
    LegalTemplateView, LegalTemplatePublishView, LegalTemplateVersionsView,
    LegalVariablesView, LegalRenderPreviewView
)
router = DefaultRouter()
router.register(r"lotes-globales", LoteGlobalViewSet, basename="lotes-globales")
router.register(r'dispositivos-auditados', DispositivoAuditadoViewSet)
router.register(r'plantillas-correo', PlantillaCorreoViewSet, basename='plantillascorreo')
router.register(r'contratos-b2c', AdminB2CContratoViewSet, basename='contratos-b2c')

urlpatterns = router.urls + [

    # 🔍 Búsqueda y autenticación
    path("busqueda-global/", busqueda_global),
    path("verificar-credenciales/", verificar_credenciales),
    path("yo/", YoAPIView.as_view(), name="yo"),

    # 🌍 Oportunidades globales
    path("oportunidades-globales/<str:tenant>/<uuid:id>/detalle-completo/", detalle_oportunidad_completo),
    path("oportunidades-globales/<str:tenant>/<uuid:uuid>/cambiar-estado/",cambiar_estado_oportunidad_global,name="cambiar_estado_oportunidad_global"),
    path("oportunidades-globales/<str:tenant>/<uuid:id>/", detalle_oportunidad_global),
    path("oportunidades-globales/<str:tenant>/<uuid:id>/historial/", historial_oportunidad_global),
    path("oportunidades-globales/filtrar/", oportunidades_globales_por_estado),
    path("oportunidades-globales/", OportunidadesGlobalesView.as_view(), name="oportunidades_globales"),

    # 📄 PDF, facturas y documentos
    path("oportunidades-globales/<str:tenant>/<uuid:pk>/generar-pdf/", generar_pdf_oportunidad_global, name="generar_pdf_oportunidad_global"),
    path("documentos/<str:tenant>/<int:documento_id>/descargar/", descargar_documento_global),
    path("facturas/<str:tenant>/subir/", SubirFacturaGlobalView.as_view()),

    # 📦 Dispositivos globales y lotes
    path("dispositivos-globales/<str:tenant>/", crear_dispositivo_global),
    path("dispositivos-globales/<str:tenant>/<int:dispositivo_id>/", BorrarDispositivoGlobalAPIView.as_view(), name='borrar_dispositivo_global'),
    path("lotes-globales/<str:tenant>/<int:pk>/dispositivos/", dispositivos_de_oportunidad),
    path("lotes-globales/<int:pk>/dispositivos/", dispositivos_de_oportunidad),  # legacy o acceso directo

    # 📊 Dashboard y resumen
    path("resumen-global/", ResumenGlobalOportunidadesAPIView.as_view(), name="resumen_global"),
    path("pipeline-oportunidades/", PipelineOportunidadesPublicAPIView.as_view()),

    # 🧑‍🤝‍🧑 Usuarios y tenants
    path("usuarios/", UserListAPIView.as_view(), name="api-usuarios-list"),
    path("tenants/", listar_tenants, name="listar_tenants"),
    path("tenants/<int:id>/", tenant_detail, name="tenant_detail"),
    path("crear-company/", CrearCompanyAPIView.as_view(), name="crear-company"),

    # 📦 Auditarias
    path("auditorias-globales/<str:tenant>/", GuardarAuditoriaGlobalAPIView.as_view(), name="guardar-auditoria-global"),

    # 📦 Ajustes
    path("ajustes/legales/plantilla/", LegalTemplateView.as_view()),
    path("ajustes/legales/plantilla/publicar", LegalTemplatePublishView.as_view()),
    path("ajustes/legales/plantilla/versiones", LegalTemplateVersionsView.as_view()),
    path("ajustes/legales/variables/", LegalVariablesView.as_view()),
    path("ajustes/legales/render-preview/", LegalRenderPreviewView.as_view()),
    path("contratos/render-full/", ContractRenderFullPreviewView.as_view()),
    re_path(r"^api/b2c/contratos/kyc/(?P<token>[0-9a-f\-]{36})/pdf-preview/$", KycPdfPreviewView()),
    path("contratos/render-preview/", contrato_render_preview),
]