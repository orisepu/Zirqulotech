# Seguridad en Zirqulo Partners
**Guía para Partners: Sistemas de Seguridad, Autenticación y Protección contra Amenazas**

---

## Introducción: Seguridad Multi-Capa

La seguridad de Zirqulo Partners se basa en un sistema de **3 capas de protección**:

1. **Autenticación y control de acceso** - Quién eres y qué puedes hacer
2. **Seguridad basada en ubicación** - Detección de accesos sospechosos
3. **Respuesta a incidentes** - Qué hacemos si algo sale mal

Esta guía explica cómo funcionan estos sistemas y qué medidas tomas tú como partner para mantener tu cuenta segura.

---

## 🔐 Sistema de Autenticación: Tu Llave Digital

### El Flujo de Autenticación

Cuando tú o tu empleado Ana abre Zirqulo por la mañana:

```
PASO 1: LOGIN
Ana introduce:
  - Email: ana@tutienda.com
  - Contraseña: ********
    ↓
PASO 2: VERIFICACIÓN
Sistema busca en "public":
  ✅ Ana existe
  ✅ Contraseña correcta
  ✅ Ana pertenece a Partner XYZ
    ↓
PASO 3: VERIFICACIÓN DE UBICACIÓN 🆕
Sistema de seguridad GeoLite2:
  📍 Obtiene ubicación desde IP
  ✅ Madrid, España
  🔍 Compara con último login: Madrid, España (hace 1 día)
  ✅ Ubicación normal, permitir acceso
    ↓
PASO 4: GENERACIÓN DE TOKEN (Llave digital)
Sistema genera un "token JWT" que contiene:
  - Identidad: Ana López
  - Partner: XYZ
  - Permisos: Vendedora
  - Caducidad: 24 horas
  - Firma digital: [imposible de falsificar]
    ↓
PASO 5: CADA ACCIÓN POSTERIOR
Ana hace clic en "Ver clientes"
Sistema verifica:
  ✅ Token válido (no expirado)
  ✅ Ana pertenece a Partner XYZ
  ✅ Abre SOLO el schema "partner_xyz"
  ✅ Muestra SOLO clientes de XYZ
```

### Analogía del Token JWT: Tu Pulsera de Hotel

Imagina que el token es como una **pulsera electrónica de un hotel todo incluido**:

```
🎫 PULSERA DE ANA (Token JWT)
┌──────────────────────────────┐
│  Nombre: Ana López           │
│  Habitación: 301 (Partner XYZ)│
│  Válida hasta: Mañana 10:00  │
│  Permisos:                   │
│    ✅ Acceso piscina          │
│    ✅ Acceso restaurante      │
│    ✅ Acceso habitación 301   │
│    ❌ NO acceso habitación 405│
│  Código cifrado: [seguro]    │
└──────────────────────────────┘
```

- **No puedes falsificarla**: Tiene un chip de seguridad (firma digital)
- **Caduca automáticamente**: Después de 24 horas debes renovarla
- **Identifica tu habitación**: Solo abre TU puerta, no otras
- **Se valida en cada acceso**: Cada vez que la usas, el sistema verifica que sea válida

---

## 📍 Seguridad Basada en Ubicación (GeoLite2)

### ¿Qué es y cómo funciona?

Zirqulo Partners implementa un sistema de **detección de logins sospechosos** basado en tu ubicación geográfica. Cada vez que inicias sesión, el sistema:

1. **Detecta tu ubicación** mediante tu dirección IP (usando base de datos GeoLite2)
2. **Compara** con tu último login conocido
3. **Evalúa** si el login es sospechoso o normal

### Escenarios de Seguridad

#### Escenario 1: Login Normal ✅

```
MARTES 10:00 AM
Ana hace login desde:
  📍 Madrid, España (IP: 185.43.xxx.xxx)

Último login de Ana:
  📍 Madrid, España (hace 1 día)

RESULTADO:
✅ Login permitido sin restricciones
📝 Historial actualizado
```

#### Escenario 2: Login desde País Diferente ⚠️

```
MIÉRCOLES 15:00 PM
Ana hace login desde:
  📍 París, Francia (IP: 82.127.xxx.xxx)

Último login de Ana:
  📍 Madrid, España (hace 1 día)

ANÁLISIS DEL SISTEMA:
⚠️ País diferente detectado (España → Francia)
📧 Sistema envía email a Ana:
   "Hemos detectado un login desde una ubicación inusual.
    Si no fuiste tú, cambia tu contraseña inmediatamente."

RESULTADO:
🔐 Requiere verificación adicional (2FA)
📝 Login registrado con alerta
```

#### Escenario 3: Viaje Imposible 🚨

```
JUEVES 09:00 AM
Ana hace login desde:
  📍 Tokio, Japón (IP: 203.104.xxx.xxx)

Último login de Ana:
  📍 Madrid, España (hace 3 horas)

ANÁLISIS DEL SISTEMA:
📏 Distancia: 10,800 km
⏱️ Tiempo transcurrido: 3 horas
🚫 Velocidad necesaria: 3,600 km/h (imposible)

Umbrales configurados:
  - Distancia mínima: 500 km
  - Tiempo máximo: 4 horas
  - Conclusión: VIAJE IMPOSIBLE

RESULTADO:
🚨 LOGIN BLOQUEADO
📧 Email urgente a Ana:
   "Tu cuenta ha sido bloqueada por razones de seguridad.
    Se detectó un acceso desde Tokio, Japón.
    Contacta con soporte si necesitas ayuda."
📞 Notificación al administrador del partner
```

### Configuración del Sistema

```
UMBRALES DE SEGURIDAD (Configurables en settings.py):

┌─────────────────────────────────────────────┐
│  LOCATION_ALERT_THRESHOLD_KM = 500          │
│  → Si te mueves más de 500 km, se envía    │
│     alerta (pero se permite login)          │
│                                             │
│  LOCATION_ALERT_THRESHOLD_HOURS = 4         │
│  → Si te mueves 500+ km en menos de 4      │
│     horas, se BLOQUEA el login              │
│                                             │
│  LOCATION_SECURITY_ENABLED = True           │
│  → Sistema activado por defecto            │
└─────────────────────────────────────────────┘
```

### Base de Datos GeoLite2

El sistema usa la base de datos **GeoLite2-City** de MaxMind:

```
CARACTERÍSTICAS:
✅ Gratuita (bajo licencia Creative Commons)
✅ Precisión: ~70% a nivel de ciudad
✅ Actualización: Mensual
✅ Tamaño: ~70 MB
✅ Privacidad: Funciona localmente (no envía datos a terceros)

DESCARGA AUTOMÁTICA:
$ python manage.py download_geoip
  → Descarga y extrae GeoLite2-City.mmdb
  → Se puede ejecutar mensualmente para actualizar
```

### Historial de Logins

Todos los logins quedan registrados en la tabla `LoginHistory`:

```sql
LoginHistory:
├── user: Ana López
├── ip: 185.43.xxx.xxx
├── country: España
├── city: Madrid
├── latitude: 40.4168
├── longitude: -3.7038
├── timestamp: 2025-10-03 10:15:23
├── was_blocked: False
├── block_reason: NULL
├── alert_sent: False
└── user_agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)...
```

Este historial permite:
- Auditar accesos a tu cuenta
- Detectar patrones sospechosos
- Investigar incidentes de seguridad
- Generar reportes de actividad

---

## 🛡️ Las 3 Capas de Protección

### Capa 1: Control de Acceso (Validación Continua)

```
CADA VEZ QUE HACES ALGO EN ZIRQULO:

Ana hace clic en "Ver cliente #12345"
  ↓
┌────────────────────────────────────┐
│  🔍 VALIDACIÓN DEL SISTEMA         │
├────────────────────────────────────┤
│  1. ¿Token válido?                 │
│     ✅ Sí, no ha expirado          │
│                                    │
│  2. ¿A qué partner pertenece Ana?  │
│     ✅ Partner XYZ                 │
│                                    │
│  3. ¿En qué schema está cliente #12345? │
│     ✅ En schema "partner_xyz"     │
│                                    │
│  4. ¿Coinciden partner y schema?   │
│     ✅ Sí, ambos son XYZ           │
│                                    │
│  5. ¿Ana tiene permisos?           │
│     ✅ Sí, rol "vendedora"         │
│                                    │
│  RESULTADO: ✅ ACCESO PERMITIDO    │
└────────────────────────────────────┘
```

**Si Ana intenta hacer trampa:**

```
Ana modifica manualmente la URL:
/clientes/12345 → /clientes/67890
(Cliente 67890 pertenece a Partner ABC)
  ↓
┌────────────────────────────────────┐
│  🚨 VALIDACIÓN DEL SISTEMA         │
├────────────────────────────────────┤
│  1. ¿Token válido?                 │
│     ✅ Sí                           │
│                                    │
│  2. ¿A qué partner pertenece Ana?  │
│     ✅ Partner XYZ                 │
│                                    │
│  3. ¿En qué schema está cliente #67890? │
│     ❌ En schema "partner_abc"     │
│                                    │
│  4. ¿Coinciden partner y schema?   │
│     ❌ NO - Ana es XYZ, cliente es ABC │
│                                    │
│  RESULTADO: ❌ ACCESO DENEGADO     │
│  Error: "Recurso no encontrado"   │
└────────────────────────────────────┘
```

### Capa 2: Cifrado de Comunicaciones (HTTPS)

```
CUANDO ACCEDES A ZIRQULO DESDE TU ORDENADOR:

Tu navegador                    Servidor Zirqulo
    │                                 │
    │  "Quiero ver cliente #12345"    │
    │─────────────────────────────────►│
    │     [MENSAJE CIFRADO]            │
    │     🔒 Solo descifrable con      │
    │        clave del servidor        │
    │                                  │
    │◄─────────────────────────────────│
    │  "Aquí están los datos"          │
    │     [RESPUESTA CIFRADA]          │
    │     🔒 Solo descifrable con      │
    │        clave de tu navegador     │
```

**¿Por qué es importante el cifrado HTTPS?**
- Si alguien "escucha" la red WiFi, **solo ve datos encriptados**
- Protege contra ataques "man-in-the-middle" (intermediarios maliciosos)
- Garantiza que estás hablando con el servidor real de Zirqulo, no una copia falsa

### Capa 3: Cifrado de Datos Sensibles

```
DATOS CIFRADOS EN REPOSO:
🔒 Contraseñas (hash irreversible - bcrypt/argon2)
🔒 Datos bancarios (cifrado AES-256)
🔒 DNI/NIE (cifrado en base de datos)
🔒 Tokens de API (cifrado y rotación periódica)

DATOS CIFRADOS EN TRÁNSITO:
🔒 HTTPS en todas las comunicaciones
🔒 TLS 1.3 (protocolo más moderno)
🔒 Conexiones API seguras
```

---

## 🚨 Protocolo de Respuesta ante Incidentes

### ¿Qué pasa si hay un problema de seguridad?

Aunque la arquitectura está diseñada para prevenir incidentes, Zirqulo tiene un **protocolo de respuesta inmediata**:

```
FASE 1: DETECCIÓN (Minutos 0-15)
┌──────────────────────────────────────┐
│  🔍 Sistemas de monitoreo 24/7       │
│  ├─ Detección de accesos anómalos    │
│  ├─ Alertas automáticas              │
│  └─ Equipo técnico notificado        │
└──────────────────────────────────────┘
         ↓

FASE 2: CONTENCIÓN (Minutos 15-60)
┌──────────────────────────────────────┐
│  🛑 Aislamiento del problema          │
│  ├─ Bloqueo de cuentas comprometidas │
│  ├─ Cierre de vectores de ataque     │
│  └─ Preservación de evidencias       │
└──────────────────────────────────────┘
         ↓

FASE 3: INVESTIGACIÓN (Horas 1-24)
┌──────────────────────────────────────┐
│  🔬 Análisis forense                  │
│  ├─ ¿Qué datos fueron accedidos?     │
│  ├─ ¿Cuántos partners afectados?     │
│  └─ ¿Qué causó el incidente?         │
└──────────────────────────────────────┘
         ↓

FASE 4: NOTIFICACIÓN (< 72 horas)
┌──────────────────────────────────────┐
│  📢 Comunicación oficial              │
│  ├─ Notificación a partners afectados│
│  ├─ Notificación a AEPD si procede   │
│  └─ Informe detallado del incidente  │
└──────────────────────────────────────┘
         ↓

FASE 5: REMEDIACIÓN (Semanas 1-2)
┌──────────────────────────────────────┐
│  🔧 Corrección y prevención           │
│  ├─ Parches de seguridad             │
│  ├─ Mejoras en sistemas              │
│  └─ Auditoría completa               │
└──────────────────────────────────────┘
         ↓

FASE 6: POST-MORTEM (Mes 1)
┌──────────────────────────────────────┐
│  📝 Documentación y aprendizaje       │
│  ├─ Informe público (si procede)     │
│  ├─ Lecciones aprendidas             │
│  └─ Actualización de protocolos      │
└──────────────────────────────────────┘
```

### Ejemplos de Incidentes y Respuestas

**Escenario 1: Intento de acceso no autorizado**
```
🚨 INCIDENTE: Detección de 50 intentos fallidos de login en 5 minutos
   desde una IP sospechosa

RESPUESTA AUTOMÁTICA:
✅ Bloqueo de IP automático tras 10 intentos
✅ CAPTCHA activado para esa región
✅ Alerta al equipo de seguridad

IMPACTO: ❌ NINGUNO - El atacante no consiguió acceder
NOTIFICACIÓN: No requiere notificación (ataque bloqueado)
```

**Escenario 2: Empleado con credenciales comprometidas**
```
🚨 INCIDENTE: La contraseña de Ana fue filtrada en un hackeo de otra
   plataforma (reutilización de contraseña)

RESPUESTA:
1️⃣ Sistema GeoLite2 detecta login desde ubicación inusual (Rusia)
2️⃣ Se requiere verificación adicional (2FA)
3️⃣ Se invalidan todos los tokens de Ana
4️⃣ Se fuerza cambio de contraseña
5️⃣ Notificación a Ana y al administrador del partner

IMPACTO: ⚠️ BAJO - Acceso bloqueado antes de que se accediera a datos
NOTIFICACIÓN: Al partner afectado (no a otros partners)
```

**Escenario 3: Vulnerabilidad en biblioteca externa**
```
🚨 INCIDENTE: Se descubre una vulnerabilidad crítica en una librería
   de Node.js usada por Zirqulo

RESPUESTA:
1️⃣ Evaluación de impacto (¿afecta a Zirqulo?)
2️⃣ Actualización urgente de dependencias
3️⃣ Análisis de logs (¿fue explotada?)
4️⃣ Despliegue de parche en <6 horas
5️⃣ Notificación preventiva a partners

IMPACTO: ✅ NINGUNO - Parcheado antes de explotación
NOTIFICACIÓN: Informativa (transparencia preventiva)
```

---

## 🛡️ Backups y Recuperación de Datos

### Sistema de Copias de Seguridad

```
ESTRATEGIA DE BACKUPS MULTI-NIVEL:

┌─────────────────────────────────────────────────────────┐
│  📦 NIVEL 1: Backups Continuos (Cada 15 minutos)       │
│  ├─ Replicación en tiempo real a servidor secundario   │
│  ├─ Recovery Point Objective (RPO): 15 minutos         │
│  └─ Recovery Time Objective (RTO): 1 hora              │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  📦 NIVEL 2: Backups Diarios (Cada noche a las 3 AM)   │
│  ├─ Snapshot completo de todos los schemas             │
│  ├─ Retención: 30 días                                 │
│  └─ Permite recuperar estado de cualquier día del mes  │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  📦 NIVEL 3: Backups Semanales (Cada domingo)          │
│  ├─ Copia archivada a largo plazo                      │
│  ├─ Retención: 3 meses                                 │
│  └─ Almacenamiento geográficamente distribuido         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  📦 NIVEL 4: Backups Mensuales (Primer día del mes)    │
│  ├─ Archivo histórico para auditorías                  │
│  ├─ Retención: 1 año                                   │
│  └─ Cumplimiento de normativas fiscales                │
└─────────────────────────────────────────────────────────┘
```

### ¿Qué pasa si borras algo por error?

**Ejemplo práctico:**

```
MARTES 10:30 AM
Ana borra por error el cliente #12345 (Laura Martínez)
↓
¿ESTÁ PERDIDO PARA SIEMPRE?

❌ NO - Se puede recuperar:

OPCIÓN 1: Papelera temporal (< 30 días)
  ├─ Los datos "borrados" van a una papelera
  ├─ Puedes restaurarlos tú mismo desde el panel
  └─ Periodo de gracia: 30 días

OPCIÓN 2: Backup diario (< 30 días)
  ├─ Contactas con soporte técnico
  ├─ Especificas: "Cliente #12345, borrado el 3/10 a las 10:30"
  └─ Se restaura desde el backup de esa noche

OPCIÓN 3: Backup semanal/mensual (> 30 días)
  ├─ Para datos más antiguos
  ├─ Proceso manual de recuperación
  └─ Tiempo de recuperación: 24-48 horas
```

### Escenarios de Desastre

**Escenario extremo: ¿Qué pasa si el servidor principal falla?**

```
PLAN DE CONTINUIDAD DE NEGOCIO:

🖥️ SERVIDOR PRINCIPAL (España)
   │  [FALLO CATASTRÓFICO]
   │
   ↓ Detección automática en 60 segundos
   ↓
🔄 FAILOVER AUTOMÁTICO
   │
   ↓ Redirección de tráfico (3-5 minutos)
   ↓
🖥️ SERVIDOR SECUNDARIO (Otro datacenter UE)
   │  ✅ Réplica completa de datos
   │  ✅ Mismo nivel de seguridad
   │  ✅ Funcionalidad completa
   │
   └─→ Servicio restaurado
       Tiempo total de inactividad: 5-10 minutos
```

---

## 🤝 Tu Responsabilidad: Buenas Prácticas de Seguridad

### Contraseñas Seguras

```
✅ BUENA CONTRASEÑA:
   "Mi tienda abrió en 2018 y vendemos iPhones!"
   → M1t13nd@abr10en2018yv3nd3m0s1Ph0n3s!

   Características:
   ✅ Más de 12 caracteres
   ✅ Mayúsculas y minúsculas mezcladas
   ✅ Números incluidos
   ✅ Símbolos especiales (@, !, #, etc.)
   ✅ Única (no usada en otras plataformas)
   ✅ Memorable para ti

❌ MALA CONTRASEÑA:
   "123456"
   "tienda2024"
   "admin123"
   "mimismapassworddetodo"
```

### Gestión de Empleados

```
EMPLEADO NUEVO (Ana - Vendedora)
┌────────────────────────────────────┐
│  Permisos recomendados:            │
│  ✅ Ver clientes                   │
│  ✅ Crear oportunidades            │
│  ✅ Editar valoraciones            │
│  ❌ Eliminar clientes (solo gerente)│
│  ❌ Cambiar configuración (solo admin)│
│  ❌ Ver información financiera global│
└────────────────────────────────────┘

EMPLEADO QUE DEJA LA EMPRESA
┌────────────────────────────────────┐
│  Checklist de seguridad:           │
│  ☑ Desactivar usuario INMEDIATAMENTE│
│  ☑ Invalidar sesiones activas      │
│  ☑ Cambiar contraseñas compartidas │
│     (si las había - no debería)    │
│  ☑ Revisar logs de actividad       │
│  ☑ Documentar el cese de acceso    │
└────────────────────────────────────┘
```

### Seguridad de Dispositivos

```
ORDENADOR DE LA TIENDA
┌────────────────────────────────────┐
│  ✅ Configuración recomendada:     │
│  ├─ Bloqueo automático: 5 minutos  │
│  ├─ Antivirus: Actualizado y activo│
│  ├─ Firewall: Activado             │
│  ├─ Navegador: Última versión      │
│  ├─ Extensiones: Solo las necesarias│
│  └─ Descargas: Solo desde fuentes oficiales│
│                                    │
│  ❌ Evitar:                         │
│  ├─ Dejar sesión abierta al salir  │
│  ├─ Guardar contraseñas en navegador│
│  ├─ Conectar USBs desconocidos     │
│  └─ Abrir emails sospechosos       │
└────────────────────────────────────┘
```

---

## ❓ Preguntas Frecuentes sobre Seguridad

### P: ¿Puedo acceder a Zirqulo desde casa o solo desde la tienda?

**R:** **Puedes acceder desde cualquier lugar**, pero con precauciones:

```
✅ ACCESO SEGURO:
├── Desde ordenador personal con antivirus
├── Con conexión HTTPS (candado verde en navegador)
├── Red WiFi doméstica privada y segura
└── Cerrando sesión al terminar

⚠️ ACCESO CON PRECAUCIÓN:
├── Desde tablet/móvil (asegúrate de tener pantalla bloqueada)
├── Desde coworking con WiFi compartido pero seguro
└── Usando VPN en redes públicas (recomendado)

❌ EVITAR:
├── WiFi de cafeterías o aeropuertos sin VPN
├── Ordenadores públicos (bibliotecas, cibercafés)
├── Dispositivos compartidos sin cerrar sesión
└── Redes WiFi abiertas sin contraseña
```

**Sistema GeoLite2 en acción:**
Si accedes desde una ubicación inusual (ej: de vacaciones en otro país), el sistema detectará el cambio y:
1. Enviará un email de alerta
2. Puede requerir verificación adicional
3. Si el cambio es muy drástico (ej: 1000 km en 2 horas), bloqueará el acceso temporalmente

---

### P: ¿Qué pasa si un empleado intenta robar datos de clientes antes de dejar la empresa?

**R:** Zirqulo tiene múltiples capas de protección contra este escenario:

**1. Limitación de exportaciones masivas**
```
❌ NO PERMITIDO:
   "Exportar todos los clientes a CSV" → Requiere aprobación de gerente

⚠️ ALERTAS AUTOMÁTICAS:
   Si un usuario exporta >50 clientes en un día
   → Notificación automática al administrador del partner
```

**2. Auditoría de accesos**
```
Registro de actividad:
2025-10-03 09:15:23 | Ana | Consultó cliente #12345
2025-10-03 09:18:41 | Ana | Consultó cliente #12346
2025-10-03 09:22:10 | Ana | Consultó cliente #12347
... [100 consultas en 2 horas]

⚠️ PATRÓN SOSPECHOSO
→ Alerta al administrador
→ "Ana ha consultado 100 clientes en 2 horas (inusual)"
```

**3. Permisos granulares**
```
Vendedor normal:
✅ Ver clientes asignados a él
✅ Editar oportunidades en curso
❌ Exportar base de datos completa
❌ Acceder a clientes de otros vendedores
```

---

### P: ¿Puedo integrar Zirqulo con mi sistema de contabilidad? ¿Eso compromete la seguridad?

**R:** Sí puedes integrarlo, pero con controles:

**Opciones de integración:**

```
OPCIÓN 1: Exportaciones manuales periódicas
├── Exportas facturas cada semana
├── Importas CSV en tu software de contabilidad
├── ✅ Seguro (control total sobre qué exportas)
└── ⏱️ Manual (requiere tiempo)

OPCIÓN 2: API de Zirqulo (si disponible)
├── Tu software de contabilidad se conecta automáticamente
├── Solo lee datos específicos (facturas, no clientes)
├── ⚠️ Requiere tokens de API con permisos limitados
└── ✅ Automatizado

OPCIÓN 3: Integraciones nativas (ej: Zapier, Make)
├── Flujos automatizados entre plataformas
├── ⚠️ Asegúrate de que el middleware es seguro (RGPD compliant)
└── ✅ Flexible
```

**Recomendaciones de seguridad:**
1. **Principio de mínimo acceso**: Solo comparte los datos estrictamente necesarios
2. **Tokens con permisos limitados**: Si usas API, crea tokens que SOLO puedan leer facturas, no todos los datos
3. **Revisa políticas de privacidad**: Asegúrate de que servicios de terceros (Zapier, etc.) cumplen RGPD
4. **Notifica a clientes si procede**: Si envías datos a terceros, puede requerir consentimiento

---

### P: ¿Cómo sé si mi cuenta ha sido comprometida?

**R:** Señales de alerta:

```
🚨 SEÑALES DE CUENTA COMPROMETIDA:

1. Recibes emails de "Login desde ubicación inusual" que no reconoces
2. Ves actividad en el historial de logins que no hiciste tú
3. Tus empleados reportan cambios que ellos no hicieron
4. Clientes te contactan por emails que no enviaste
5. Notificaciones de cambios de contraseña que no solicitaste

ACCIÓN INMEDIATA:
1️⃣ Cambia tu contraseña INMEDIATAMENTE
2️⃣ Revisa el historial de logins (sección Seguridad)
3️⃣ Invalida todas las sesiones activas
4️⃣ Contacta con soporte: incidentes@zirqulo.com
5️⃣ Revisa logs de auditoría para ver qué se accedió
```

---

## 📞 Contacto para Incidentes de Seguridad

### ¿Necesitas reportar un incidente?

```
🚨 REPORTE DE INCIDENTES DE SEGURIDAD
   📧 Email urgente: incidentes@zirqulo.com
   📞 Teléfono urgente: [número 24/7 si disponible]
   ⚠️ Usa este canal SOLO para incidentes reales:
      - Accesos no autorizados
      - Sospecha de hackeo
      - Pérdida de dispositivos con sesión activa
      - Empleado despedido con acceso activo
      - Credenciales comprometidas

🔐 CONSULTAS DE SEGURIDAD (No urgentes)
   📧 Email: seguridad@zirqulo.com
   📋 Asunto: "[SEGURIDAD] Tu consulta aquí"
   ⏱️ Respuesta: <48 horas hábiles
   Ejemplos:
   - Dudas sobre configuración 2FA
   - Mejores prácticas de seguridad
   - Revisión de permisos de empleados

🆘 SOPORTE TÉCNICO GENERAL
   📧 Email: soporte@zirqulo.com
   💬 Chat: Desde la plataforma (esquina inferior derecha)
   ⏰ Horario: Lunes a viernes, 9:00-18:00 (CET)
```

---

## 📝 Resumen Ejecutivo de Seguridad

Si solo tienes 2 minutos, esto es lo que DEBES saber:

```
┌─────────────────────────────────────────────────────────────┐
│  🔐 AUTENTICACIÓN ROBUSTA                                   │
├─────────────────────────────────────────────────────────────┤
│  ✅ Tokens JWT con firma digital (imposible de falsificar)  │
│  ✅ Caducidad automática (24 horas)                         │
│  ✅ Validación en cada operación                            │
│  ✅ Control de acceso estricto por partner                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  📍 SEGURIDAD BASADA EN UBICACIÓN (GeoLite2) 🆕             │
├─────────────────────────────────────────────────────────────┤
│  ✅ Detección de logins desde ubicaciones inusuales         │
│  ✅ Alertas automáticas por email                           │
│  ✅ Bloqueo de viajes imposibles (>500km en <4 horas)       │
│  ✅ Historial completo de logins con geolocalización        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  🛡️ PROTECCIÓN MULTI-CAPA                                   │
├─────────────────────────────────────────────────────────────┤
│  1️⃣ Control de acceso (validación continua)                 │
│  2️⃣ Cifrado HTTPS (comunicaciones seguras)                  │
│  3️⃣ Cifrado de datos (contraseñas, DNI, datos bancarios)    │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  💾 BACKUPS Y RECUPERACIÓN                                  │
├─────────────────────────────────────────────────────────────┤
│  ✅ Backups cada 15 minutos (replicación continua)          │
│  ✅ Backups diarios (30 días de retención)                  │
│  ✅ Backups semanales (3 meses de retención)                │
│  ✅ Failover automático (5-10 min de downtime máximo)       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  🤝 TU RESPONSABILIDAD                                       │
├─────────────────────────────────────────────────────────────┤
│  🔑 Contraseñas fuertes y únicas                            │
│  👥 Desactivar usuarios al dejar la empresa                 │
│  💻 Proteger dispositivos con antivirus                     │
│  🚪 Cerrar sesión en ordenadores compartidos                │
│  📧 Reportar actividad sospechosa inmediatamente            │
└─────────────────────────────────────────────────────────────┘
```

---

## 🎓 Conclusión

La seguridad en Zirqulo Partners es un **esfuerzo conjunto**:

- **Zirqulo** proporciona la infraestructura segura, la autenticación robusta, la detección de amenazas (GeoLite2), y respuesta rápida a incidentes
- **Tú** eres responsable de gestionar bien a tus empleados, usar contraseñas fuertes, proteger tus dispositivos, y reportar actividad sospechosa

**Juntos** creamos un ecosistema donde tu cuenta está protegida, tus datos están seguros, y tu negocio puede crecer con tranquilidad.

---

**Última actualización**: Octubre 2025 (Incluye sistema GeoLite2)
**Versión del documento**: 1.0
**Plataforma**: Next.js 15 + Django 5 Multi-Tenant con GeoIP2 Security
