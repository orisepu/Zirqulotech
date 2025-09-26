# Zirqulo — API Endpoints

> **Estado:** v1 · **Base URL:** `/api/` · **Auth:** JWT `Authorization: Bearer <token>` · **Multi‑tenant:** cabecera `X-Tenant: <slug>` (o `?schema=<slug>` en endpoints globales)

## 0) Convenciones

* **Content‑Type:** `application/json`.
* **Autenticación:**

  * `POST /login/` → JWT + metadatos de roles.
  * `POST /token/` / `POST /token/refresh/` (SimpleJWT).
* **Multi‑tenant:**

  * Normal: cabecera `X-Tenant`.
  * Global (staff interno): prefijo `*-globales` o `oportunidades-globales` + `?schema=<tenant_slug>`.
* **CRUD REST:** routers DRF (`GET list`, `POST create`, `GET detail`, `PATCH|PUT update`, `DELETE destroy`).
* **Paginación:** `pageIndex` (0‑based), `pageSize`. Respuesta incluye `count`, `next`, `previous`, `results` (o equivalente TanStack).
* **Errores (estándar):** `{ "detail": str, "code": str? }`.

---

## 1) Autenticación y sesión

* `POST /login/` – login multi‑tenant. **Body:** `{ empresa, email, password }` → tokens + roles.
* `POST /token/` – obtiene `{ access, refresh }`.
* `POST /token/refresh/` – renueva `access`.

**Ejemplo cURL**

```bash
curl -X POST https://<host>/api/login/ \
  -H 'Content-Type: application/json' \
  -d '{"empresa":"acme","email":"user@acme.com","password":"••••"}'
```

---

## 2) Usuarios y tenants

* `GET|POST|PATCH /usuarios-tenant/` – usuarios del tenant (manager/super). Scope por `X-Tenant` o `?schema=`.
* `POST /cambiar-contraseña/` – usuario autenticado cambia su password.
* `POST /cambiar-password/` – manager cambia la de otro usuario del tenant.
* `GET /yo/` – datos del usuario global logueado (Progeek/Staff).
* `GET /usuarios/` – listado global (admin interno).
* `GET /tenants/` · `GET /tenants/<id>/` · `GET /tenants/by-schema/<slug>/` – detalle de tenants; acuerdos `.../agreement/`.

---

## 3) CRM (clientes, tiendas, comentarios)

* `GET|POST|PATCH|DELETE /clientes/` – CRUD de clientes. Filtros: `tipo_cliente`, `canal`, `tienda_id`, `search`.
* `GET /clientes/?schema=<slug>` – operar otros tenants (superadmin).
* `GET|POST /comentarios-cliente/` – comentarios por cliente.
* `GET|POST|PATCH /tiendas/` – CRUD de tiendas (usar `?schema=<slug>` desde admin global).

---

## 4) Oportunidades

* `GET|POST|PATCH /oportunidades/` – pipeline principal. Queries: `estado`, `cliente`, `fecha_inicio`, `fecha_fin`, `pageIndex`, `pageSize`.
* `GET /oportunidades/<id|uuid>/historial/` – historial de eventos.
* `POST /oportunidades/<uuid>/enviar-correo-oferta/` – disparar email de oferta.
* `GET /oportunidades/<int:pk>/generar-pdf/` – descargar PDF de oferta.
* `POST /oportunidades/<uuid>/asociar-dispositivos/` – vincular dispositivos existentes.
* `GET /oportunidades/<uuid>/transiciones-validas/` – lista de estados a los que puede transitar.
* `GET /oportunidades/<uuid>/comentarios/` – comentarios asociados.

---

## 5) Dispositivos y valoraciones

* `GET|POST|PATCH|DELETE /dispositivos/` – precaptura. Acciones:

  * `POST /dispositivos/<id>/recalcular_precio/` – recalcula precio orientativo.
  * `GET /dispositivos/para_crear_oportunidad/` – pendientes para creación de oportunidad.
  * `POST /dispositivos/crearvarios/` – alta masiva (`dispositivos[]`).
* `POST /dispositivos-reales/crear/` – alta rápida de dispositivo auditado.
* `GET /oportunidades/<uuid>/dispositivos-reales/` – dispositivos reales de una oportunidad.
* **Global (interno):**

  * `GET /dispositivos-reales-globales/<tenant>/<uuid>/`
  * `POST /dispositivos-reales-globales/<tenant>/crear/`
  * `POST /dispositivos-reales-globales/<tenant>/editar/<id>/`
  * `POST /dispositivos-reales-globales/<tenant>/borrar/`
  * `POST /oportunidades-globales/<schema>/<uuid>/confirmar-recepcion/`
* Catálogo:

  * `GET /modelos/` · `GET /capacidades/`
  * `GET /capacidades-por-modelo/?modelo=<id>`

---

## 6) Documentos y facturas

* `POST /facturas/subir/` – sube factura y mueve a **Factura recibida** cuando corresponde.
* `GET /documentos/<id>/descargar/` – descarga documentos de oportunidades/dispositivos.
* **Global:** `POST /facturas/<tenant>/subir/` · `GET /documentos/<tenant>/<id>/descargar/`.

---

## 7) Contratos B2C y legales

* `GET|POST|PATCH /b2c/contratos/` – contratos B2C por oportunidad. Filtros: `oportunidad`, `estado`, `kyc_token`, `email`, `telefono`.
* Acciones KYC/OTP:

  * `GET /b2c/contratos/kyc/<token>/flags/` (público)
  * `POST /b2c/contratos/kyc/<token>/finalizar/`
  * `POST /b2c/contratos/kyc/<pk>/renovar/`
  * `POST /b2c/contratos/kyc/<pk>/reenviar-kyc/`
  * `GET /b2c/contratos/pdf/<token>/` (público)
  * `GET /b2c/contratos/kyc/<token>/pdf-preview/` (público)
  * Internas: `detalle-por-opp`, `generar-acta`, `verificar-otp`, `subir-dni`, `enviar-otp`, `verificar-otp`.
* Plantillas legales:

  * `GET|POST /legal/templates/` – versionado, preview, activación.
  * `GET /b2c/contratos/por-oportunidad/<uuid>/`

---

## 8) Objetivos y OKRs

* `GET|POST|PATCH /objetivos/` – metas por tienda/usuario.
* `GET /objetivos/resumen/?scope=tienda|usuario&periodo=YYYY-MM&periodo_tipo=mes|trimestre`.

---

## 9) Dashboards y KPIs

* `GET /mi-dashboard/`
* `GET /dashboard/valor-por-tienda/` (params: `fecha_inicio`, `fecha_fin`, `estado_minimo`, `granularidad=dia|semana|mes`).
* `GET /dashboard/valor-por-tienda-manager/`
* `GET /dashboard/valor-por-usuario/`
* `GET /dashboard/ranking-productos/`
* `GET /dashboard/tasa-conversion/`
* `GET /dashboard/tiempo-entre-estados/`
* `GET /dashboard/estado-pipeline/`
* `GET /dashboard/rechazos-producto/`
* `GET /dashboard/manager/` (agregado managers)
* `GET /dashboard/total-pagado/`
* **Global:** `GET /resumen-global/`, `GET /pipeline-oportunidades/`, `GET /dashboard/admin/`.

---

## 10) Operaciones globales (Progeek/Staff)

* `GET /oportunidades-globales/` – listado cross‑tenant (filtros: tenant, estado, fechas).
* `GET /oportunidades-globales/<tenant>/<uuid>/` – detalle remoto.
* `GET /oportunidades-globales/<tenant>/<uuid>/detalle-completo/` – con dispositivos/historial/documentos.
* `GET /oportunidades-globales/<tenant>/<uuid>/historial/`
* `POST /oportunidades-globales/<tenant>/<uuid>/cambiar-estado/`
* `GET /oportunidades-globales/<tenant>/<uuid>/generar-pdf/`
* `POST /dispositivos-globales/<tenant>/` · `DELETE /dispositivos-globales/<tenant>/<id>/`
* `GET /busqueda-global/`
* `POST /auditorias-globales/<tenant>/`
* `POST /crear-dispositivo-global/` (alias)
* `POST /crear-company/` – alta tenant
* `GET /lotes-globales/` · `GET /lotes-globales/<tenant>/<pk>/dispositivos/`
* `GET /yo/` (perfil global)

---

## 11) Productos y pricing

* `GET /tipos-modelo/` · `GET /marcas-modelo/`
* Admin capacidades y sets de precios: `/admin/capacidades/`, `/admin/precios/set/`.
* Integraciones:

  * `/precios/likewize/*`
  * `/precios/backmarket/*`
  * `/precios/b2c/*`
  * `POST /precios/likewize/tareas/<uuid>/aplicar/` (y equivalentes) – confirma cargas.
* Calculadoras iPhone:

  * `GET /valoraciones/iphone/comercial/`
  * `GET /valoraciones/iphone/auditoria/`

---

## 12) Chat y notificaciones

* `POST /chat/soporte/` – abre/recupera chat contextual.
* `GET /chat/<id>/mensajes/` – historial.
* `POST /chat/<id>/cerrar/` – cierra chat.
* `GET /chats/abiertos/` – activos para staff.
* `GET /notificaciones/` – notificaciones del usuario.

---

## 13) Otros helpers

* `GET /capacidades-por-modelo/` – helper de front.
* `POST /plantillas-correo/` – plantillas transaccionales (Progeek).
* `GET /pipeline-oportunidades/` – pipeline global (duplicado en dashboards, expuesto en `progeek.urls`).
* `GET /lanzar-actualizacion` – tareas de sincronización con proveedores.

---

## 14) Notas

* Para endpoints que requieren `tenant`/`schema`, enviar **siempre** el slug correcto via `X-Tenant` o `?schema=`.
* Algunas acciones (KYC/OTP/PDF) pueden ser **públicas por token** y no requieren auth, pero **están limitadas por TTL y permisos de lectura**.
* Los endpoints globales son **solo para usuarios internos** (soporte/superadmin).

