---
title: Stack Tecnológico — Zirqulo
tags: [tecnico, stack, tecnologias, justificacion]
fecha: 2025-10-04
tipo: stack
---

# Stack Tecnológico de Zirqulo

> **Tecnologías elegidas y justificación de decisiones**

---

## 🎨 Frontend

### Next.js 15 (App Router + Turbopack)
**¿Por qué Next.js?**
- ✅ SSR (Server-Side Rendering) para SEO
- ✅ App Router moderno con layouts anidados
- ✅ Turbopack: builds 700x más rápidos que Webpack
- ✅ Optimización automática de imágenes
- ✅ API Routes integradas
- ✅ Comunidad masiva y actualizaciones frecuentes

**Alternativas consideradas:**
- ❌ Create React App: Obsoleto, sin SSR
- ⚠️ Vite: Excelente para SPAs simples, pero sin SSR nativo
- ⚠️ Remix: Prometedor, pero ecosistema más pequeño

---

### React 19
**¿Por qué React 19?**
- ✅ Server Components para performance
- ✅ Concurrent Rendering nativo
- ✅ Mejor gestión de estados
- ✅ Hooks optimizados (useTransition, useDeferredValue)

---

### MUI 7 (Material-UI)
**¿Por qué MUI?**
- ✅ Componentes profesionales out-of-the-box
- ✅ Sistema de temas robusto (branding por tenant)
- ✅ Accesibilidad (WCAG 2.1 AA)
- ✅ Mobile-first responsive
- ✅ Documentación excelente

**Alternativas consideradas:**
- ⚠️ Tailwind CSS: Excelente, pero más trabajo manual
- ⚠️ Chakra UI: Bueno, pero menos empresarial
- ❌ Ant Design: Estética china, menos customizable

---

### TanStack Query v5 (React Query)
**¿Por qué TanStack Query?**
- ✅ Server state management sin boilerplate
- ✅ Cache inteligente con invalidación
- ✅ Prefetching automático
- ✅ Mutaciones con optimistic updates
- ✅ DevTools integradas

**Alternativas consideradas:**
- ❌ Redux: Demasiado boilerplate para server state
- ⚠️ SWR: Bueno, pero menos features
- ❌ Apollo Client: Overkill (no usamos GraphQL)

---

### TypeScript (Strict Mode)
**¿Por qué TypeScript Strict?**
- ✅ Bugs detectados en tiempo de compilación
- ✅ Autocompletado y IntelliSense
- ✅ Refactors seguros
- ✅ Documentación implícita (tipos como contratos)

---

## ⚙️ Backend

### Django 5
**¿Por qué Django?**
- ✅ "Batteries included": ORM, Auth, Admin, Migrations
- ✅ Multi-tenant nativo con `django-tenants`
- ✅ Seguridad por defecto (CSRF, XSS, SQL Injection)
- ✅ Escalabilidad probada (Instagram, Pinterest)
- ✅ Admin panel out-of-the-box

**Alternativas consideradas:**
- ⚠️ FastAPI: Excelente para APIs puras, pero sin admin ni ORM robusto
- ⚠️ Node.js (Express/NestJS): Más trabajo manual, menos opinado
- ❌ Ruby on Rails: Menor ecosistema Python

---

### Django REST Framework (DRF)
**¿Por qué DRF?**
- ✅ Serializers potentes con validación
- ✅ Viewsets con CRUD automático
- ✅ Pagination, Filtering, Ordering built-in
- ✅ Browsable API (desarrollo más rápido)
- ✅ Permissions granulares

---

### Django Channels (ASGI)
**¿Por qué Channels?**
- ✅ WebSockets nativos en Django
- ✅ Redis channel layer para escalabilidad
- ✅ Consumidores asíncronos
- ✅ Integración perfecta con Django Auth

**Alternativas consideradas:**
- ⚠️ Socket.io: Tendríamos que separar backend en Node.js
- ❌ Polling: Ineficiente, más requests

---

### Celery (Async Tasks)
**¿Por qué Celery?**
- ✅ Tareas asíncronas robustas
- ✅ Scheduling (cron jobs)
- ✅ Reintentos automáticos
- ✅ Monitoreo con Flower

**Uso:**
- Ingesta de precios (Likewize, BackMarket)
- Generación de PDFs pesados
- Envío de emails masivos

---

## 💾 Base de Datos

### PostgreSQL 14+
**¿Por qué PostgreSQL?**
- ✅ **Schemas multi-tenant**: Separación física de datos
- ✅ ACID completo (transacciones seguras)
- ✅ JSON nativo (flexibilidad)
- ✅ Full-text search
- ✅ Performance excepcional (índices avanzados)
- ✅ Extensions (PostGIS, pg_trgm...)

**Alternativas consideradas:**
- ❌ MySQL: Sin soporte nativo de schemas multi-tenant
- ❌ MongoDB: NoSQL no es ideal para datos relacionales complejos
- ⚠️ SQLite: No soporta multi-tenant ni concurrencia alta

---

### Redis
**¿Por qué Redis?**
- ✅ Cache ultra-rápido (microsegundos)
- ✅ Channel layer para Django Channels
- ✅ Session storage
- ✅ Rate limiting

---

## 🧪 Testing

### Jest + React Testing Library
**Frontend:**
- ✅ Jest: Test runner estándar React
- ✅ RTL: Testing orientado a usuario (accesibilidad)
- ✅ axios-mock-adapter: Mocking de APIs estable

**170+ tests:**
- 99 tests de integración de API
- 70+ tests de lógica de negocio y validadores

---

### Pytest
**Backend:**
- ✅ Más pythonic que unittest
- ✅ Fixtures potentes
- ✅ Factory Boy para test data

---

## 🚀 DevOps

### PM2 (Process Manager)
**¿Por qué PM2?**
- ✅ Cluster mode (múltiples CPUs)
- ✅ Auto-restart en crash
- ✅ Logs centralizados
- ✅ Zero-downtime reload

Ver: [[../../PM2|Guía PM2]]

---

### Nginx (Reverse Proxy)
**¿Por qué Nginx?**
- ✅ Performance excepcional
- ✅ Load balancing
- ✅ HTTPS/TLS termination
- ✅ Static file serving eficiente

---

### Docker (Containerización)
**¿Por qué Docker?**
- ✅ Entorno consistente (dev/staging/prod)
- ✅ Aislamiento de dependencias
- ✅ Escalabilidad horizontal
- ✅ CI/CD simplificado

---

## 🔒 Seguridad

### GeoLite2 (Geolocalización)
**¿Por qué GeoLite2?**
- ✅ Gratuito (Creative Commons)
- ✅ Precisión ~70% a nivel ciudad
- ✅ Local (sin enviar datos a terceros)
- ✅ Actualizable mensualmente

Ver: [[../../SEGURIDAD|Guía de Seguridad]]

---

### JWT (JSON Web Tokens)
**¿Por qué JWT?**
- ✅ Stateless (escalable)
- ✅ Firma digital (imposible falsificar)
- ✅ Incluye claims (tenant, roles)
- ✅ Expiry automático

**Librería:** `djangorestframework-simplejwt`

---

## 📚 Documentación

### Obsidian (Docs)
**¿Por qué Obsidian?**
- ✅ Markdown puro (portable)
- ✅ Enlaces internos (`[[]]`)
- ✅ Diagramas Mermaid
- ✅ Búsqueda rápida
- ✅ Offline-first

---

## 🌍 Integraciones Externas

### Likewize API (Precios B2B)
- Proveedor de pricing para distribuidores

### BackMarket API (Precios B2C)
- Marketplace de dispositivos usados

### Stripe (Pagos) — Roadmap
- Procesamiento de pagos

---

## 📊 Comparativa Final

| Categoría | Tecnología Elegida | Alternativa Principal | ¿Por qué ganó? |
|-----------|-------------------|----------------------|----------------|
| Frontend Framework | Next.js 15 | Vite/Remix | SSR + Turbopack + Ecosistema |
| UI Library | MUI 7 | Tailwind CSS | Componentes empresariales |
| Server State | TanStack Query | Redux | Menos boilerplate |
| Backend Framework | Django 5 | FastAPI | Multi-tenant + Admin |
| Base de Datos | PostgreSQL | MySQL | Schemas nativos |
| Cache | Redis | Memcached | Versatilidad (cache + channels) |
| WebSocket | Django Channels | Socket.io | Integración Django |
| Process Manager | PM2 | Systemd | Cluster mode + logs |

---

**[[../00-Indice|← Volver al Índice]]** | **[[Deployment|Siguiente: Deployment →]]**

---

**Zirqulo Partners** — Stack tecnológico moderno y justificado
