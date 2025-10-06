---
title: Zirqulo — Casos de Uso
tags: [comercial, casos-uso, ejemplos, practico]
fecha: 2025-10-04
tipo: casos-practicos
---

# Zirqulo — Casos de Uso Prácticos

> **Escenarios reales de implementación por tipo de partner**

---

## 🏢 Caso 1: Partner B2B — Cadena de Tiendas de Electrónica

### Perfil del Partner
- **Empresa:** ElectroRetail España
- **Red:** 15 tiendas en capitales de provincia
- **Empleados:** 45 vendedores
- **Clientes principales:** Empresas y autónomos
- **Problema:** Muchas consultas de empresas queriendo renovar flotas de dispositivos, pero no tenían solución para comprar los usados

### Implementación con Zirqulo

**Fase 1: Configuración (4 horas)**
```
├─ Creación de tenant "electroretail"
├─ Branding: Logo y colores corporativos
├─ Alta de 15 tiendas en el sistema
├─ Creación de 3 managers + 45 vendedores
└─ Catálogo: iPhones, iPads, MacBooks, Samsung Galaxy
```

**Fase 2: Formación (2 días)**
```
├─ Webinar para managers (1 hora)
├─ Training vendedores (30 min por sesión)
└─ Soporte on-site en 3 tiendas piloto
```

**Fase 3: Piloto (30 días)**
```
3 tiendas activas:
├─ Madrid Centro: 18 operaciones
├─ Barcelona Diagonal: 22 operaciones
└─ Valencia: 15 operaciones
Total piloto: 55 operaciones × 42€ comisión = 2,310€
```

**Resultados Post-Piloto (6 meses):**
```
15 tiendas activas:
├─ Operaciones mensuales: 145
├─ Comisión promedio: 48€
├─ Ingreso mensual: 6,960€
├─ Ingreso 6 meses: 41,760€
└─ Satisfacción vendedores: 4.6/5
```

**Caso de Éxito Destacado:**
> Una empresa de arquitectura quería renovar 25 MacBook Pro. ElectroRetail gestionó la recompra de los antiguos a través de Zirqulo (valor total: 18,750€, comisión: 2,812€) y vendió 25 nuevos MacBook (margen adicional: ~7,500€). **Total operación: 10,312€ de beneficio.**

---

## 📱 Caso 2: Partner B2C — Tiendas de Telefonía

### Perfil del Partner
- **Empresa:** MovilExpress
- **Red:** 8 tiendas (centros comerciales)
- **Empleados:** 24 vendedores
- **Clientes principales:** Particulares
- **Problema:** Clientes querían vender su móvil antiguo para financiar uno nuevo, pero el proceso manual era lento y poco fiable

### Implementación con Zirqulo

**Estrategia: Programa Trade-In**
```
"Vende tu antiguo, llévate el nuevo"

Cliente entra queriendo iPhone 15 Pro (1,219€):
├─ 1. Valoración de su iPhone 12 Pro actual: 380€
├─ 2. Firma contrato digital en tienda (2 min)
├─ 3. Descuento inmediato en compra nuevo: 380€
├─ 4. Cliente paga solo: 839€ (más asequible)
└─ 5. MovilExpress recibe comisión: 45€

Resultado Win-Win:
├─ Cliente: Ahorra 380€ + vende fácil
├─ MovilExpress: Vende iPhone nuevo + 45€ comisión
└─ Zirqulo: Adquiere iPhone 12 Pro para reventa
```

**Resultados (3 meses):**
```
├─ Conversión en ventas nuevas: +35%
├─ Ticket medio venta nueva: +280€
├─ Operaciones de recompra: 78/mes
├─ Comisión mensual: 3,510€
└─ Beneficio total (venta nueva + comisión): 12,800€/mes
```

---

## 🌐 Caso 3: Operaciones Globales Multi-Tenant

### Perfil: Vista desde Progeek (Staff Interno)

**Escenario:** Un mes típico gestionando 5 partners

```
PANEL DE OPERACIONES GLOBALES

Partner A (ElectroRetail):
├─ 145 operaciones activas
├─ 23 en estado "Recibido" (auditoría pendiente)
├─ 12 en "Pendiente de pago"
└─ Acción: Revisar 3 dispositivos con discrepancia

Partner B (MovilExpress):
├─ 78 operaciones activas
├─ 5 con retraso en logística
└─ Acción: Contactar transportista

Partner C (TechTrade):
├─ 234 operaciones activas
├─ 45 en "En tránsito"
└─ Acción: Actualizar tracking masivo

Partner D (GadgetStore):
├─ 12 operaciones (partner nuevo)
├─ 2 en formación de equipo
└─ Acción: Webinar de soporte

Partner E (DigitalHub):
├─ 89 operaciones activas
├─ 10 contratos B2C pendientes KYC
└─ Acción: Reenviar OTPs
```

**Métricas Agregadas del Mes:**
```
├─ Total operaciones: 558
├─ Valor total gestionado: 168,240€
├─ Comisiones pagadas a partners: 25,236€
├─ Dispositivos adquiridos: 542
└─ Satisfacción clientes finales: 4.7/5
```

---

## 🎯 Caso 4: Caso de Uso Avanzado — Integración API

### Perfil del Partner
- **Empresa:** MegaRetail (cadena nacional)
- **Red:** 120 tiendas
- **Sistema:** ERP SAP propio
- **Requisito:** Integración bidireccional con Zirqulo

**Solución: API REST + Webhooks**

```
FLUJO INTEGRADO:

1. Cliente solicita valoración en tienda
   ├─ Vendedor usa ERP SAP (interfaz conocida)
   └─ SAP llama a API Zirqulo: POST /api/oportunidades/

2. Zirqulo devuelve valoración
   ├─ Precio, grado, condiciones
   └─ SAP muestra oferta al cliente

3. Cliente acepta
   ├─ SAP crea registro de venta
   └─ Webhook de Zirqulo notifica cambio de estado

4. Logística y pago
   ├─ Zirqulo gestiona todo el backend
   └─ Webhooks mantienen SAP sincronizado

5. Contabilidad
   ├─ Zirqulo exporta factura (CSV)
   └─ SAP la importa automáticamente (nightly job)
```

**Resultados:**
```
├─ 120 tiendas operativas
├─ 890 operaciones/mes
├─ Comisión mensual: 42,480€
├─ Integración transparente para vendedores
└─ Tiempo de onboarding: 8 semanas (vs 4h standalone)
```

---

## 🔄 Flujo Completo: Del Cliente a la Comisión

### Caso Real: Laura Martínez vende su iPhone 13 Pro

```
DÍA 1 - MARTES 10:30 AM (Tienda física)

Laura entra en tienda MovilExpress:
├─ Vendedor Ana abre Zirqulo
├─ Introduce datos: iPhone 13 Pro, 256GB, grado B
├─ Sistema consulta precios actualizados (Likewize + BackMarket)
├─ Genera oferta: 420€
├─ Laura acepta
└─ Firma contrato digital (OTP enviado a su móvil)

Tiempo total: 4 minutos
```

```
DÍA 1 - MARTES 11:00 AM (Backend Zirqulo)

Sistema procesa:
├─ Genera contrato B2C (PDF con hash)
├─ Registra consentimiento RGPD
├─ Crea etiqueta de envío (MRW)
├─ Envía email a Laura con tracking
└─ Notifica a Ana: "Todo listo"

Tiempo total: Automático (30 segundos)
```

```
DÍA 2 - MIÉRCOLES 16:00 PM (Logística)

MRW recoge dispositivo:
├─ Escanea etiqueta generada por Zirqulo
├─ Estado cambia a "En tránsito"
├─ Laura recibe notificación con tracking
└─ Ana ve actualización en su dashboard

Tiempo total: Automático
```

```
DÍA 3 - JUEVES 11:00 AM (Almacén Zirqulo)

Dispositivo llega a almacén:
├─ Técnico hace check-in: "Recibido"
├─ Auditoría física: Confirma grado B
├─ Estado cambia a "Oferta confirmada"
└─ Sistema procesa pago
```

```
DÍA 4 - VIERNES 09:00 AM (Pago)

Laura recibe transferencia:
├─ 420€ en su cuenta bancaria
├─ Email de confirmación
├─ Factura descargable
└─ Solicitud de valoración (NPS)

Ana (vendedora) ve en dashboard:
├─ Comisión: 45€
└─ Cliente satisfecho: ★★★★★
```

**Total del proceso: 3 días laborables**

---

## 📊 Comparativa: Antes vs Después de Zirqulo

### Caso: Tienda Promedio con 20 Operaciones/Mes

```
ANTES DE ZIRQULO:
┌─────────────────────────────────────────────┐
│ Proceso Manual Completo                     │
├─────────────────────────────────────────────┤
│ • Valoración: Consultar Excel antiguo       │
│ • Oferta: Escribir a mano                   │
│ • Contrato: Imprimir plantilla PDF          │
│ • Firma: Papel + fotocopia DNI              │
│ • Logística: Llamar a transportista         │
│ • Pago: Transferencia manual                │
│ • Archivo: Carpetas físicas                 │
├─────────────────────────────────────────────┤
│ Tiempo por operación: 75 minutos            │
│ Conversión: 12%                             │
│ Errores/mes: 3-4 (contratos mal firmados)   │
│ Riesgo RGPD: Alto                           │
│ Visibilidad: Excel local                    │
│ Margen: Variable (riesgo de pérdida)        │
└─────────────────────────────────────────────┘

CON ZIRQULO:
┌─────────────────────────────────────────────┐
│ Proceso Digital Automatizado                │
├─────────────────────────────────────────────┤
│ • Valoración: Automática (< 2 min)          │
│ • Oferta: Generada al instante              │
│ • Contrato: Digital con firma electrónica   │
│ • Firma: OTP (sin papeles)                  │
│ • Logística: Etiqueta automática            │
│ • Pago: Procesado por Zirqulo               │
│ • Archivo: Cloud + auditoría                │
├─────────────────────────────────────────────┤
│ Tiempo por operación: 4 minutos             │
│ Conversión: 25% (+108%)                     │
│ Errores/mes: 0 (validaciones automáticas)   │
│ Riesgo RGPD: Cero (cumplimiento nativo)     │
│ Visibilidad: Dashboard tiempo real          │
│ Margen: Predecible (comisión fija)          │
└─────────────────────────────────────────────┘

RESULTADO:
├─ Ahorro de tiempo: 94%
├─ Conversión: +108%
├─ Satisfacción cliente: +45%
└─ Ingresos adicionales: +6,000€/año
```

---

## 🎓 Lecciones Aprendidas de Partners Exitosos

### Best Practices Identificadas

**1. Comunicación Proactiva**
```
Partners que comunican el programa activamente:
├─ Cartelería en tienda: "Compramos tu móvil usado"
├─ Scripts de vendedores: "¿Tienes un móvil antiguo?"
├─ Email marketing: "Valoración gratuita en 2 minutos"
└─ Resultado: +40% más operaciones
```

**2. Formación Continua**
```
Partners que hacen training mensual:
├─ Webinars de mejores prácticas
├─ Gamificación con rankings
├─ Incentivos a top performers
└─ Resultado: +30% en conversión
```

**3. Integración en Flujo de Venta**
```
Momento óptimo para ofrecer recompra:
✅ BUENO: Cuando cliente pregunta precio nuevo
✅ MEJOR: Cuando cliente compara modelos
✅ ÓPTIMO: Cuando cliente dice "es caro"

Respuesta: "¿Tienes un móvil antiguo? Te lo valoramos ahora y te hacemos descuento"
Conversión: 60% aceptan valoración
```

---

## 📈 Proyecciones de Crecimiento

### Evolución Típica de un Partner

```
MES 1-3 (Piloto):
├─ 15-25 operaciones/mes
├─ Aprendizaje del sistema
└─ Primeras comisiones

MES 4-6 (Expansión):
├─ 40-60 operaciones/mes
├─ Optimización de procesos
└─ Comisiones estables

MES 7-12 (Consolidación):
├─ 80-100 operaciones/mes
├─ Sistema integrado en cultura
└─ Ingresos predecibles

AÑO 2+ (Escala):
├─ 120-150 operaciones/mes
├─ Posibles integraciones custom
└─ Canal de ingresos estratégico
```

---

**[[../00-Indice|← Volver al Índice]]** | **[[../03-Tecnico/Arquitectura-Detallada|Siguiente: Arquitectura Técnica →]]**

---

> [!tip] Casos Personalizados
> Cada sector y tipo de partner tiene particularidades. Solicita un análisis personalizado para tu caso concreto.

**Zirqulo Partners** — Casos de éxito reales
