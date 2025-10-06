# Protección de Datos en Zirqulo Partners
**Guía para Partners: Cómo Protegemos Tu Información y la de Tus Clientes**

---

## Introducción: ¿Por Qué Deberías Leer Esto?

Como dueño de una tienda de dispositivos, manejas información muy sensible:
- **Datos personales de tus clientes**: DNI, teléfonos, direcciones
- **Información comercial**: Cuánto pagas por cada dispositivo, tus márgenes, tus estrategias de precios
- **Tu base de clientes**: El activo más valioso de tu negocio

Esta guía #explica cómo Zirqulo Partners protege toda esa información para que:
1. **Tus competidores** no puedan ver tus datos (incluso si también usan Zirqulo)
2. **Tus clientes** estén protegidos según las leyes europeas (RGPD)
3. **Tu negocio** esté seguro ante posibles incidentes

No necesitas ser un experto en tecnología para entenderlo. Te lo explicaremos paso a paso.

---

## 🏢 La Analogía del Edificio de Apartamentos

### Imagina que Zirqulo es como un edificio de apartamentos de lujo

**Tu apartamento** (tu espacio privado en Zirqulo):
```
┌─────────────────────────────────────┐
│  🏠 TU APARTAMENTO - "PARTNER_XYZ"  │
│                                     │
│  🛏️  TUS CLIENTES                   │
│  │  - María García (DNI: 12345678X) │
│  │  - Juan Pérez (Tel: 666777888)  │
│  │  - 150 clientes más...          │
│                                     │
│  💼 TUS OPORTUNIDADES               │
│  │  - iPhone 13 Pro valorado       │
│  │  - Samsung S23 en negociación   │
│  │  - 45 dispositivos en pipeline  │
│                                     │
│  📄 TUS DOCUMENTOS                  │
│  │  - Facturas de compra           │
│  │  - Contratos firmados            │
│  │  - Albaranes de entrega          │
│                                     │
│  💰 TU INFORMACIÓN FINANCIERA       │
│  │  - Precio que pagaste: 450€     │
│  │  - Tu margen: 35%                │
│  │  - Objetivos mensuales           │
│                                     │
│  🔐 PUERTA BLINDADA Y CERRADURA     │
│     ÚNICA - Solo tú tienes la llave │
└─────────────────────────────────────┘
```

**El apartamento de tu competidor** (otro partner en Zirqulo):
```
┌─────────────────────────────────────┐
│  🏠 OTRO APARTAMENTO - "PARTNER_ABC" │
│                                     │
│  🛏️  SUS CLIENTES                   │
│  💼 SUS OPORTUNIDADES               │
│  📄 SUS DOCUMENTOS                  │
│  💰 SU INFORMACIÓN FINANCIERA       │
│                                     │
│  🔐 PUERTA BLINDADA Y CERRADURA     │
│     DIFERENTE - Tú NO tienes llave  │
└─────────────────────────────────────┘
```

**Las zonas comunes del edificio** (infraestructura compartida):
```
┌─────────────────────────────────────┐
│  🏛️  ZONAS COMUNES - "PUBLIC"       │
│                                     │
│  📋 Directorio del edificio:        │
│     - "Existe el Partner XYZ"       │
│     - "Existe el Partner ABC"       │
│     - "Existe el Partner DEF"       │
│                                     │
│  👷 Personal del edificio:           │
│     - Ana (trabaja en Partner XYZ)  │
│     - Luis (trabaja en Partner ABC) │
│     - Carlos (administrador Zirqulo)│
│                                     │
│  ⚙️  Infraestructura técnica:        │
│     - Sistema eléctrico              │
│     - Sistema de seguridad           │
│     - Ascensores y accesos           │
└─────────────────────────────────────┘
```

### ¿Qué significa esto en la práctica?

**✅ AISLAMIENTO TOTAL:** Así como no puedes entrar en el apartamento de tu vecino, otros partners **físicamente no pueden acceder** a tus datos comerciales:
- No ven tu lista de clientes finales que captaste
- No conocen tus comisiones ni cuánto ganas por operación
- No pueden ver tus documentos ni contratos
- No saben cuántas operaciones intermedias al mes
- No ven tu volumen de negocio

**✅ ZONAS COMUNES CONTROLADAS:** El personal del edificio (empleados) está registrado en zonas comunes, pero:
- Ana solo puede entrar a TU apartamento (Partner XYZ)
- Luis solo puede entrar al apartamento de Partner ABC
- Nadie puede entrar a dos apartamentos a la vez
- El portero (sistema) verifica la identidad en cada acceso

---

## 🔍 La Distinción Crítica: Empleados vs Clientes Finales

Este es el concepto MÁS IMPORTANTE para entender la protección de datos:

### 👥 EMPLEADOS (Infraestructura Compartida)

**¿Quiénes son?**
- Las personas que **trabajan** en tu tienda y usan Zirqulo
- Tus vendedores, gerentes, administradores
- Empleados de otros partners que también usan la plataforma

**¿Dónde están registrados?**
- En el schema "public" (zonas comunes del edificio)
- Es como el **directorio de empleados del edificio**

**Ejemplo:**
```
📋 DIRECTORIO DE EMPLEADOS (Schema "public")
├── Ana López (trabaja en Partner XYZ - tu tienda)
│   - Email: ana@tutienda.com
│   - Rol: Vendedora
│   - Partner asignado: XYZ ← SOLO puede acceder a TU apartamento
│
├── Luis García (trabaja en Partner ABC - competidor)
│   - Email: luis@competidor.com
│   - Rol: Gerente
│   - Partner asignado: ABC ← SOLO puede acceder a SU apartamento
│
└── Carlos Ruiz (administrador de Zirqulo)
    - Email: carlos@zirqulo.com
    - Rol: Admin
    - Acceso técnico para mantenimiento (bajo confidencialidad)
```

**¿Por qué están aquí?**
- Para poder **iniciar sesión** en la plataforma
- Para que el sistema sepa a qué partner pertenecen
- Para gestionar permisos y roles de forma centralizada

**¿Esto es un problema de seguridad?**
**NO**, porque:
1. Ana **nunca puede ver** los datos de Partner ABC
2. Luis **nunca puede ver** los datos de Partner XYZ
3. El sistema valida en **cada clic** que Ana pertenece a XYZ
4. Si Ana intenta acceder a datos de ABC, el sistema lo bloquea automáticamente

**Analogía:** Es como la lista de empleados en la recepción de un edificio de oficinas. El recepcionista sabe que Ana trabaja en la oficina 301 y Luis en la 405, pero eso no significa que Ana pueda entrar a la oficina de Luis. Necesita la llave específica.

### 🛍️ CLIENTES FINALES (Datos 100% Aislados)

**¿Quiénes son?**
- Las personas que **compran o venden** dispositivos en tu tienda
- Los que traen sus iPhones, Samsungs, iPads para valorar
- Tus clientes reales del día a día

**¿Dónde están registrados?**
- En **TU schema privado** (tu apartamento cerrado con llave)
- **Físicamente separados** de otros partners

**Ejemplo:**
```
🔐 SCHEMA "PARTNER_XYZ" (TU APARTAMENTO)
├── Laura Martínez ← Tu cliente que vendió iPhone 13 Pro
│   - DNI: 45678912B
│   - Teléfono: 612345678
│   - Dispositivo valorado: iPhone 13 Pro 128GB
│   - Precio pagado: 420€
│   - Conversación de chat
│   - Contrato B2C firmado
│   - Factura emitida
│
├── Miguel Torres ← Tu cliente con Samsung S23
│   - DNI: 78912345C
│   - Dispositivo: Samsung Galaxy S23
│   - En negociación: 380€
│
└── [150 clientes más...]
    ↓
    🔒 PROTECCIÓN ABSOLUTA
    - Otros partners NO PUEDEN VERLOS
    - Otros partners NI SIQUIERA SABEN que existen
    - Están físicamente aislados en bases de datos separadas
```

**Comparación Visual:**

```
┌────────────────────────────────────────────────────────────────┐
│                     NIVEL DE AISLAMIENTO                       │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  👥 EMPLEADOS (Schema "public")                                │
│  ├─ Compartido técnicamente                                    │
│  ├─ Pero con control de acceso ESTRICTO                        │
│  ├─ Como el directorio de un edificio                          │
│  └─ Cada empleado solo accede a SU partner                     │
│                                                                │
│  ════════════════════════════════════════════════════════════  │
│                        BARRERA FÍSICA                          │
│  ════════════════════════════════════════════════════════════  │
│                                                                │
│  🛍️ CLIENTES FINALES (Schema "partner_xyz")                    │
│  ├─ AISLAMIENTO TOTAL                                          │
│  ├─ Separación FÍSICA en base de datos                         │
│  ├─ Como apartamentos con puertas blindadas                    │
│  └─ IMPOSIBLE acceso entre partners                            │
│                                                                │
│  💼 OPORTUNIDADES DE VENTA (Schema "partner_xyz")              │
│  ├─ AISLAMIENTO TOTAL                                          │
│  └─ Información comercial sensible 100% privada                │
│                                                                │
│  📄 DOCUMENTOS Y FACTURAS (Schema "partner_xyz")               │
│  ├─ AISLAMIENTO TOTAL                                          │
│  └─ Documentos legales 100% privados                           │
│                                                                │
│  💰 INFORMACIÓN FINANCIERA (Schema "partner_xyz")              │
│  ├─ AISLAMIENTO TOTAL                                          │
│  └─ Precios, márgenes, comisiones 100% privados                │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## 🏗️ Arquitectura Técnica de Aislamiento

### Capa 1: Aislamiento Físico (La Más Importante)

```
🏗️ ARQUITECTURA DE BASE DE DATOS

PostgreSQL Server
│
├── 🌐 Schema "public"
│   ├── Tabla: usuarios
│   │   ├── Ana (partner_xyz)
│   │   └── Luis (partner_abc)
│   └── Tabla: partners
│       ├── Partner XYZ
│       └── Partner ABC
│
├── 🔐 Schema "partner_xyz"  ← TU ESPACIO PRIVADO
│   ├── Tabla: clientes ← 150 clientes TUYOS
│   ├── Tabla: oportunidades ← 45 dispositivos TUYOS
│   ├── Tabla: documentos ← Facturas TUYAS
│   └── Tabla: conversaciones ← Chats TUYOS
│
└── 🔐 Schema "partner_abc"  ← ESPACIO DEL COMPETIDOR
    ├── Tabla: clientes ← Sus clientes (TÚ NO PUEDES VER)
    ├── Tabla: oportunidades ← Sus dispositivos (BLOQUEADO)
    └── Tabla: documentos ← Sus facturas (INACCESIBLE)
```

**¿Qué significa "schema" técnicamente?**
- Piensa en un **schema** como un **contenedor completamente sellado** dentro de la base de datos
- Es como tener **bases de datos independientes** pero dentro del mismo servidor
- Las consultas SQL **no pueden cruzar** de un schema a otro sin permisos explícitos
- Es una separación **a nivel de sistema de archivos** en el servidor

**Ventajas de esta arquitectura:**
1. **Imposible acceso cruzado**: Una consulta en "partner_xyz" NUNCA puede leer datos de "partner_abc"
2. **Backups independientes**: Puedes hacer copias de seguridad solo de TUS datos
3. **Rendimiento aislado**: Si otro partner tiene problemas técnicos, no te afecta
4. **Cumplimiento legal**: Facilita cumplir con RGPD (datos separados físicamente)

---

## 🌐 Funcionalidad de "Oportunidades Globales"

### ¿Qué es y por qué existe?

Esta es una de las preguntas más frecuentes de los partners: **"Si los datos están aislados, ¿cómo funciona el sistema de oportunidades globales?"**

**Contexto de negocio:**
El modelo de Zirqulo Partners funciona así:
- **Tú (partner) eres el INTERMEDIARIO**: Un cliente llega a tu tienda queriendo vender su dispositivo
- **Zirqulo compra el dispositivo**: Nosotros compramos directamente al cliente final
- **Tú recibes comisión**: Por intermediar la operación

Zirqulo necesita acceder a las oportunidades para **gestionar la parte de la operación que nos corresponde**: compra del dispositivo, logística, pago al cliente, gestión de stock, reventa posterior.

### Ejemplo práctico del flujo real:

```
ESCENARIO: Cliente de tu tienda quiere vender un iPhone 14 Pro

┌─────────────────────────────────────────────────────────┐
│  PASO 1: TU TIENDA (Partner XYZ)                        │
├─────────────────────────────────────────────────────────┤
│  • Cliente: Laura Martínez llega con iPhone 14 Pro     │
│  • Tú (partner): Valoras el dispositivo en Zirqulo      │
│  • Sistema: Crea oportunidad en TU schema privado       │
│  • Cliente: Acepta vender por 450€                      │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│  PASO 2: ZIRQULO GESTIONA SU PARTE                      │
├─────────────────────────────────────────────────────────┤
│  🏢 Zirqulo Admin accede a la oportunidad para:         │
│     • Confirmar que compramos el dispositivo            │
│     • Coordinar logística (recogida/envío)              │
│     • Gestionar pago al cliente final (450€)            │
│     • Procesar dispositivo en nuestro almacén           │
│     • Calcular tu comisión (ej: 50€)                    │
└─────────────────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────────────────┐
│  PASO 3: RESULTADO FINAL                                │
├─────────────────────────────────────────────────────────┤
│  ✅ Cliente Laura: Recibe 450€ de Zirqulo               │
│  ✅ Partner XYZ (tú): Recibes 50€ de comisión           │
│  ✅ Zirqulo: Compra el iPhone, lo procesa y revende     │
└─────────────────────────────────────────────────────────┘
```

### ¿Qué puede ver Zirqulo Admin exactamente?

**✅ SÍ PUEDEN VER (necesario para operar):**
- **Información del dispositivo**: Marca, modelo, IMEI, capacidad, grado de estado
- **Estado de la oportunidad**: Pendiente, valorado, aceptado, comprado, entregado
- **Información del cliente final** (el que vende el dispositivo):
  - Nombre y contacto (para coordinar logística y pago)
  - DNI (para cumplimiento legal en la compra)
  - Datos bancarios (para realizar el pago)
  - Dirección (si hay envío)
- **Precio de compra**: Lo que Zirqulo paga al cliente final
- **Comisión del partner**: Lo que te corresponde por la intermediación
- **Documentación**: Contratos, facturas, albaranes de la operación

**❌ NO COMPARTEN CON COMPETIDORES:**
- Aunque Zirqulo Admin ve tus oportunidades, **NUNCA** comparten esta información con otros partners competidores
- Otros partners NO pueden ver tus operaciones, ni tus clientes, ni tus comisiones

### ¿Por qué Zirqulo ve datos del cliente final?

Porque **Zirqulo es quien compra el dispositivo**, no tú. En términos legales:

```
RELACIÓN COMERCIAL REAL:

Cliente Final (Laura)
    ↓ Quiere vender iPhone
Partner XYZ (tú)
    ↓ Intermedias (comisión)
Zirqulo
    ↓ Compra el dispositivo
Cliente Final (Laura)
    ↓ Recibe pago de Zirqulo

Resultado:
• Laura vende a Zirqulo (NO a ti)
• Tú intermedias la operación
• Zirqulo necesita datos de Laura para:
  - Formalizar la compra legal
  - Coordinar logística
  - Realizar pago
```

### ¿Qué garantías tienes?

1. **Acuerdos de confidencialidad**: El equipo de Zirqulo está legalmente obligado a NO compartir información entre partners competidores

2. **Rol de "encargado del tratamiento"**: Zirqulo actúa bajo RGPD como responsable de proteger los datos

3. **Auditorías**: Sistema de logs que registra quién accede a qué datos y cuándo

4. **Propósito limitado**: Zirqulo accede SOLO para:
   - Gestionar la compra del dispositivo
   - Coordinar logística
   - Realizar pagos
   - Calcular comisiones
   - Cumplimiento legal
   - **NO para análisis comercial competitivo ni para favorecer a otros partners**

5. **Separación de datos**: Aunque Admin puede acceder técnicamente, tu información comercial (cuántas operaciones haces, qué volumen mueves, etc.) **no se comparte con competidores**

---

## ✅ Cumplimiento Legal: RGPD y LOPDGDD

### ¿Qué significa el RGPD para ti como partner?

El **Reglamento General de Protección de Datos (RGPD)** es la ley europea que protege la información personal. Como partner de Zirqulo, tienes **dos roles**:

```
TU DOBLE ROL LEGAL:

┌──────────────────────────────────────────────┐
│  1. RESPONSABLE DEL TRATAMIENTO             │
│     (Para TUS clientes finales)              │
├──────────────────────────────────────────────┤
│  TÚ decides:                                 │
│  • Qué datos recoger de tus clientes        │
│  • Para qué usarlos (venta/compra)          │
│  • Cuánto tiempo guardarlos                 │
│                                              │
│  TÚ eres responsable legalmente ante:       │
│  • Tus clientes                              │
│  • La Agencia Española de Protección de Datos│
└──────────────────────────────────────────────┘
                    ↕
┌──────────────────────────────────────────────┐
│  2. USUARIO DE ZIRQULO                       │
│     (Tus datos en la plataforma)             │
├──────────────────────────────────────────────┤
│  ZIRQULO decide:                             │
│  • Cómo almacenar técnicamente los datos    │
│  • Qué medidas de seguridad aplicar         │
│  • Dónde están los servidores (UE)          │
│                                              │
│  ZIRQULO es responsable legalmente de:      │
│  • La seguridad de la plataforma            │
│  • Proteger datos contra accesos no autorizados │
│  • Cumplir estándares técnicos de RGPD      │
└──────────────────────────────────────────────┘
```

### Derechos de tus clientes finales (RGPD)

Cuando un cliente te vende un dispositivo y firmas un contrato B2C, ese cliente tiene estos derechos:

```
DERECHOS DEL CLIENTE FINAL:

🔍 DERECHO DE ACCESO
   "Quiero saber qué datos tuyos tenéis sobre mí"
   → Puedes generar un informe desde Zirqulo con todos sus datos

🔧 DERECHO DE RECTIFICACIÓN
   "Mi teléfono ha cambiado, actualizadlo"
   → Puedes editar sus datos en la plataforma

🗑️ DERECHO DE SUPRESIÓN ("Derecho al olvido")
   "Quiero que borréis todos mis datos"
   → Puedes eliminar su registro (si no hay obligaciones legales)

📦 DERECHO DE PORTABILIDAD
   "Quiero mis datos en formato digital"
   → Puedes exportar sus datos en CSV/PDF

🚫 DERECHO DE OPOSICIÓN
   "No quiero recibir más comunicaciones"
   → Puedes marcar "no contactar" en su perfil

⚖️ DERECHO A NO SER OBJETO DE DECISIONES AUTOMATIZADAS
   "No quiero que un algoritmo decida sobre mí"
   → Todas las valoraciones en Zirqulo requieren aprobación humana
```

### ¿Cómo ayuda Zirqulo a cumplir con RGPD?

**1. Consentimientos documentados (Contratos B2C)**
```
Cuando un cliente firma en Zirqulo, se registra:
✅ Consentimiento para tratar sus datos personales
✅ Consentimiento para valorar su dispositivo
✅ Consentimiento para enviar comunicaciones comerciales (opcional)
✅ Fecha y hora de firma digital
✅ IP desde donde firmó
```

**2. Minimización de datos**
```
Solo se recogen datos NECESARIOS:
✅ Nombre, DNI → Para identificar al cliente y contrato
✅ Teléfono, email → Para comunicaciones sobre la venta
✅ Dirección → Si hay envío de dispositivo
✅ Datos bancarios → Si se hace transferencia

❌ NO se recogen:
❌ Datos médicos
❌ Datos de menores (sin tutor)
❌ Datos innecesarios
```

**3. Política de retención**
```
Datos durante vida del cliente:
✅ Información personal y comercial (mientras es cliente activo)

Datos después de inactividad:
⏳ Tras 3 años sin actividad → Notificación de borrado
⏳ Tras 5 años sin actividad → Borrado automático (salvo obligaciones legales)

Excepciones legales:
📄 Facturas y documentos fiscales → 7 años (Ley General Tributaria)
📄 Contratos B2C → 5 años (Ley de Consumidores)
```

### LOPDGDD (Ley española adicional al RGPD)

**Requisitos específicos de España:**

```
✅ Servidores en Unión Europea
   → Los datos NO salen de territorio europeo
   → Mayor protección legal para clientes españoles

✅ Contrato de Encargado de Tratamiento (DPA)
   → Documento legal entre tú y Zirqulo
   → Define responsabilidades de cada parte
   → Disponible bajo solicitud

✅ Notificación de brechas de seguridad
   → Si hay incidente, notificación en <72 horas
   → Tanto a partners afectados como a autoridades

✅ Delegado de Protección de Datos (DPO)
   → Figura responsable de supervisar cumplimiento
   → Punto de contacto para dudas legales
```

---

## 🤝 Responsabilidades Compartidas: Tu Parte y la Nuestra

### Modelo de Responsabilidad Compartida

```
┌────────────────────────────────────────────────────────┐
│           RESPONSABILIDADES DE ZIRQULO                 │
│              (Nosotros cuidamos de...)                 │
├────────────────────────────────────────────────────────┤
│  🏗️  INFRAESTRUCTURA                                   │
│  ├─ Servidores seguros y actualizados                  │
│  ├─ Aislamiento multi-tenant con schemas separados     │
│  ├─ Cifrado de datos en reposo y en tránsito          │
│  ├─ Backups automáticos multi-nivel                    │
│  └─ Monitoreo 24/7 de seguridad                       │
│                                                        │
│  ⚖️  CUMPLIMIENTO LEGAL                                 │
│  ├─ Cumplimiento RGPD como "encargado del tratamiento"│
│  ├─ Contratos de DPA disponibles                       │
│  ├─ Notificación de brechas en <72 horas              │
│  ├─ Cooperación con autoridades si es necesario        │
│  └─ Documentación y registros de actividad             │
│                                                        │
│  📊 AISLAMIENTO DE DATOS                                │
│  ├─ Separación física de datos comerciales             │
│  ├─ Control de acceso estricto entre partners          │
│  ├─ Imposibilidad técnica de acceso cruzado            │
│  └─ Auditorías de acceso a datos sensibles             │
└────────────────────────────────────────────────────────┘

════════════════════════════════════════════════════════

┌────────────────────────────────────────────────────────┐
│           RESPONSABILIDADES DEL PARTNER                │
│              (Tú debes cuidar de...)                   │
├────────────────────────────────────────────────────────┤
│  👥 GESTIÓN DE EMPLEADOS                                │
│  ├─ Asignar permisos mínimos necesarios (principio de │
│  │  menor privilegio)                                  │
│  ├─ Revisar periódicamente quién tiene acceso          │
│  ├─ Capacitar a empleados en buenas prácticas          │
│  └─ Desactivar usuarios cuando dejen la empresa        │
│                                                        │
│  ⚖️  CUMPLIMIENTO LEGAL (Tu parte)                      │
│  ├─ Cumplir RGPD como "responsable del tratamiento"   │
│  │  para tus clientes finales                          │
│  ├─ Informar a tus clientes sobre el uso de sus datos │
│  ├─ Obtener consentimientos cuando sea necesario       │
│  ├─ Atender derechos de clientes (acceso, rectificación)│
│  └─ Mantener documentación de tratamientos             │
│                                                        │
│  📋 GESTIÓN DE DATOS                                    │
│  ├─ No exportar datos masivamente sin justificación    │
│  ├─ Proteger exportaciones de datos sensibles          │
│  ├─ Borrar datos cuando sea legalmente requerido       │
│  └─ Documentar tratamientos de datos personales        │
└────────────────────────────────────────────────────────┘
```

---

## ❓ Preguntas Frecuentes sobre Protección de Datos

### P: Mi competidor directo también usa Zirqulo. ¿Puede ver que acabo de intermediar 10 operaciones de iPhones 14 Pro este mes?

**R:** NO. Tu competidor NO puede ver:
- Que has intermediado 10 operaciones (o cualquier cantidad)
- Qué dispositivos estás gestionando
- Qué comisiones recibes por operación
- Quiénes son los clientes finales que captaste
- Cuántas operaciones intermedias al mes
- Tu volumen de negocio

Tus clientes y operaciones están en TU schema privado ("partner_xyz"). Tu competidor está en otro schema diferente ("partner_abc"). Es físicamente imposible que acceda a tu información.

---

### P: ¿Qué datos exactos están en el schema compartido "public"?

**R:** Solo datos de **infraestructura**, nunca datos **comerciales sensibles**:

```
SCHEMA "PUBLIC" (Compartido):
├── Usuarios de la plataforma
│   ├── Ana López → Trabaja en Partner XYZ
│   ├── Luis García → Trabaja en Partner ABC
│   └── [Nota: Son EMPLEADOS, no clientes finales]
│
├── Información básica de partners
│   ├── Partner XYZ existe
│   ├── Partner ABC existe
│   └── [Nota: Solo metadatos, sin datos comerciales]
│
└── Configuración técnica
    ├── Versión de la plataforma
    ├── Parámetros del sistema
    └── Catálogo de dispositivos (marcas/modelos generales)
```

Lo que **NO está aquí** (está aislado en tu schema privado):
- Clientes finales que compran/venden dispositivos
- Oportunidades de venta y valoraciones
- Documentos comerciales
- Información financiera
- Conversaciones de chat
- Datos sensibles de negocio

---

### P: ¿Zirqulo puede "espiar" mis datos para ayudar a mi competidor?

**R:** NO, por múltiples razones:

**1. Obligaciones legales**
- Zirqulo actúa como "encargado del tratamiento" bajo RGPD
- Existe un contrato (DPA - Data Processing Agreement) que prohíbe el uso indebido de datos
- Violar este contrato implica sanciones legales severas (hasta el 4% de facturación anual o 20M€)

**2. Reputación y modelo de negocio**
- Zirqulo vive de la CONFIANZA de los partners
- Si se descubre que comparten datos entre competidores, el negocio colapsaría
- Perderían todos los partners inmediatamente

**3. Auditorías técnicas**
- Todos los accesos quedan registrados en logs
- Se puede auditar quién accedió a qué datos y cuándo
- En caso de disputa, estos logs son evidencia legal

---

### P: Si Zirqulo quiebra o cierra, ¿pierdo todos mis datos?

**R:** NO, tienes varias protecciones:

**1. Derecho de portabilidad (RGPD)**
- Puedes solicitar exportación completa de tus datos en cualquier momento
- Formato estándar (CSV, JSON) para importar en otro sistema

**2. Backups independientes (recomendado)**
- Puedes hacer exportaciones periódicas preventivas
- Guarda copias de tus datos comerciales críticos

**3. Periodo de transición**
- Incluso en caso de cierre, Zirqulo debe dar un periodo de aviso (normalmente 3-6 meses según contrato)
- Tiempo suficiente para exportar datos y migrar a otra plataforma

---

### P: ¿Necesito un DPO (Delegado de Protección de Datos) en mi empresa?

**R:** Depende del tamaño y actividad de tu negocio:

```
OBLIGATORIO tener DPO si:
✅ Eres una autoridad pública
✅ Tus actividades principales requieren monitoreo regular y sistemático
   de personas a gran escala
✅ Tratas datos sensibles a gran escala (salud, raza, orientación sexual)

OPCIONAL (pero recomendado) si:
⚠️ Tienes más de 250 empleados
⚠️ Tratas datos de miles de clientes regularmente
⚠️ Realizas transferencias internacionales de datos

NO OBLIGATORIO si:
❌ Tienda pequeña con <50 empleados
❌ Tratas datos básicos (nombre, DNI, teléfono para compraventas)
❌ No haces perfilado ni decisiones automatizadas complejas
```

---

## 📝 Resumen Ejecutivo

Si solo tienes 2 minutos, esto es lo que DEBES saber:

```
┌─────────────────────────────────────────────────────────────┐
│  🔐 AISLAMIENTO TOTAL DE DATOS COMERCIALES                  │
├─────────────────────────────────────────────────────────────┤
│  ✅ TUS CLIENTES FINALES: Separados físicamente en tu       │
│     schema privado. Otros partners NO PUEDEN VERLOS.        │
│                                                             │
│  ✅ TUS OPORTUNIDADES: 100% privadas. Tu competidor NO      │
│     sabe qué dispositivos tienes ni a qué precios.          │
│                                                             │
│  ✅ TUS DOCUMENTOS Y FINANZAS: Aislados completamente.      │
│     Tu información comercial sensible está protegida.       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  👥 EMPLEADOS EN INFRAESTRUCTURA COMPARTIDA                 │
├─────────────────────────────────────────────────────────────┤
│  ⚠️ Los empleados (usuarios de la plataforma) están         │
│     técnicamente en un espacio compartido "public"...       │
│                                                             │
│  ✅ PERO con control de acceso ESTRICTO: Cada empleado solo │
│     puede ver y editar datos de SU propio partner.          │
│                                                             │
│  ✅ Es como un directorio de edificio: todos en la lista,   │
│     pero cada uno solo abre SU puerta.                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  ⚖️ CUMPLIMIENTO LEGAL                                       │
├─────────────────────────────────────────────────────────────┤
│  ✅ RGPD compliant (derechos de clientes, portabilidad)     │
│  ✅ LOPDGDD (servidores en UE, notificación de brechas)     │
│  ✅ DPA disponible (contrato de encargado de tratamiento)   │
│  ✅ Arquitectura multi-tenant con separación física         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎓 Conclusión

Zirqulo Partners está diseñado desde cero con un principio fundamental: **Tu competidor es tu competidor, no tu compañero de base de datos**.

La arquitectura multi-tenant con separación física de schemas garantiza que:
- Tus clientes finales están tan protegidos como si estuvieran en un Excel en tu ordenador local (incluso más, gracias a backups y cifrado)
- Tu información comercial sensible es inaccesible para otros partners
- Cumples con las leyes europeas de protección de datos sin esfuerzo adicional

**Si después de leer esta guía tienes dudas sobre protección de datos**, contacta con:
- 📧 Email: dpo@zirqulo.com (Delegado de Protección de Datos)
- 📧 Email: legal@zirqulo.com (Consultas legales y DPA)

---

**Última actualización**: Octubre 2025
**Versión del documento**: 3.0
**Plataforma**: Next.js 15 + Django 5 Multi-Tenant (django-tenants)
