---
title: Arquitectura Zirqulo — Mapa Mental Visual
tags: [arquitectura, mapa-mental, tecnico, multi-tenant, diagrams]
fecha: 2025-10-04
tipo: mapa-mental
---

# Arquitectura Zirqulo — Mapa Mental Visual

> **Visualización completa de la plataforma multi-tenant para recompra de dispositivos**
>
> Este documento presenta la arquitectura de Zirqulo de forma visual, usando diagramas Mermaid para facilitar la comprensión del sistema completo.

---

## 🎯 Visión General

```mermaid
mindmap
  root((Zirqulo
    Partners))
    Frontend
      Next.js 15
      React 19
      MUI 7
      TanStack Query
    Backend
      Django 5
      DRF
      Channels
      PostgreSQL
    Multi-Tenant
      Schemas separados
      Aislamiento de datos
      RBAC
    Integraciones
      Likewize
      BackMarket
      GeoLite2
```

---

## 🏗️ Arquitectura de Alto Nivel

```mermaid
graph TB
    subgraph "🌐 Cliente (Browser)"
        UI[Interface de Usuario<br/>Next.js 15 + React 19]
    end

    subgraph "⚡ Frontend Layer"
        NEXTJS[Next.js App Router<br/>Turbopack]
        MUI[MUI 7 Components<br/>Custom Theme]
        TANSTACK[TanStack Query<br/>Estado del Servidor]
    end

    subgraph "🔌 API Layer"
        NGINX[Nginx Reverse Proxy<br/>HTTPS/TLS]
        DRF[Django REST Framework<br/>200+ Endpoints]
        WS[WebSocket Server<br/>Django Channels]
    end

    subgraph "🧠 Backend Layer"
        DJANGO[Django 5<br/>Multi-Tenant]
        SERVICES[Servicios de Negocio]
        TASKS[Celery/Tasks<br/>Procesos Asíncronos]
    end

    subgraph "💾 Capa de Datos"
        POSTGRES[(PostgreSQL<br/>Multi-Schema)]
        REDIS[(Redis<br/>Cache + WS)]
        MEDIA[Media Storage<br/>Archivos + PDFs]
    end

    subgraph "🔗 Integraciones Externas"
        LIKEWIZE[Likewize API<br/>Precios B2B]
        BACKMARKET[BackMarket API<br/>Precios B2C]
        GEOLITE[GeoLite2<br/>Seguridad Geolocalizada]
    end

    UI --> NEXTJS
    NEXTJS --> MUI
    NEXTJS --> TANSTACK
    TANSTACK --> NGINX

    NGINX --> DRF
    NGINX --> WS

    DRF --> DJANGO
    WS --> DJANGO

    DJANGO --> SERVICES
    DJANGO --> TASKS

    SERVICES --> POSTGRES
    SERVICES --> REDIS
    SERVICES --> MEDIA

    TASKS --> LIKEWIZE
    TASKS --> BACKMARKET
    DJANGO --> GEOLITE

    style UI fill:#e3f2fd
    style POSTGRES fill:#c8e6c9
    style REDIS fill:#ffccbc
    style DJANGO fill:#fff9c4
```

---

## 🏢 Arquitectura Multi-Tenant

```mermaid
graph LR
    subgraph "🌐 Acceso Usuario"
        USER1[Ana - Partner XYZ]
        USER2[Luis - Partner ABC]
        ADMIN[Admin - Progeek]
    end

    subgraph "🔐 Autenticación"
        JWT[JWT Token<br/>+ X-Tenant Header]
    end

    subgraph "📊 PostgreSQL Multi-Schema"
        PUBLIC[(Schema: public<br/>- Usuarios<br/>- Tenants<br/>- Configuración)]
        SCHEMA_XYZ[(Schema: partner_xyz<br/>- Clientes<br/>- Oportunidades<br/>- Dispositivos<br/>- Documentos)]
        SCHEMA_ABC[(Schema: partner_abc<br/>- Clientes<br/>- Oportunidades<br/>- Dispositivos<br/>- Documentos)]
    end

    USER1 --> JWT
    USER2 --> JWT
    ADMIN --> JWT

    JWT -->|X-Tenant: xyz| SCHEMA_XYZ
    JWT -->|X-Tenant: abc| SCHEMA_ABC
    JWT -->|Admin Global| PUBLIC

    PUBLIC -.->|Metadata| SCHEMA_XYZ
    PUBLIC -.->|Metadata| SCHEMA_ABC

    style SCHEMA_XYZ fill:#c8e6c9
    style SCHEMA_ABC fill:#ffccbc
    style PUBLIC fill:#e1bee7
```

> [!info] Separación Física
> Cada partner tiene un schema completamente aislado en PostgreSQL. Es **imposible** el acceso cruzado entre partners a nivel de base de datos.

---

## 🔄 Flujo de Autenticación

```mermaid
sequenceDiagram
    participant U as Usuario (Ana)
    participant F as Frontend
    participant N as Nginx
    participant D as Django API
    participant P as PostgreSQL
    participant G as GeoLite2

    U->>F: 1. Login<br/>(email, password, tenant)
    F->>N: 2. POST /api/token/
    N->>D: 3. Proxy request
    D->>P: 4. Verificar usuario<br/>(schema: public)
    P-->>D: 5. Usuario válido
    D->>G: 6. Verificar ubicación<br/>(IP geolocalización)
    G-->>D: 7. Ubicación permitida
    D->>D: 8. Generar JWT Token<br/>(incluye tenant_id)
    D-->>N: 9. {access, refresh}<br/>+ tenant metadata
    N-->>F: 10. Token response
    F->>F: 11. Guardar en localStorage
    F->>U: 12. Redirect a Dashboard

    Note over F,D: Todas las requests posteriores<br/>incluyen X-Tenant header
```

---

## 📱 Flujo Completo de Oportunidad

```mermaid
graph TD
    START[Cliente llega a tienda] --> VALORATION[Valoración de dispositivo]
    VALORATION --> GRADING{Sistema de Grading}

    GRADING -->|A+/A/B| OFFER[Generar oferta]
    GRADING -->|C/D| REJECT[Rechazar - No apto]

    OFFER --> ACCEPT{¿Cliente acepta?}

    ACCEPT -->|Sí| CONTRACT[Crear contrato B2C]
    ACCEPT -->|No| NEGOTIATE[Nueva oferta]

    NEGOTIATE --> ACCEPT

    CONTRACT --> KYC[Verificación KYC<br/>DNI + OTP]
    KYC --> LOGISTICS[Programar recogida]
    LOGISTICS --> TRANSIT[Dispositivo en tránsito]
    TRANSIT --> RECEIVED[Dispositivo recibido]
    RECEIVED --> AUDIT[Auditoría física]

    AUDIT --> MATCH{¿Coincide<br/>valoración?}

    MATCH -->|Sí| PAYMENT[Procesar pago]
    MATCH -->|No| COUNTEROFFER[Contraoferta]

    COUNTEROFFER --> ACCEPT2{¿Cliente acepta?}
    ACCEPT2 -->|Sí| PAYMENT
    ACCEPT2 -->|No| RETURN[Devolver dispositivo]

    PAYMENT --> COMMISSION[Calcular comisión<br/>para partner]
    COMMISSION --> END[Operación completada]

    style START fill:#e3f2fd
    style END fill:#c8e6c9
    style REJECT fill:#ffcdd2
    style RETURN fill:#ffcdd2
    style PAYMENT fill:#fff9c4
```

---

## 🔐 Sistema de Permisos (RBAC)

```mermaid
graph TD
    subgraph "Roles"
        SUPER[Superadmin<br/>Progeek Staff]
        MANAGER[Manager<br/>Partner Admin]
        EMPLOYEE[Empleado<br/>Vendedor/Tienda]
        SUPPORT[Soporte<br/>Atención al Cliente]
    end

    subgraph "Permisos - Oportunidades"
        OP_CRUD_ALL[CRUD Todas<br/>Cross-tenant]
        OP_CRUD_TENANT[CRUD Tenant]
        OP_CRU_TIENDA[CRU Tienda]
        OP_READ_ALL[Read Todas]
    end

    subgraph "Permisos - Dispositivos"
        DEV_CRUD_ALL[CRUD Todos]
        DEV_CRUD_TENANT[CRUD Tenant]
        DEV_CRU_TIENDA[CRU Tienda]
        DEV_READ[Read Only]
    end

    subgraph "Permisos - Precios"
        PRICE_CRUD[CRUD Global]
        PRICE_READ_TENANT[Read Tenant]
        PRICE_READ[Read Only]
    end

    SUPER --> OP_CRUD_ALL
    SUPER --> DEV_CRUD_ALL
    SUPER --> PRICE_CRUD

    MANAGER --> OP_CRUD_TENANT
    MANAGER --> DEV_CRUD_TENANT
    MANAGER --> PRICE_READ_TENANT

    EMPLOYEE --> OP_CRU_TIENDA
    EMPLOYEE --> DEV_CRU_TIENDA
    EMPLOYEE --> PRICE_READ

    SUPPORT --> OP_READ_ALL
    SUPPORT --> DEV_READ
    SUPPORT --> PRICE_READ

    style SUPER fill:#e1bee7
    style MANAGER fill:#c5e1a5
    style EMPLOYEE fill:#ffccbc
    style SUPPORT fill:#b3e5fc
```

---

## 💰 Pipeline de Precios

```mermaid
graph LR
    subgraph "Fuentes Externas"
        LIK[Likewize API<br/>B2B Pricing]
        BM[BackMarket API<br/>B2C Pricing]
    end

    subgraph "Staging"
        STAGE[(Staging DB<br/>Precios temporales)]
    end

    subgraph "Diff & Review"
        DIFF[Generador de Diff<br/>Comparación vs actual]
        REVIEW{Revisión Manual<br/>Aprobar/Rechazar}
    end

    subgraph "Producción"
        PROD[(Precios Productivos<br/>Por Tenant)]
        HISTORY[(Historial de Cambios<br/>Auditoría)]
    end

    LIK -->|Ingestión| STAGE
    BM -->|Ingestión| STAGE

    STAGE --> DIFF
    DIFF --> REVIEW

    REVIEW -->|✅ Aprobar| PROD
    REVIEW -->|❌ Rechazar| STAGE

    PROD --> HISTORY

    style STAGE fill:#fff9c4
    style REVIEW fill:#ffccbc
    style PROD fill:#c8e6c9
    style HISTORY fill:#e1bee7
```

> [!tip] Trazabilidad Total
> Cada cambio de precios queda registrado con timestamp, usuario, y diff completo para auditoría.

---

## 💬 Sistema de Chat en Tiempo Real

```mermaid
graph TB
    subgraph "Cliente"
        UI[Interface de Usuario<br/>Chat Widget]
    end

    subgraph "WebSocket Server"
        WS[Django Channels<br/>ASGI Server]
        CONSUMER[Chat Consumer<br/>Gestión de conexiones]
    end

    subgraph "Backend"
        CHAT_SERVICE[Chat Service<br/>Lógica de negocio]
        NOTIF_SERVICE[Notification Service<br/>Alertas]
    end

    subgraph "Capa de Datos"
        REDIS_WS[(Redis<br/>Channel Layer)]
        POSTGRES_CHAT[(PostgreSQL<br/>Mensajes persistidos)]
    end

    UI <-->|WebSocket| WS
    WS <--> CONSUMER
    CONSUMER <--> REDIS_WS
    CONSUMER --> CHAT_SERVICE
    CHAT_SERVICE --> POSTGRES_CHAT
    CHAT_SERVICE --> NOTIF_SERVICE
    NOTIF_SERVICE --> REDIS_WS

    style UI fill:#e3f2fd
    style REDIS_WS fill:#ffccbc
    style POSTGRES_CHAT fill:#c8e6c9
```

---

## 🧪 Arquitectura de Testing

```mermaid
graph TB
    subgraph "API Integration Tests (99)"
        TIER1[Tier 1 - Critical<br/>30 tests<br/>Auth, Tenants, CRM]
        TIER2[Tier 2 - Business<br/>42 tests<br/>Global Ops, Devices]
        HEALTH[Health Check<br/>27 tests<br/>200+ Endpoints]
    end

    subgraph "Frontend Unit Tests (70+)"
        LOGIC[Business Logic<br/>25+ tests<br/>Grading, Calculations]
        VALIDATORS[Spanish Validators<br/>35+ tests<br/>DNI, NIE, CIF, IMEI]
        HOOKS[Custom Hooks<br/>10+ tests<br/>TanStack Query]
        UTILS[Utilities<br/>10+ tests<br/>Format, ID, Navigation]
    end

    subgraph "CI/CD Pipeline"
        PRECOMMIT[Pre-commit<br/>test:critical<br/>2 min]
        PREPUSH[Pre-push<br/>test:frontend<br/>1 min]
        CICD[CI/CD Full<br/>test:full<br/>5 min]
    end

    TIER1 --> PRECOMMIT
    TIER2 --> CICD
    HEALTH --> CICD

    LOGIC --> PREPUSH
    VALIDATORS --> PREPUSH
    HOOKS --> CICD
    UTILS --> CICD

    PRECOMMIT --> CICD
    PREPUSH --> CICD

    style PRECOMMIT fill:#c8e6c9
    style PREPUSH fill:#fff9c4
    style CICD fill:#e1bee7
```

---

## 🔒 Seguridad Multi-Capa

```mermaid
graph TB
    subgraph "Capa 1: Autenticación"
        JWT_AUTH[JWT Tokens<br/>Firma Digital]
        REFRESH[Refresh Automático<br/>24h expiry]
    end

    subgraph "Capa 2: Ubicación (GeoLite2)"
        GEO_DETECT[Detección de IP]
        GEO_ALERT[Alertas por<br/>Ubicación Inusual]
        GEO_BLOCK[Bloqueo de<br/>Viajes Imposibles]
    end

    subgraph "Capa 3: Control de Acceso"
        RBAC_CHECK[Verificación RBAC]
        TENANT_CHECK[Validación de Tenant]
        PERMISSION_CHECK[Validación de Permisos]
    end

    subgraph "Capa 4: Cifrado"
        HTTPS[HTTPS/TLS 1.3]
        DB_ENCRYPT[Cifrado de Datos Sensibles]
        PASSWORD_HASH[Hash de Contraseñas<br/>bcrypt/argon2]
    end

    subgraph "Capa 5: Auditoría"
        LOGS[Logs Inmutables]
        HISTORY[Historial de Cambios]
        ALERTS[Sistema de Alertas]
    end

    JWT_AUTH --> GEO_DETECT
    REFRESH --> GEO_DETECT

    GEO_DETECT --> GEO_ALERT
    GEO_DETECT --> GEO_BLOCK

    GEO_ALERT --> RBAC_CHECK
    GEO_BLOCK --> RBAC_CHECK

    RBAC_CHECK --> TENANT_CHECK
    TENANT_CHECK --> PERMISSION_CHECK

    PERMISSION_CHECK --> HTTPS
    HTTPS --> DB_ENCRYPT
    HTTPS --> PASSWORD_HASH

    DB_ENCRYPT --> LOGS
    PASSWORD_HASH --> LOGS

    LOGS --> HISTORY
    LOGS --> ALERTS

    style JWT_AUTH fill:#e1bee7
    style GEO_DETECT fill:#ffccbc
    style RBAC_CHECK fill:#fff9c4
    style HTTPS fill:#c8e6c9
    style LOGS fill:#e3f2fd
```

---

## 📊 Stack Tecnológico Completo

```mermaid
graph LR
    subgraph "Frontend"
        NEXT[Next.js 15<br/>App Router + Turbopack]
        REACT[React 19<br/>Functional Components]
        MUI_COMP[MUI 7<br/>Design System]
        TANSTACK_Q[TanStack Query<br/>Server State]
        TS[TypeScript<br/>Strict Mode]
    end

    subgraph "Backend"
        DJANGO_CORE[Django 5<br/>Multi-Tenant]
        DRF_API[Django REST Framework<br/>200+ Endpoints]
        CHANNELS[Django Channels<br/>WebSocket ASGI]
        CELERY[Celery<br/>Async Tasks]
    end

    subgraph "Base de Datos"
        PG[PostgreSQL 14+<br/>Multi-Schema]
        REDIS_CACHE[Redis<br/>Cache + Channel Layer]
    end

    subgraph "Testing"
        JEST[Jest<br/>Test Runner]
        RTL[React Testing Library<br/>Component Tests]
        PYTEST[Pytest<br/>Backend Tests]
    end

    subgraph "DevOps"
        PM2_PROC[PM2<br/>Process Manager]
        NGINX_PROXY[Nginx<br/>Reverse Proxy]
        DOCKER[Docker<br/>Containerization]
    end

    NEXT --> REACT
    REACT --> MUI_COMP
    REACT --> TANSTACK_Q
    NEXT --> TS

    DJANGO_CORE --> DRF_API
    DJANGO_CORE --> CHANNELS
    DJANGO_CORE --> CELERY

    DRF_API --> PG
    CHANNELS --> REDIS_CACHE

    REACT --> JEST
    REACT --> RTL
    DJANGO_CORE --> PYTEST

    NEXT --> PM2_PROC
    DJANGO_CORE --> PM2_PROC
    PM2_PROC --> NGINX_PROXY
    NGINX_PROXY --> DOCKER

    style NEXT fill:#000000,color:#fff
    style DJANGO_CORE fill:#092e20,color:#fff
    style PG fill:#336791,color:#fff
    style REDIS_CACHE fill:#dc382d,color:#fff
```

---

## 🔄 Ciclo de Vida de Datos

```mermaid
stateDiagram-v2
    [*] --> Pendiente: Cliente solicita valoración

    Pendiente --> Aceptado: Oferta aceptada
    Pendiente --> Cancelado: Cliente cancela

    Aceptado --> RecogidaSolicitada: Programar logística
    RecogidaSolicitada --> RecogidaGenerada: Etiqueta creada
    RecogidaGenerada --> EnTransito: Dispositivo enviado
    EnTransito --> Recibido: Dispositivo llega

    Recibido --> CheckInOK: Inspección inicial OK
    CheckInOK --> EnRevision: Auditoría detallada

    EnRevision --> OfertaConfirmada: Valoración coincide
    EnRevision --> NuevaOferta: Valoración difiere

    NuevaOferta --> NuevaOfertaEnviada: Enviar contraoferta
    NuevaOfertaEnviada --> NuevaOfertaConfirmada: Cliente acepta
    NuevaOfertaEnviada --> Rechazada: Cliente rechaza

    OfertaConfirmada --> NuevoContrato: Generar contrato B2C
    NuevaOfertaConfirmada --> NuevoContrato

    NuevoContrato --> ContratoFirmado: Cliente firma KYC
    ContratoFirmado --> PendienteFactura: Solicitar factura
    PendienteFactura --> FacturaRecibida: Factura subida
    FacturaRecibida --> PendientePago: Procesar pago
    PendientePago --> Pagado: Pago completado

    Rechazada --> DevolucionIniciada: Iniciar devolución
    DevolucionIniciada --> EquipoEnviado: Envío a cliente
    EquipoEnviado --> RecibidoPorCliente: Cliente recibe

    Cancelado --> [*]
    Pagado --> [*]
    RecibidoPorCliente --> [*]
```

---

## 📈 KPIs y Data Contracts

```mermaid
graph TB
    subgraph "Fuentes de Datos"
        OPP[(Oportunidades)]
        DEV[(Dispositivos)]
        PAYMENTS[(Pagos)]
        HIST[(Historial)]
    end

    subgraph "Transformaciones"
        AGG[Agregaciones<br/>SQL/ORM]
        CALC[Cálculos de Negocio]
        FILL[Rellenar Huecos<br/>Series Continuas]
    end

    subgraph "KPIs"
        CONV[Conversión<br/>lead→pago]
        TICKET[Ticket Medio<br/>Σ valor / #ops]
        TIME[Tiempos<br/>p50/p90/p95]
        PIPELINE[Pipeline<br/>por estado]
        RANKING[Ranking<br/>Productos/Usuarios]
    end

    subgraph "Visualizaciones"
        CHARTS[Charts Dashboard]
        EXPORTS[Exportes CSV/Excel]
        WEBHOOKS[Webhooks Events]
    end

    OPP --> AGG
    DEV --> AGG
    PAYMENTS --> AGG
    HIST --> AGG

    AGG --> CALC
    CALC --> FILL

    FILL --> CONV
    FILL --> TICKET
    FILL --> TIME
    FILL --> PIPELINE
    FILL --> RANKING

    CONV --> CHARTS
    TICKET --> CHARTS
    TIME --> CHARTS
    PIPELINE --> CHARTS
    RANKING --> CHARTS

    CHARTS --> EXPORTS
    CHARTS --> WEBHOOKS

    style AGG fill:#fff9c4
    style CHARTS fill:#c8e6c9
```

---

## 🌍 Integraciones Externas

```mermaid
graph LR
    subgraph "Zirqulo Backend"
        PRICE_SERVICE[Price Service]
        GEO_SERVICE[Geo Security Service]
        PAYMENT_SERVICE[Payment Service]
    end

    subgraph "APIs Externas"
        LIKEWIZE_API[Likewize API<br/>Pricing B2B]
        BACKMARKET_API[BackMarket API<br/>Pricing B2C]
        GEOLITE2_DB[GeoLite2 DB<br/>Geolocalización]
        STRIPE_API[Stripe API<br/>Pagos]
    end

    PRICE_SERVICE -->|HTTP| LIKEWIZE_API
    PRICE_SERVICE -->|HTTP| BACKMARKET_API

    GEO_SERVICE -->|Local DB| GEOLITE2_DB

    PAYMENT_SERVICE -->|HTTPS| STRIPE_API

    LIKEWIZE_API -.->|Precios actualizados| PRICE_SERVICE
    BACKMARKET_API -.->|Precios actualizados| PRICE_SERVICE
    GEOLITE2_DB -.->|Ciudad, País| GEO_SERVICE
    STRIPE_API -.->|Confirmación pago| PAYMENT_SERVICE

    style LIKEWIZE_API fill:#e1bee7
    style BACKMARKET_API fill:#e1bee7
    style GEOLITE2_DB fill:#ffccbc
    style STRIPE_API fill:#c5e1a5
```

---

## 🎯 Componentes Frontend Clave

```mermaid
graph TB
    subgraph "Layout"
        LAYOUT[GeneralLayout<br/>Shell Principal]
        NAVBAR[Navbar<br/>Navegación]
        BREADCRUMB[Breadcrumbs<br/>Navegación contextual]
    end

    subgraph "Formularios"
        FORM_CLIENT[FormularioClientes<br/>Multi-paso Wizard]
        FORM_DEVICE[FormularioDispositivos<br/>Valoración]
        FORM_AUDIT[FormularioAuditoria<br/>Recepción]
    end

    subgraph "Dashboards"
        DASH_MANAGER[DashboardManager<br/>Métricas Manager]
        DASH_EMPLOYEE[DashboardEmpleado<br/>Personal KPIs]
        DASH_ADMIN[DashboardAdmin<br/>Cross-tenant]
    end

    subgraph "Tablas y Listas"
        TABLE_OPP[OportunidadesTable<br/>TanStack Table]
        TABLE_REACTIVE[TablaReactiva<br/>Genérica]
    end

    subgraph "Chat"
        CHAT_WIDGET[ChatWidget<br/>Tiempo Real]
        CHAT_SUPPORT[ChatSoporte<br/>Contextual]
    end

    LAYOUT --> NAVBAR
    LAYOUT --> BREADCRUMB

    NAVBAR --> DASH_MANAGER
    NAVBAR --> DASH_EMPLOYEE
    NAVBAR --> DASH_ADMIN

    DASH_MANAGER --> TABLE_OPP
    DASH_MANAGER --> CHAT_WIDGET

    TABLE_OPP --> FORM_CLIENT
    TABLE_OPP --> FORM_DEVICE
    TABLE_OPP --> FORM_AUDIT

    CHAT_WIDGET --> CHAT_SUPPORT

    style LAYOUT fill:#e3f2fd
    style FORM_CLIENT fill:#fff9c4
    style DASH_MANAGER fill:#c8e6c9
    style CHAT_WIDGET fill:#ffccbc
```

---

## 🗄️ Modelo de Datos Simplificado

```mermaid
erDiagram
    TENANT ||--o{ USER : "tiene"
    TENANT ||--o{ CLIENT : "gestiona"
    TENANT ||--o{ OPPORTUNITY : "crea"
    TENANT ||--o{ STORE : "posee"

    USER ||--o{ OPPORTUNITY : "crea"
    USER }o--|| STORE : "trabaja en"

    CLIENT ||--o{ OPPORTUNITY : "genera"

    OPPORTUNITY ||--o{ REAL_DEVICE : "contiene"
    OPPORTUNITY ||--o{ COMMENT : "tiene"
    OPPORTUNITY ||--o{ HISTORY : "registra"
    OPPORTUNITY ||--|| CONTRACT : "produce"

    REAL_DEVICE }o--|| MODEL : "es de"
    REAL_DEVICE }o--|| CAPACITY : "tiene"

    MODEL }o--|| BRAND : "pertenece a"

    CONTRACT ||--o{ DOCUMENT : "genera"

    TENANT {
        int id PK
        string schema_name UK
        string name
        json branding
        boolean active
    }

    USER {
        int id PK
        int tenant_id FK
        string email UK
        string role
        datetime last_login
    }

    CLIENT {
        int id PK
        string tipo_cliente
        string nombre
        string dni_cif
        string email
        string telefono
    }

    OPPORTUNITY {
        uuid id PK
        int client_id FK
        int user_id FK
        string estado
        decimal valor_total
        datetime created_at
    }

    REAL_DEVICE {
        int id PK
        uuid opportunity_id FK
        int model_id FK
        string imei
        string grading
        decimal precio_final
    }
```

---

## 🚀 Flujo de Deployment

```mermaid
graph TB
    subgraph "Desarrollo"
        DEV_CODE[Código Fuente<br/>Git Repository]
        DEV_TEST[Tests Locales]
    end

    subgraph "CI/CD"
        CI[GitHub Actions<br/>CI Pipeline]
        BUILD_FRONT[Build Frontend<br/>Next.js]
        BUILD_BACK[Test Backend<br/>Django]
        DOCKER_BUILD[Docker Build]
    end

    subgraph "Staging"
        STAGING_SERVER[Servidor Staging]
        STAGING_TEST[Tests E2E]
    end

    subgraph "Producción"
        PM2[PM2 Process Manager]
        NGINX_PROD[Nginx Load Balancer]
        APP_FRONT[Frontend Instances<br/>Next.js]
        APP_BACK[Backend Instances<br/>Django + Uvicorn]
        DB_PROD[(PostgreSQL<br/>Production)]
        REDIS_PROD[(Redis<br/>Production)]
    end

    DEV_CODE --> DEV_TEST
    DEV_TEST --> CI

    CI --> BUILD_FRONT
    CI --> BUILD_BACK
    BUILD_FRONT --> DOCKER_BUILD
    BUILD_BACK --> DOCKER_BUILD

    DOCKER_BUILD --> STAGING_SERVER
    STAGING_SERVER --> STAGING_TEST

    STAGING_TEST -->|✅ Pass| PM2

    PM2 --> APP_FRONT
    PM2 --> APP_BACK

    APP_FRONT --> NGINX_PROD
    APP_BACK --> NGINX_PROD

    APP_BACK --> DB_PROD
    APP_BACK --> REDIS_PROD

    style DEV_CODE fill:#e3f2fd
    style CI fill:#fff9c4
    style STAGING_SERVER fill:#ffccbc
    style PM2 fill:#c8e6c9
```

---

## 📚 Referencias Adicionales

- [[../00-Indice|← Volver al Índice]]
- [[../03-Tecnico/Arquitectura-Detallada|Arquitectura Detallada]] — Profundización técnica
- [[../03-Tecnico/Stack-Tecnologico|Stack Tecnológico]] — Justificación de tecnologías
- [[../02-Comercial/Presentacion-Ejecutiva|Presentación Ejecutiva]] — Para stakeholders

---

> [!success] Arquitectura Escalable
> Esta arquitectura está diseñada para soportar cientos de partners con millones de operaciones, manteniendo aislamiento total de datos y rendimiento óptimo.

---

**Zirqulo Partners** — Arquitectura multi-tenant para recompra de dispositivos
