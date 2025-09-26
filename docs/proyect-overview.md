# Zirqulo — Project Overview v2

## 1) Visión

Construir una plataforma **multi-tenant** para partners que centraliza el ciclo completo de oportunidades de recompra de dispositivos, con **instancias aisladas** (marca, flujos y legales por tenant) y **operación unificada**.

## 2) Problema

* **Precios (alta complejidad):** ingesta multi‑fuente (proveedores/marketplaces), normalización de modelos/capacidades/variantes regionales, **vigencias** y conflictos entre fuentes, factores por **estado** (excelente/muy bueno/bueno), **mínimos** y excepciones (p. ej. mmWave/JP). Necesitamos **staging → diff → apply** con trazabilidad y rollback.
* **Trámites legales y firma electrónica:** generación y **versionado de contratos** por tenant/país, **firma electrónica** (OTP/eIDAS‑ready), **sellado de tiempo** y registro de evidencias (IP, agente, hash del documento), gestión de **consentimientos** (KYC/marketing), **retención** y derecho al olvido (RGPD/LOPDGDD), auditoría exportable.
* **Coherencia operativa entre tenants:** cada partner exige reglas/plantillas distintas sin romper la consistencia global de datos y KPIs.

## 3) Propuesta de valor

* **White‑label por tenant**: branding, dominios, plantillas legales y flujos personalizados.
* **CRM unificado**: creación → auditoría → oferta/PDF → logística → pago.
* **Dashboards y reportes** en tiempo real para managers y administradores.
* **Chat contextual** por oportunidad, con historial y adjuntos.

## 4) Metas

1. **Onboarding acelerado:** alta de un tenant nuevo en **< 4 h** usando plantillas (branding, roles, modelos, legales).
2. **Automatización end‑to‑end del ciclo de oportunidad** (captación→pago) con auditoría de dispositivos y notificaciones.
3. **Visibilidad y comparabilidad**: KPIs consistentes por rol y tenant con data contracts y series continuas (relleno de huecos con 0).
4. **Cumplimiento legal**: 100% de contratos con **evidencias de firma** (OTP, hash, sello de tiempo, IP/UA) y **versionado** de plantillas por tenant/país; registro de **consentimientos** y **retención** conforme RGPD/LOPDGDD.
5. **Pipeline de precios confiable**: ingesta multi‑fuente con **staging → diff → apply** en **< 15 min** por ejecución; **cobertura ≥95%** de modelos activos por tenant; **rollback** probado mensualmente; trazabilidad 100% de cambios.
6. **SLA operativos**: API p95 **< 300 ms**, disponibilidad WS **≥99.5%**, generación de PDF **< 5 s**, colas de precios al día (**D+0**).

## 5) Alcance inicial (MVP)

* **Frontend**: Next.js 15 (App Router), React 19, MUI 7, React Query 5.
* **Backend**: Django 5 + DRF + PostgreSQL, `django-tenants`, Channels + Redis.
* **Integraciones internas**: PDFs de oferta, exportaciones, trazabilidad logística.
* **Acceso**: JWT + cabecera `X‑Tenant` y RBAC.

---

## 6) Arquitectura (alto nivel)

* **Separación por schema** (multi‑tenant lógico) + **RBAC** por rol.
* **Servicios**: API REST, WebSockets (chat/notifs), workers (tareas de precios, PDFs).
* **Cola**: Redis/Channels para chat y notificaciones; tareas programadas para ingestión de precios.
* **Storage**: ficheros (facturas/PDFs), logs estructurados; backups por tenant.

**Diagrama (texto):**

```
Frontends (tenant & admin)
   → API (DRF) / WS (Channels) → DB Postgres (schemas por tenant)
   → Workers (ingesta precios, PDFs, notifs) → Storage (media) / Email / Webhooks
```

---

## 7) Personalización por tenant

* **Branding**: logo, colores, dominios, textos legales.
* **Campos y flujos**: campos custom (oblig/opt), pasos opcionales, validaciones.
* **Plantillas**: emails, PDFs, cláusulas legales versionadas.
* **Feature flags**: módulos (B2C, logística propia, KYC avanzado, webhooks, BI export).
* **Catálogo de modelos**: activar/desactivar familias/modelos por tenant.

> **TODO:** Tabla de parámetros por tenant + defaults globales.

---

## 8) Seguridad & Cumplimiento

* **RBAC** (ver matriz abajo) + scopes por API.
* **Auditoría inmutable**: quién/cómo/cuándo; exportable.
* **Consentimientos** por evento (captación, KYC, marketing); **retención** por tipo.
* **Cifrado**: TLS end‑to‑end; opcional en reposo por tenant.
* **Backups/DR**: restauración puntual por tenant; registros de restauración.

---

## 9) Operación (SLA, observabilidad, DR)

* **SLOs iniciales**: API p95<300ms; WS conexión estable p99>99.5%; jobs de precios <15min.
* **Observabilidad**: logs estructurados, métricas (APM), trazas distribuidas; alerting (uptime, colas, errores).
* **DR**: RPO 1h / RTO 4h; pruebas de restauración trimestrales.

> **TODO:** Runbooks (errores frecuentes, cola atascada, timeouts PDF, etc.).

---

## 10) Datos & Analítica (data contracts)

* **Definiciones formales** de cada KPI: fuente, filtros, granularidad (día/semana/mes), timezone.
* **Export**: CSV/Excel bajo permisos; **Webhooks** de eventos (oportunidad/estado/pago).
* **Opcional**: conector a BI/Warehouse (vistas por tenant o “public” con filtros).

**Plantilla de data contract (ejemplo):**

| Métrica      | Definición                           | Fuente                    | Filtros             | Grano/Frecuencia |
| ------------ | ------------------------------------ | ------------------------- | ------------------- | ---------------- |
| Conversión   | `pagadas / oportunidades` en período | API oportunidades + pagos | estado≥oferta_final | día/semana/mes   |
| Tiempo resp. | p50/p90 desde creación→1ª respuesta  | historial estados         | por rol/tienda      | día              |
| Ticket medio | `Σ valor_pagado / #pagadas`          | pagos                     | tenant/tienda       | mes              |

> **TODO:** Completar catálogo de KPIs con fórmulas exactas.

---

## 11) Precios & Valoración (pipeline oficial)

* **Fuentes** (p.ej. proveedores, marketplaces): ingesta a **staging** → **diff** → **apply**.
* **Vigencias**: `valid_from/valid_to` por modelo/capacidad/estado.
* **Canales**: B2B/B2C con factores; **exclusiones de variantes** (mercado/región).
* **Trazabilidad**: tarea de actualización, logs y resumen de cambios por ejecución.

> **TODO:** Factores por estado (excelente/muy bueno/bueno) y política de mínimos.

---

## 12) Logística

* **Estados**: label generado → pickup programado → en tránsito → recibido.
* **Integraciones**: etiquetas, tracking, incidencias; **webhooks** entrantes/salientes.
* **SLA** por tramo y alertas de incumplimiento.

---

## 13) Chat & Notificaciones

* **Chat contextual** a oportunidad, menciones (@soporte), adjuntos.
* **Notificaciones**: in‑app + email por reglas (cambio estado, SLA, pagos).
* **Modo Focus** para soporte (sin navegación) + recepción WS en background.

---

## 14) Onboarding (Tenant Factory)

1. **Plantilla**: roles, tiendas, modelos activos, precios base, plantillas email/PDF.
2. **Asistente**: DNS, branding, textos legales/retención.
3. **Checklist**: usuarios iniciales, objetivos/KPIs, integraciones de logística/pagos.

---

## 15) KPIs — Definiciones contractuales

**Reglas globales**

* Valor económico: **Σ ****`DispositivoReal.precio_final`** (fallback 0.00).
* Comisión por defecto: **10%** (configurable por tenant).
* Fechas en TZ tenant; incluir semanas/días sin datos con **0** para continuidad.

**Listado inicial**

* **Conversión**: lead→oportunidad→oferta→aceptado→pagado (definir puntos de corte).
* **Tiempo medio de**: respuesta, recogida, auditoría, pago (p7/p15/p30).
* **Pipeline**: conteo/valor por estado, flags SLA.
* **Ranking productos**: por unidades/valor.
* **Rechazos**: por motivo/estado técnico.

---

## 16) Mapa de estados (canónico)

### 16.1 Lista canónica de estados

* **Pendiente**
* **Aceptado**
* **Cancelado**
* **Recogida solicitada**
* **Recogida generada**
* **En tránsito**
* **Recibido**
* **Check in OK**
* **En revisión**
* **Oferta confirmada**
* **Pendiente factura**
* **Factura recibida**
* **Pendiente de pago**
* **Pagado**
* **Nueva oferta**
* **Nueva oferta enviada**
* **Nueva oferta confirmada**
* **Rechazada**
* **Devolución iniciada**
* **Equipo enviado**
* **Recibido por el cliente**
* **Nuevo contrato**
* **Contrato firmado**

> **Nota:** "Nuevo contrato" y "Contrato firmado" aplican al flujo B2C (contratación) y pueden convivir con el pipeline estándar de recompra.

### 16.2 Propuesta de flujo principal (alto nivel)

```
Pendiente
  ├─▶ Aceptado
  │     └─▶ Recogida solicitada → Recogida generada → En tránsito → Recibido → Check in OK → En revisión
  │                                                                                                     ├─▶ Oferta confirmada ──┐
  │                                                                                                     │                      │
  │                                                                                                     │   (alternativa comercial)
  │                                                                                                     └─▶ Nueva oferta → Nueva oferta enviada → Nueva oferta confirmada ─┐
  │                                                                                                                                            └───────────────────────────────┘
  │                                                                                                                                (si no se acepta: ▶ Rechazada)
  │
  │  (una vez aceptada la oferta)
  │     └─▶ Pendiente factura → Factura recibida → Pendiente de pago → Pagado
  │
  └─▶ Cancelado (desde Pendiente o Aceptado)
```

### 16.3 Post‑venta / Devoluciones (opcional según caso)

```
Devolución iniciada → Equipo enviado → Recibido por el cliente
```

### 16.4 Contratación (B2C opcional)

```
Nuevo contrato → Contrato firmado
```

> **Ubicación típica:** puede iniciarse tras **Oferta confirmada** o **Nueva oferta confirmada** cuando el flujo B2C lo exige.

### 16.5 Normas de transición (resumen)

* **Transiciones válidas**: solo las indicadas arriba; los atajos deben justificarse y auditarse.
* **Permisos por rol**: quién puede ejecutar cada transición (ver RBAC).
* **Side‑effects**: notificaciones, sellos de tiempo, recálculo de KPIs, generación de documentos.
* **Estados terminales**: **Cancelado**, **Pagado**, **Rechazada** (salvo reapertura explícita con auditoría).

## 17) Matriz RBAC (resumen)

| Recurso \ Rol       | Superadmin    | Manager tenant   | Empleado        | Soporte     |
| ------------------- | ------------- | ---------------- | --------------- | ----------- |
| Oportunidades       | CRUD (todos)  | CRUD (su tenant) | CRU (su tienda) | R (todos)   |
| Estados             | Todos         | limitar a flujo  | limitar a flujo | R           |
| Dispositivos reales | CRUD          | CRUD             | CRU             | R           |
| Precios base        | CRUD (global) | R (tenant)       | R               | R           |
| Chat                | R/W (todos)   | R/W (tenant)     | R/W (tienda)    | R/W (todos) |
| Descargas/Export    | Global        | Tenant           | Tienda          | Global      |

> **TODO:** Llevar esto a permisos concretos de API (scopes/endpoints).

---

## 18) Roadmap

1. **MVP multi‑tenant**: auth, RBAC, oportunidades, estados, chat básico, auditoría mínima.
2. **Precios & Ofertas**: pipeline staging/diff/apply + vigencias y fuentes; PDF oferta.
3. **Logística & SLA**: tracking + notificaciones + panel pipeline logística.
4. **Dashboards**: KPIs con data contracts + export/webhooks.
5. **Tenant factory**: alta 1‑click + plantillas + seeds.

---

## 19) Glosario

* **Tenant**: instancia lógica aislada (schema) con configuración propia.
* **Oportunidad**: caso de recompra con estados y dispositivos asociados.
* **DispositivoReal**: dispositivo recibido/auditado con `precio_final`.
* **Data contract**: definición formal de un KPI/dato (cálculo, fuente, filtros).

---

###

