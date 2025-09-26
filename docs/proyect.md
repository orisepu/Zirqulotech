Zirqulo — Smart Trade-In Platform

Qué es: Plataforma multi-tenant para gestionar recompra en retail (Apple, tech, relojes, bolsos, oro, deporte). Unifica valoración, auditoría, logística, precios y cobro con trazabilidad por tienda y usuario.

Problema

Precios inconsistentes y desactualizados entre B2B/B2C.

Procesos manuales (ofertas, auditorías, facturas, pagos).

Poca visibilidad operativa y KPIs dispersos.

Integraciones costosas (pricing, logística, pagos, e-firma).

Riesgos de cumplimiento (KYC/GDPR) y experiencia irregular.

Propuesta de valor

Más margen & conversión con pricing versionado y estados de producto.

Operación end-to-end: desde la oportunidad hasta el pago.

Control en tiempo real: pipeline, KPIs y alertas.

Despliegue rápido y marca blanca para cadenas y marketplaces.

Funcionalidades clave

Multi-tenant real por partner; roles: superadmin, manager, empleado.

Motor de precios: Likewize (B2B), Back Market/Swappie (B2C), reglas y versionado.

Auditoría por dispositivo: IMEI/serie, estado físico/funcional, fotos y notas.

Oferta PDF y flujo documental: factura, KYC/OTP, retenciones y caducidades.

Dashboards & KPIs: conversión, ticket medio, tiempos, ranking productos.

Chat interno & notificaciones (WebSocket).

APIs para catálogos, precios, reporting; white-label.

Tecnología

Django + DRF + PostgreSQL (schemas multi-tenant), Next.js + React + MUI, WebSockets, tareas programadas, integraciones (pricing/logística/pagos/e-firma).

Métricas objetivo (north-stars)

TTR (alta → oferta PDF) < 3 min.

Aceptación de oferta: +20% vs baseline del partner.

Tiempo a pago p95 < 48 h desde factura.

Disponibilidad 99,9% y errores < 0,1% de operaciones.

Alcance V1 (90 días)

Multi-tenant + login y roles.

Catálogo base Apple (iPhone/iPad/Mac) con capacidades.

Import Likewize (B2B) a staging + diff + aplicar; referencia B2C (Back Market/Swappie).

Pipeline: pendiente → aceptada → recogida → tránsito → recibido.

Recepción & auditoría por dispositivo; oferta PDF.

KYC/OTP y documentos.

Dashboard básico y notificaciones/chat.

Roadmap breve (V2+)

Integración logística (etiquetas/track) y pagos (Stripe).

Público B2C (cotizador, cita de recogida, seguimiento).

Reglas de precios avanzadas/ML y coste de reparación (piezas/mano-de-obra).

Plantillas de email por evento y bandeja de notificaciones persistente.

Riesgos & mitigación

Normalización de fuentes y mapeos → staging + diff aplicable, equivalencias CSV.

Formación de auditoría → criterios guiados y ejemplos visuales.

Onboarding cadenas → módulos white-label y APIs claras.

GDPR/KYC → retenciones configurables y auditoría de accesos.

Llamada a la acción

Piloto 2–3 tiendas durante 4–6 semanas con pricing B2B/B2C en vivo.

Definir acuerdos de SLA y KPIs de éxito por partner.
