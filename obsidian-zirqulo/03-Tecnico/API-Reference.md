---
title: API Reference — Zirqulo
tags: [tecnico, api, endpoints, rest]
fecha: 2025-10-04
tipo: api-reference
---

# API Reference de Zirqulo

> **Referencia completa de endpoints (200+)**
>
> **Base URL:** `https://progeek.es/api/`
> **Auth:** JWT `Authorization: Bearer <token>`
> **Multi-tenant:** Header `X-Tenant: <schema>`

Para la lista completa y actualizada, consulta: [[../../docs/Api_Endpoints|API Endpoints Detallados]]

---

## 🔐 Autenticación

### POST `/api/token/`
Obtener token JWT

**Request:**
```json
{
  "email": "ana@tutienda.com",
  "password": "••••••••",
  "empresa": "tutienda"
}
```

**Response:**
```json
{
  "access": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "refresh": "eyJ0eXAiOiJKV1QiLCJhbGc...",
  "user": {
    "id": 1,
    "email": "ana@tutienda.com",
    "role": "employee",
    "tenant": {
      "id": 5,
      "schema": "tutienda",
      "name": "Tu Tienda S.L."
    }
  }
}
```

### POST `/api/token/refresh/`
Renovar token expirado

### GET `/api/yo/`
Información del usuario actual (incluye tenant y permisos)

---

## 🏢 Tenants

### GET `/api/tenants/`
Listar todos los tenants (solo superadmin)

### GET `/api/tenants/{id}/`
Detalle de un tenant

### GET `/api/tenants/by-schema/{schema}/`
Obtener tenant por schema slug

---

## 👥 Clientes (CRM)

### GET `/api/clientes/`
Listar clientes del tenant

**Query Params:**
- `tipo_cliente`: empresa|autonomo|particular
- `canal`: B2B|B2C
- `search`: búsqueda por nombre, DNI, email
- `pageIndex`: 0, 1, 2...
- `pageSize`: 10, 25, 50

**Response:**
```json
{
  "count": 150,
  "next": "/api/clientes/?pageIndex=2&pageSize=25",
  "previous": null,
  "results": [
    {
      "id": 12345,
      "uuid": "550e8400-e29b-41d4-a716-446655440000",
      "nombre": "Laura Martínez",
      "dni_cif": "45678912B",
      "email": "laura@example.com",
      "telefono": "612345678",
      "tipo_cliente": "particular",
      "created_at": "2025-10-01T10:30:00Z"
    }
  ]
}
```

### POST `/api/clientes/`
Crear nuevo cliente

### GET `/api/clientes/{id}/`
Detalle de cliente

### PATCH `/api/clientes/{id}/`
Actualizar cliente

### DELETE `/api/clientes/{id}/`
Eliminar cliente

---

## 📱 Oportunidades

### GET `/api/oportunidades/`
Listar oportunidades del tenant

**Query Params:**
- `estado`: pendiente|aceptado|en_transito|pagado...
- `cliente`: ID del cliente
- `fecha_inicio`: YYYY-MM-DD
- `fecha_fin`: YYYY-MM-DD
- `pageIndex`, `pageSize`

### POST `/api/oportunidades/`
Crear nueva oportunidad

**Request:**
```json
{
  "cliente_id": 12345,
  "tipo": "B2C",
  "dispositivos": [
    {
      "modelo_id": 67,
      "capacidad_id": 3,
      "imei": "354886090123456",
      "grado": "B"
    }
  ]
}
```

### GET `/api/oportunidades/{uuid}/`
Detalle de oportunidad

### PATCH `/api/oportunidades/{uuid}/`
Actualizar oportunidad

### GET `/api/oportunidades/{uuid}/historial/`
Historial de cambios de estado

### GET `/api/oportunidades/{uuid}/generar-pdf/`
Descargar PDF de oferta

### POST `/api/oportunidades/{uuid}/enviar-correo-oferta/`
Enviar oferta por email al cliente

---

## 🔧 Dispositivos

### GET `/api/dispositivos/`
Listar dispositivos

### GET `/api/modelos/`
Catálogo de modelos

**Response:**
```json
[
  {
    "id": 67,
    "marca": "Apple",
    "nombre": "iPhone 13 Pro",
    "tipo": "smartphone"
  }
]
```

### GET `/api/capacidades/`
Catálogo de capacidades

### GET `/api/capacidades-por-modelo/?modelo={id}`
Capacidades disponibles para un modelo

---

## 📊 Dashboards y KPIs

### GET `/api/mi-dashboard/`
Dashboard personal del usuario autenticado

**Response:**
```json
{
  "oportunidades_mes": 18,
  "valor_total": 7650.00,
  "comision_estimada": 765.00,
  "conversion": 0.22,
  "ticket_medio": 425.00
}
```

### GET `/api/dashboard/manager/`
Dashboard agregado para managers

**Query Params:**
- `fecha_inicio`: YYYY-MM-DD
- `fecha_fin`: YYYY-MM-DD
- `granularidad`: dia|semana|mes

### GET `/api/dashboard/valor-por-tienda/`
Valor de oportunidades agrupado por tienda

### GET `/api/dashboard/ranking-productos/`
Ranking de productos más vendidos

### GET `/api/dashboard/tasa-conversion/`
Tasa de conversión por funnel

---

## 🌍 Operaciones Globales (Staff Interno)

### GET `/api/oportunidades-globales/`
Listar oportunidades cross-tenant (superadmin)

**Query Params:**
- `schema`: Filtrar por tenant
- `estado`: Filtrar por estado
- `fecha_inicio`, `fecha_fin`

### GET `/api/oportunidades-globales/{schema}/{uuid}/`
Detalle de oportunidad de otro tenant

### POST `/api/oportunidades-globales/{schema}/{uuid}/cambiar-estado/`
Cambiar estado de oportunidad global

### GET `/api/busqueda-global/`
Búsqueda global cross-tenant

---

## 💬 Chat y Soporte

### POST `/api/chat/soporte/`
Crear o recuperar chat de soporte

**Request:**
```json
{
  "oportunidad_uuid": "550e8400-e29b-41d4-a716-446655440000"
}
```

**Response:**
```json
{
  "id": 42,
  "oportunidad": "550e8400-e29b-41d4-a716-446655440000",
  "estado": "abierto",
  "mensajes_no_leidos": 2
}
```

### GET `/api/chat/{id}/mensajes/`
Historial de mensajes

### POST `/api/chat/{id}/cerrar/`
Cerrar chat

### WS `/ws/chat/{chat_id}/`
Conexión WebSocket para chat en tiempo real

---

## 📝 Contratos B2C

### GET `/api/b2c/contratos/`
Listar contratos B2C

### POST `/api/b2c/contratos/`
Crear contrato B2C

### GET `/api/b2c/contratos/kyc/{token}/flags/`
Verificar estado de KYC por token (público)

### POST `/api/b2c/contratos/kyc/{token}/finalizar/`
Finalizar proceso KYC (firma electrónica)

### GET `/api/b2c/contratos/pdf/{token}/`
Descargar PDF del contrato (público)

---

## 💰 Precios

### POST `/api/precios/likewize/actualizar/`
Ingestar precios desde Likewize (staging)

### GET `/api/precios/likewize/tareas/{id}/diff/`
Ver diff de precios (staging vs producción)

### POST `/api/precios/likewize/tareas/{id}/aplicar/`
Aplicar cambios de precios

### GET `/api/valoraciones/iphone/comercial/`
Calcular valoración comercial de iPhone

**Query Params:**
- `modelo_id`: ID del modelo
- `capacidad_id`: ID de capacidad
- `grado`: A+|A|B|C|D
- `bateria_health`: 0-100
- `pantalla_estado`: OK|PIX|LINES|BURN
- `cristal_estado`: NONE|MICRO|VISIBLE|DEEP|CRACK

**Response:**
```json
{
  "precio_base": 420.00,
  "deducciones": {
    "bateria": -15.00,
    "pantalla": 0.00,
    "cristal": -10.00
  },
  "precio_final": 395.00,
  "grado_final": "B"
}
```

---

## 📄 Documentos

### POST `/api/facturas/subir/`
Subir factura de una oportunidad

**Request:** `multipart/form-data`
```
oportunidad_uuid: "550e8400-..."
archivo: [file]
```

### GET `/api/documentos/{id}/descargar/`
Descargar documento

---

## 🚨 Códigos de Error Estándar

| Código | Significado |
|--------|-------------|
| 200 | OK |
| 201 | Created |
| 204 | No Content |
| 400 | Bad Request (validación fallida) |
| 401 | Unauthorized (token inválido/expirado) |
| 403 | Forbidden (sin permisos) |
| 404 | Not Found |
| 500 | Internal Server Error |

**Formato de Error:**
```json
{
  "detail": "Descripción del error",
  "code": "validation_error",
  "errors": {
    "email": ["Este campo es requerido"],
    "dni_cif": ["Formato de DNI inválido"]
  }
}
```

---

## 🔍 Paginación

**Request:**
```
GET /api/clientes/?pageIndex=0&pageSize=25
```

**Response:**
```json
{
  "count": 150,
  "next": "/api/clientes/?pageIndex=1&pageSize=25",
  "previous": null,
  "results": [...]
}
```

**Convención TanStack Table:**
- `pageIndex`: 0-based (0, 1, 2...)
- `pageSize`: Número de resultados por página

---

**[[../00-Indice|← Volver al Índice]]** | **[[../../docs/Api_Endpoints|Ver Lista Completa →]]**

---

**Zirqulo Partners** — API REST profesional
