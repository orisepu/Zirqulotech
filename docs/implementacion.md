# Zirqulo — Implementation Plan

> **Estado:** v1 · Última edición: *(rellenar)*

## 1) Estrategia de desarrollo

1. **Fundaciones multi‑tenant**: configurar `django-tenants`, semillas de tenants, testing con múltiples esquemas; clientes axios con cabecera `X‑Tenant` automática y rewrites en Next.
2. **Capa CRM y oportunidades**: endpoints DRF y vistas Next.js (React Query) para clientes, tiendas y pipeline.
3. **Valoraciones y documentos**: servicios de pricing (staging→diff→apply), generación de PDF, formularios wizard.
4. **Dashboards y KPIs**: consultas agregadas (SQL/ORM) con data contracts y visualizaciones.
5. **Chat y soporte**: Channels + Redis, consumers y UI tiempo real con notificaciones persistentes.
6. **Hardening y despliegue**: pruebas e2e, performance, empaquetado y guías de despliegue.

## 2) Estimación por fases

* **Fase 1 (2‑3 semanas)**: multi‑tenant base, autenticación, skeleton frontend.
* **Fase 2 (3‑4 semanas)**: CRM, oportunidades, flujo logística inicial.
* **Fase 3 (2 semanas)**: valoraciones avanzadas, documentos, exportaciones.
* **Fase 4 (2 semanas)**: dashboards, chat, QA integral y preparación de lanzamiento.

## 3) Lineamientos de código

**Frontend**

* Componentes funcionales, estado local mínimo; React Query para server‑state.
* Formularios desacoplados por steps (wizard) y validación isomórfica (frontend+backend).
* Estándar MUI 7, sistema de diseño consistente (tokens, spacing, tipografías).

**Backend**

* Servicios por dominio (CRM, oportunidades, logística, pricing); serializers explícitos.
* `select_related`/`prefetch_related`, paginación uniforme y filtros coherentes.
* Enrutado DRF con `ViewSet` + `@action` para operaciones específicas.

**Tipado y validación**

* TypeScript `strict` en front; type hints en Python; esquemas (pydantic/dataclasses) donde aporte.
* Validaciones duplicadas (UX+seguridad) y errores estandarizados (`detail`, `code`).

## 4) Buenas prácticas de código (ampliadas)

* **DRY y reutilización**

  * Extraer **hooks** reutilizables (`useApi`, `usePaginatedList`, `useDebouncedSearch`).
  * **Componentes UI atómicos** (Botón, Chip de estado, Tabla genérica con TanStack) y **composites** (DetalleOportunidad, RecepciónDispositivos).
  * **Utilidades puras** (formatEUR, dateRanges, buildQueryParams) y **mappers** de API↔UI.
* **Diseño de componentes**

  * Patrón **container/presenter**: lógica (container) separada del render (presenter).
  * Props mínimas y documentadas; evitar prop‑drilling con Context y hooks.
  * Carga progresiva (skeletons), manejo de vacíos/errores consistente.
* **Arquitectura front**

  * Carpeta por feature (`/features/oportunidades/...`) con `components/`, `hooks/`, `api/`, `types/`.
  * **React Query**: claves de caché normalizadas, invalidation tras mutaciones, `select` para derivar datos.
  * **MUI Theme** central con tokens (espaciado, colores, radios) y overrides documentados.
* **Arquitectura back**

  * Capa **service** por dominio, **repositorios** (queries complejas), vistas delgadas.
  * **Signals** solo para side‑effects esenciales; preferir servicios explícitos.
  * **Tasks** idempotentes (ingesta de precios), registros de ejecución y resumen (diff/apply).
* **API**

  * Versionado (`/api/v1/...`) cuando se estabilice.
  * **OpenAPI** auto‑generado y verificado en CI; códigos de error y paginación homogénea.
  * **Data contracts**: definiciones de KPIs con ejemplos de requests.
* **Rendimiento**

  * Evitar N+1; índices en campos de filtros/joins; `only/defer` para payloads grandes.
  * Front: memoization prudente, virtualización de tablas, división de código por rutas.
* **Accesibilidad (a11y)**

  * Roles ARIA, foco gestionado en diálogos, contraste y navegación por teclado.
* **I18n**

  * Mensajes y plantillas extractables; formatos de fecha/número por `locale`.
* **Seguridad**

  * Sanitizar input, límites de tamaño en uploads, rate‑limits en endpoints sensibles, CSRF donde corresponda.

## 5) Entregables técnicos

* Scripts de inicialización (`manage.py create_tenant`, seeds demo).
* Plantillas de infraestructura (docker‑compose con Postgres, Redis, app frontend/backend).
* Documentación REST (OpenAPI/Postman) y contratos front‑back.
* Guía de CI/CD y matrices de configuración por tenant.

## 6) Riesgos y mitigaciones

* **Complejidad multi‑tenant** → migraciones por esquema automatizadas; tests e2e multi‑tenant.
* **Rendimiento dashboards** → agregados materializados/precálculo por período, cache con invalidation.
* **Dependencias externas** → interfaces/puertos; reintentos y circuit‑breakers.
* **Gobierno de datos** → backups por schema; borrado selectivo (GDPR).

## 7) Calidad y CI/CD

* **Testing**

  * Backend: pytest con factories multi‑tenant; tests de servicios/serializers; tests de migraciones.
  * Frontend: React Testing Library para hooks/componentes críticos; MSW para mocks de API.
  * E2E (opcional): Playwright/Cypress por flujos clave (login, crear oportunidad, recibir dispositivo, generar PDF).
* **Gates de calidad**

  * Lint (ESLint + Ruff/Flake8), typecheck (tsc/mypy), cobertura mínima (ej. 70%).
  * **pre-commit**: formateo (Black/ruff format, Prettier), detect‑secrets.
  * **CODEOWNERS** y reglas de PR (2 reviews en módulos core).

## 8) Feature Flags & Config

* Flags por tenant para módulos (B2C, logística, BI, webhooks) y vistas experimentales.
* Variables de entorno tipadas; `.env` por entorno; configuración jerárquica `settings/` por flavor.

## 9) Checklist de entrega (Definition of Done)

* Endpoint/documentación/ejemplos actualizados.
* Tests unitarios + integración pasando y cubriendo reglas principales.
* Métricas/Logs para la funcionalidad nueva.
* Accesibilidad básica en UI y estados de carga/error.
* Permisos RBAC y auditoría de eventos.

## 10) Estructuras sugeridas

**Frontend (Next)**

```
src/
  features/
    oportunidades/
      components/
      hooks/
      api/
      types/
  components/ui/   # atómicos (Button, ChipEstado, DataTable)
  lib/             # utils (format, fetcher, storage)
  theme/
```

**Backend (Django)**

```
apps/
  crm/
  oportunidades/
  logistica/
  productos/
  legales/
  chat/
  common/          # utils, mixins, exceptions, pagination
services/          # orquestración cross-app
```

## 11) Métricas clave operativas (SLO/SLA)

* API p95 < 300 ms; WS uptime ≥ 99.5%.
* Ingesta de precios (staging→diff→apply) < 15 min/ejecución.
* PDF < 5 s; colas de precios D+0.

## 12) Roadmap de hardening

* Auditoría de permisos; fuzzing básico; revisión de índices/queries; stress de colas.
* Restauración de backups por tenant (prueba trimestral); simulacro DR.

