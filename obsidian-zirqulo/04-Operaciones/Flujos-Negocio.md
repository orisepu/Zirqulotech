---
title: Flujos de Negocio — Zirqulo
tags: [operaciones, flujos, procesos, negocio]
fecha: 2025-10-04
tipo: operaciones
---

# Flujos de Negocio de Zirqulo

> **Procesos operativos paso a paso**

Consulta también: [[../../docs/proyect-overview|Project Overview]] para el contexto completo.

---

## 🔄 Flujo 1: Creación de Oportunidad (B2C)

### Paso a Paso

```
ACTOR: Vendedor en Tienda
DURACIÓN: 4-6 minutos
```

**1. Cliente Llega a Tienda (t=0min)**
```
Cliente: "Quiero vender mi iPhone 13 Pro"
Vendedor: "Perfecto, te lo valoramos en 2 minutos"
```

**2. Vendedor Abre Zirqulo (t=0:30min)**
```
Dashboard → Nueva Oportunidad
├─ ¿Cliente ya registrado?
│   ├─ SÍ: Buscar por DNI/Email → Seleccionar
│   └─ NO: Crear cliente nuevo (Paso 3)
```

**3. Crear Cliente (si es nuevo) (t=1:00min)**
```
Formulario Cliente (Tipo: Particular):
├─ Nombre: Laura Martínez
├─ DNI: 45678912B (validación automática)
├─ Email: laura@example.com
├─ Teléfono: 612345678
└─ Guardar

Sistema valida:
✅ DNI válido (check digit correcto)
✅ Email único
✅ Teléfono formato español
```

**4. Valorar Dispositivo (t=2:00min)**
```
Formulario Valoración:
├─ Marca: Apple
├─ Modelo: iPhone 13 Pro
├─ Capacidad: 256GB
├─ IMEI: 354886090123456 (validación Luhn)
├─ Estado General: Bueno (B)
├─ Pantalla: OK (sin píxeles muertos)
├─ Cristal: Micro-rayones (MICRO)
├─ Carcasa: Algunos signos de uso (ALGUNOS)
├─ Batería: 85% health

Sistema calcula automáticamente:
├─ Precio base (Likewize): 450€
├─ Deducciones:
│   ├─ Batería (85%): -10€
│   ├─ Cristal (MICRO): -5€
│   └─ Carcasa (ALGUNOS): -15€
├─ Precio final: 420€
└─ Grado final: B
```

**5. Cliente Decide (t=3:00min)**
```
Vendedor muestra oferta:
"Te ofrecemos 420€ por tu iPhone 13 Pro"

Cliente: "¿Cómo es el proceso?"
Vendedor: "Firmamos contrato digital ahora,
           recibes etiqueta de envío por email,
           envías el dispositivo gratis,
           lo auditamos en 24-48h,
           si todo coincide recibes pago en 48h"

Cliente: "Acepto"
```

**6. Firma Digital (t=4:00min)**
```
Sistema genera contrato B2C:
├─ Datos cliente: Laura Martínez
├─ Dispositivo: iPhone 13 Pro 256GB
├─ Precio acordado: 420€
├─ Condiciones de recompra
├─ Consentimientos RGPD

Proceso de firma:
1. Sistema envía OTP al móvil de Laura
2. Laura introduce código de 6 dígitos
3. Sistema registra:
   ├─ Hash SHA-256 del contrato
   ├─ IP de firma: 185.43.xxx.xxx
   ├─ Timestamp: 2025-10-04T10:35:23Z
   └─ User-Agent: Safari/iOS

Resultado: ✅ Contrato firmado (válido legalmente)
```

**7. Logística Automática (t=4:30min)**
```
Sistema genera automáticamente:
├─ Etiqueta de envío MRW
├─ Email a Laura con:
│   ├─ PDF del contrato firmado
│   ├─ Etiqueta descargable
│   ├─ Instrucciones de empaquetado
│   └─ Número de tracking

Laura recibe email en < 1 minuto
```

**8. Fin del Proceso en Tienda (t=5:00min)**
```
✅ Oportunidad creada
✅ Cliente satisfecho
✅ Vendedor ve comisión estimada: 45€

Estado: "Aceptado"
```

---

## 📦 Flujo 2: Logística y Recepción

### Del Envío al Pago

**Día 1 (tarde): Cliente Envía Dispositivo**
```
Laura empaqueta su iPhone:
├─ Pone iPhone en caja segura
├─ Pega etiqueta MRW
├─ Llama a MRW para recogida o lo deja en punto

MRW recoge y escanea:
└─ Sistema detecta escaneo → Estado: "En tránsito"
    └─ Notificación push a Laura
    └─ Email con tracking actualizado
```

**Día 2: Dispositivo en Tránsito**
```
Laura puede ver en tiempo real:
├─ Estado: "En tránsito"
├─ Tracking MRW: En reparto
└─ Estimado llegada: Mañana 10:00 AM

Sistema monitorea tracking automáticamente
```

**Día 3 (mañana): Llega a Almacén Zirqulo**
```
Técnico de almacén:
1. Escanea etiqueta → Sistema: Estado "Recibido"
   └─ Notificación a Laura: "Hemos recibido tu dispositivo"

2. Check-in inicial (5 min):
   ├─ ¿Coincide IMEI? ✅ Sí
   ├─ ¿Está encendido? ✅ Sí
   ├─ ¿Modelo correcto? ✅ Sí
   └─ Estado: "Check in OK"

3. Auditoría detallada (15 min):
   ├─ Test batería: 85% health ✅ Coincide
   ├─ Test pantalla: OK ✅ Sin píxeles
   ├─ Inspección cristal: MICRO ✅ Coincide
   ├─ Inspección carcasa: ALGUNOS ✅ Coincide
   ├─ Test funcional completo: ✅ Todo OK
   └─ Fotos de evidencia (6 fotos)

Resultado Auditoría:
✅ Valoración inicial confirmada
✅ Precio mantiene: 420€
└─ Estado: "Oferta confirmada"
```

**Día 3 (tarde): Procesamiento de Pago**
```
Sistema automáticamente:
1. Cambia estado a "Pendiente de pago"
2. Genera factura interna
3. Procesa pago:
   ├─ Beneficiario: Laura Martínez
   ├─ IBAN: ES91 2100 0418...
   ├─ Importe: 420€
   ├─ Concepto: "Recompra iPhone 13 Pro - Ref: OPP-12345"
   └─ Ejecuta transferencia

4. Estado: "Pagado"
5. Envía email a Laura:
   ├─ "Has recibido 420€"
   ├─ Factura descargable
   └─ Solicitud de valoración (NPS)

Comisión para Partner:
├─ Vendedor Ana ve en dashboard: +45€
├─ Partner "MovilExpress" ve en resumen mensual
```

---

## 🔀 Flujo 3: Discrepancia en Auditoría (Nueva Oferta)

### ¿Qué pasa si el dispositivo difiere?

**Escenario:** Batería peor de lo declarado

```
Auditoría detecta:
├─ Batería declarada: 85% health
├─ Batería real: 72% health
└─ Diferencia: -13 puntos

Sistema calcula nueva oferta:
├─ Precio original: 420€
├─ Deducción adicional batería: -30€
├─ Nueva oferta: 390€
└─ Estado: "Nueva oferta"

Proceso automático:
1. Sistema genera PDF con nueva oferta
2. Envía email a Laura:
   "Hemos detectado que la batería tiene 72% (no 85%).
    Nueva oferta: 390€.
    Tienes 48h para aceptar o rechazar."

3. Laura recibe email con opciones:
   ├─ [Botón] Aceptar 390€
   └─ [Botón] Rechazar (devolver dispositivo)

Si Laura acepta (opción A):
├─ Clic en botón del email
├─ Sistema: Estado "Nueva oferta confirmada"
├─ Procesa pago de 390€
└─ Fin del proceso

Si Laura rechaza (opción B):
├─ Sistema: Estado "Rechazada"
├─ Inicia proceso de devolución
├─ Genera etiqueta de envío a dirección de Laura
├─ Envía dispositivo de vuelta
└─ Estado final: "Recibido por cliente"
```

---

## 📊 Flujo 4: Dashboard Manager — Revisión Diaria

### Rutina Matinal de un Manager

**Manager accede a Dashboard (9:00 AM)**

```
Vista Manager - Resumen del Día:
┌─────────────────────────────────────────┐
│  AYER (03/10/2025)                      │
├─────────────────────────────────────────┤
│  📊 Operaciones:                        │
│     Total: 18                           │
│     Nuevas: 12                          │
│     Cerradas (pagadas): 6               │
│                                         │
│  💰 Valor Total: 7,650€                 │
│     Comisión estimada: 765€             │
│                                         │
│  📈 Conversión: 22% (+5% vs mes pasado) │
│  🎯 Objetivo mes: 73% completado        │
└─────────────────────────────────────────┘

ACCIONES PENDIENTES:
⚠️ 3 dispositivos en auditoría > 24h
⚠️ 2 contratos KYC pendientes
✅ 15 operaciones sin issues
```

**Manager hace drill-down:**

```
1. Revisar auditorías retrasadas:
   Opp #12389 - iPad Pro - En revisión (36h)
   ├─ Ver detalle → Chat interno
   ├─ Contactar técnico: "¿Qué está pasando?"
   └─ Técnico responde: "Pantalla con burn-in no declarado"
       └─ Decisión: Generar nueva oferta

2. Revisar KYC pendientes:
   Opp #12401 - Cliente Juan Pérez
   ├─ Estado: Pendiente OTP
   ├─ Acción: Reenviar OTP
   └─ Resultado: Cliente firma inmediatamente

3. Revisar objetivos:
   ├─ Objetivo mes: 100 operaciones
   ├─ Llevamos: 73 operaciones (21 días)
   ├─ Ritmo: 3.5 ops/día
   ├─ Proyección: 105 operaciones ✅
   └─ Conclusión: Vamos bien
```

---

## 🔧 Flujo 5: Actualización de Precios (Staging → Diff → Apply)

### Proceso Semanal de Actualización

**Lunes 9:00 AM — Ingesta Automática**

```
Celery Task programado:
├─ Descarga precios de Likewize API
├─ Descarga precios de BackMarket API
├─ Guarda en tabla "precio_staging"
└─ Notifica a Manager: "Nuevos precios disponibles"

Manager recibe notificación:
"📊 Actualización de precios semanal disponible
 Cambios detectados: 127 modelos
 [Ver Diff]"
```

**Manager Revisa Diff**

```
Dashboard → Precios → Ver Diff

Tabla de cambios:
┌─────────────────────┬─────────┬────────┬────────┬────────┐
│ Modelo              │ Anterior│ Nuevo  │ Cambio │ Alerta │
├─────────────────────┼─────────┼────────┼────────┼────────┤
│ iPhone 13 Pro 256GB │ 450€    │ 445€   │ -1.1%  │        │
│ iPhone 14 128GB     │ 520€    │ 540€   │ +3.8%  │        │
│ Samsung S23 256GB   │ 380€    │ 420€   │ +10.5% │ ⚠️     │
│ iPad Pro 11" 128GB  │ 350€    │ 280€   │ -20.0% │ 🚨     │
└─────────────────────┴─────────┴────────┴────────┴────────┘

Alertas:
🚨 iPad Pro: Caída de 20% → Verificar fuente
⚠️ Samsung S23: Subida de 10% → Normal (nuevo modelo salió)
```

**Manager Toma Decisión**

```
Opciones:
1. [Aplicar Todos] → Aplica los 127 cambios
2. [Aplicar Selectivos] → Solo algunos modelos
3. [Rechazar] → Mantener precios actuales

Manager selecciona "Aplicar Todos":
├─ Sistema crea backup de precios actuales
├─ Copia precio_staging → precio_produccion
├─ Registra en historial_precios:
│   ├─ Versión: 2025_10_07_weekly
│   ├─ Usuario: manager@movil.com
│   ├─ Timestamp: 2025-10-07T10:15:34Z
│   └─ Cambios: 127 modelos
├─ Invalida cache de valoraciones
└─ Notifica a equipo: "Precios actualizados"

Resultado:
✅ Próxima valoración usará precios nuevos
✅ Valoraciones anteriores no se ven afectadas
✅ Rollback disponible si es necesario
```

---

## 📞 Flujo 6: Soporte al Partner (Chat Contextual)

### Partner Tiene Duda sobre Oportunidad

**Escenario:** Vendedor tiene cliente con pregunta sobre pago

```
Vendedor (Ana) desde detalle de Oportunidad:
├─ Clic en icono de chat 💬
├─ Se abre widget de chat contextual
└─ Escribe: "Cliente pregunta cuándo recibirá el pago"

Chat se conecta a WebSocket:
├─ Mensaje llega a equipo de Soporte Zirqulo
├─ Agente de soporte ve contexto automáticamente:
│   ├─ Oportunidad: #12345
│   ├─ Cliente: Laura Martínez
│   ├─ Estado actual: "En revisión"
│   ├─ Dispositivo: iPhone 13 Pro
│   └─ Historial de la oportunidad

Agente responde (tiempo real):
"Hola Ana, veo que el dispositivo llegó ayer.
 Está en auditoría técnica (tarda 24-48h).
 Laura recibirá el pago 48h después de confirmar auditoría.
 Estimado: Viernes por la tarde."

Ana ve respuesta instantáneamente:
├─ Informa al cliente
└─ Cliente satisfecho
```

---

## 🎯 Flujo 7: Cumplimiento de Objetivos

### Seguimiento de Metas Mensuales

**Configuración de Objetivos (inicio de mes)**

```
Manager configura objetivos Octubre:
├─ Tienda Madrid Centro:
│   ├─ Operaciones: 40/mes
│   ├─ Valor total: 18,000€
│   └─ Conversión mínima: 20%
├─ Tienda Barcelona:
│   ├─ Operaciones: 35/mes
│   ├─ Valor total: 15,000€
│   └─ Conversión mínima: 18%
└─ ...

Sistema guarda objetivos y empieza tracking
```

**Seguimiento Diario**

```
Dashboard muestra progreso automático:

Tienda Madrid Centro (día 15 del mes):
├─ Operaciones: 23/40 (58%)
├─ Valor: 10,350€/18,000€ (58%)
├─ Conversión: 24% ✅ (objetivo 20%)
├─ Proyección: 46 operaciones ✅ Superará objetivo
└─ Top vendedor: Ana (8 ops, 3,600€)

Tienda Barcelona (día 15 del mes):
├─ Operaciones: 12/35 (34%)
├─ Valor: 5,100€/15,000€ (34%)
├─ Conversión: 16% ⚠️ (objetivo 18%)
├─ Proyección: 24 operaciones ❌ No alcanzará objetivo
└─ Acción necesaria: Formación o incentivos
```

**Alertas Automáticas**

```
Sistema envía email a Manager:
"⚠️ Alerta de Objetivo - Tienda Barcelona

La tienda Barcelona está al 34% del objetivo mensual
en el día 15 (debería estar al 50%).

Conversión actual: 16% (objetivo: 18%)

Acciones sugeridas:
1. Revisar formación de vendedores
2. Incentivar programa de recompra
3. Verificar disponibilidad de material promocional"
```

---

**[[../00-Indice|← Volver al Índice]]** | **[[Troubleshooting|Siguiente: Troubleshooting →]]**

---

**Zirqulo Partners** — Procesos operativos claros y eficientes
