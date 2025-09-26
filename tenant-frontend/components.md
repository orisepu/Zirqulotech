# Zirqulo — Frontend Components Catalog

> **Estado:** v1 · Ruta base: `src/components` · Objetivo: onboarding rápido y reutilización

## 0) Convenciones (propuesta)

* **Naming**: archivos y componentes en **PascalCase** (`ChipEstado.tsx`), carpetas por **feature** y subcarpetas `components/`, `hooks/`, `api/`, `types/`.
* **Barrels**: `index.ts` para exportar públicos por carpeta.
* **Props**: tipado `Props` por componente, evitar `any`, documentar props requeridas/opcionales.
* **Estados vacíos/errores**: patrón común (`EmptyState`, `ErrorState`).
* **Etiquetas de madurez**: `[alpha]`, `[beta]`, `[stable]` en el listado.

---

## 1) Providers y contexto

* `ReactQueryProvider.tsx` — QueryClientProvider para React Query.
* `ToasterProvider.tsx` — registro global de `react-toastify`.
* `ReactQueryDevtoolsClient.tsx` — Devtools en cliente.

## 2) Layout y shells

* `layout/GeneralLayout.tsx` — layout base con `DashboardShell` y chat principal.
* `layout/DashboardShell.tsx` — app bar, navegación y contenido.
* `layout/LayoutInterno.tsx`, `layout/LayoutInternoShell.tsx` — shells para vistas protegidas.
* `layout/ManagerLayout.tsx` — controles extra para managers.
* `layout/DashboardLayoutCliente.tsx` — layout para vistas detalladas de cliente.

## 3) Navegación y búsqueda

* `BreadcrumbsExplorador.tsx` — breadcrumbs dinámicos por árbol de rutas.
* `BuscadorUniversal.tsx` — consulta `/api/busqueda-global/` y enruta a clientes/dispositivos/oportunidades.

## 4) Chat y soporte

* `chat/ChatPrincipal.tsx` — selecciona chat según rol.
* `chat/ChatConSoporteContextual.tsx` — chat por oportunidad.
* `chat/ChatConTenants.tsx` — panel para personal interno multi-tenant.
* `chat/ChatConSoporte.tsx` — wrapper de conversaciones de soporte.

## 5) Notificaciones

* `notificaciones/NotificacionesBell.tsx` — campana con contador y menú.

## 6) Inputs y utilidades UI

* `inputs/ValidatingTextField.tsx` — `TextField` con validaciones declarativas.
* `ui/CardHeaderWithToggle.tsx` — cabeceras con plegado.
* `EllipsisTooltip.tsx` — tooltip en truncado.
* `HtmlEditor.tsx` — editor rich text (CKEditor).

## 7) Formularios de clientes

* `formularios/Clientes/FormularioClientes.tsx` — formulario multipaso crear/editar.
* `formularios/Clientes/TipoClienteStep.tsx` — tipo (empresa/autónomo/particular) y canal.
* `formularios/Clientes/ComercialStepCliente.tsx` — datos comerciales y contacto.
* `formularios/Clientes/FinancieroStepCliente.tsx` — responsables de pago.
* `formularios/Clientes/DireccionStep.tsx` — dirección fiscal.
* `formularios/Clientes/SectorStepCliente.tsx` — selección de vertical/sector.

## 8) Formularios de dispositivos y valoraciones

* `formularios/dispositivos/FormularioValoracionOportunidad.tsx` — valoración rápida en creación de oportunidad.
* `formularios/dispositivos/FormularioAuditoriaDispositivo.tsx` — auditoría tras recepción.
* `formularios/dispositivos/PasoDatosBasicos.tsx` — modelo, IMEI, etc.
* `formularios/dispositivos/PasoEstadoDispositivo.tsx` — estado funcional/estético.
* `formularios/dispositivos/PasoEstetica.tsx` — estética exterior.
* `formularios/dispositivos/PasoValoracion.tsx` — precios y resultado.
* `formularios/dispositivos/DemoViewer.tsx` — demo con datos ficticios.

## 9) Valoraciones standalone

* `FormularioValoracion.tsx` — valoración genérica fuera del wizard.
* `FormularioValoracionOportunidad.tsx` — versión inline para oportunidades activas.
* `FormularioValoracionCompleta.tsx` — flujo completo de valoración.

## 10) Grading especializado

* `grading/CuestionarioComercialIphone.tsx` — cuestionario específico iPhone (comercial).

## 11) Oportunidades (detalle y gestión)

* `OportunidadForm.tsx` — crear/editar oportunidades.
* `OportunidadDetalleBase.tsx` — tabs, paneles, callbacks.
* `OportunidadDetallePageManager.tsx` — variante para managers.
* `OportunidadDetallePageGlobal.tsx` — versión cross-tenant (staff interno).
* `oportunidades/CabeceraOportunidad.tsx` — estado, acciones, oferta/logística.
* `oportunidades/HistorialPanel.tsx` — timeline de eventos.
* `oportunidades/ComentariosPanel.tsx` — comentarios colaborativos.
* `oportunidades/TabsOportunidad.tsx` — tabs (datos, dispositivos, histórico, chat...).
* `DatosRecogida.tsx` — gestión logística/recogida.
* `CambioEstadoChipSelector.tsx` — selector de estado por chips con reglas.
* `CrearLote.tsx` — asistente para lotes logísticos.

## 12) Listados y tablas

* `OportunidadesTableV2.tsx` — tabla con TanStack y filtros.
* `TablaReactiva2.tsx` — genérica reactiva configurable.
* `tablacolumnas.tsx`, `TablaColumnas2.tsx` — helpers de columnas.

## 13) Clientes (vistas detalladas)

* `clientes/FichaCliente.tsx` — ficha con datos, KPIs y acciones.
* `clientes/OportunidadesCard.tsx` — tarjeta de oportunidades del cliente.
* `clientes/ComentariosCard.tsx` — historial y formulario inline.
* `clientes/EditarClienteDialog.tsx` — diálogo de edición de cliente.

## 14) Dashboards y KPIs

* `dashboards/DashboardAdmin.tsx` — visión global cross-tenant (staff).
* `dashboards/DashboardManager.tsx` — dashboard para managers.
* `dashboards/DashboardEmpleado.tsx` — resumen para agentes comerciales.
* `dashboards/DashboardInterno.tsx` — panel interno.
* `dashboards/pipelineQueso.tsx` — embudo/pipeline.
* `dashboards/TopProductosChart.tsx` — top productos.
* `ResumenPorTienda.tsx` — objetivos vs resultados por tienda.
* `EstadoMinimoFilter.tsx`, `GranularidadFilter.tsx`, `DateRangeFilter.tsx` — filtros comunes.

## 15) Gráficos individuales

* `GraficoPorTienda.tsx` — barras/serie por tienda.
* `GraficoPorUsuario.tsx` — ranking/series por usuario.
* `GraficoBarrasHorizontales.tsx` — genérico horizontal.
* `GraficoEstadoPipeline.tsx` — pipeline por estados.
* `GraficoRankingProductosDonut.tsx` — donut ranking.
* `GraficoRechazosDonut.tsx` — donut rechazos.
* `Sparkline.tsx` — micro‑tendencias.

## 16) Contratos y flujo B2C

* `contratos/AdminB2CPanel.tsx` — administración de contratos (KYC/estados).
* `contratos/PartnerCreateMarcoPanel.tsx` — crear contratos marco desde oportunidades B2C.
* `contratos/OpportunityActaPanel.tsx` — actas por oportunidad.
* `contratos/BotonContratoB2C.tsx` — abre flujo de firma B2C.
* `contratos/BotonGenerarContratoTenant.tsx` — contratos desde tenant.
* `contratos/cameraDNI.tsx` — captura de DNI con cámara.

## 17) Documentos y exportes

* `pdf/OfertaPDFDocument.tsx` — plantilla React‑PDF de ofertas.
* `etiquetas/etiqueta-terminal.tsx` — plantilla de etiqueta logística.

## 18) Autenticación y acceso

* `LoginForm.tsx` — login con selección de empresa y credenciales.

---

## 19) Propuestas de normalización / refactor leve

* **Typos/nombres**: `FormularioValoracionCompleta.tsx` (en lugar de *FromularioValoracioncompleta*), `OportunidadesTableV2.tsx` (capitalizar V2), `CambioEstadoChipSelector.tsx` (nombre consistente y descriptivo).
* **Ubicación**: mover `DatosRecogida.tsx` a `oportunidades/` si está fuera.
* **Barrels**: añadir `index.ts` en `oportunidades/`, `clientes/`, `dashboards/`.
* **Estados UI**: crear `components/ui/EmptyState.tsx` y `ErrorState.tsx` y usarlos transversalmente.

## 20) Componentes utilitarios sugeridos (añadir)

* `ui/ChipEstado.tsx` — chip con color/ícono según estado canónico.
* `tables/DataTable.tsx` — wrapper de TanStack con paginación, orden y columnas dinámicas.
* `hooks/usePaginatedList.ts` — hook base para listados paginados con React Query.

## 21) TODOs

* Marcar componentes con `[alpha|beta|stable]`.
* Añadir README corto por carpeta con ejemplos de uso.
* Documentar dependencias entre componentes (diagrama ligero).

