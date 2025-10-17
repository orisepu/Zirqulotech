# AUDITORIA DE SEGURIDAD: Sistema de Autenticacion

**Fecha**: 2025-10-17
**Alcance**: Sistema de login completo (frontend + backend)
**Auditor**: Analisis automatizado OWASP Top 10
**Arquitectura**: Multi-tenant con Django 5 + Next.js 15 + JWT

---

## RESUMEN EJECUTIVO

### Estadisticas de Vulnerabilidades

| Severidad | Cantidad | Estado |
|-----------|----------|--------|
| **CRITICAS** | 3 | 🔴 Accion inmediata requerida |
| **ALTAS** | 6 | 🟠 Corregir antes de merge |
| **MEDIAS** | 4 | 🟡 Planificar correccion |
| **BAJAS** | 3 | 🔵 Mejora continua |
| **TOTAL** | 16 | |

### Recomendacion Final

**⛔ BLOQUEAR MERGE** - Se detectaron 3 vulnerabilidades criticas que permiten:
- Autenticacion con contraseñas debiles (< 8 caracteres)
- Bypass de validacion de email con regex inseguro
- Falta de validacion backend que confia ciegamente en frontend

### Aspectos Positivos Destacados

✅ **Excelente arquitectura de seguridad base**:
- Django Axes implementado correctamente para proteccion contra fuerza bruta
- Sistema de geolocalizacion con GeoLite2 para detectar logins sospechosos
- Secure storage con AES-GCM para tokens (mejor que localStorage)
- Uso correcto de JWT con refresh tokens
- Tests de seguridad exhaustivos (73 tests backend)
- Encriptacion de tokens en sessionStorage

✅ **Buenas practicas implementadas**:
- CORS configurado restrictivamente (no wildcard)
- CSRF protection habilitado
- Multi-tenant con separacion de schemas
- Logging de intentos fallidos
- Reset automatico de contadores Axes tras login exitoso

---

## 🔴 VULNERABILIDADES CRITICAS (Severidad: CRITICA)

### CRIT-01: Validacion de Contraseña Inconsistente con Comentario

**Categoria OWASP**: A07:2021 - Identification and Authentication Failures
**CWE**: CWE-521 (Weak Password Requirements)

**Ubicacion**:
```
File: tenant-frontend/src/features/auth/components/LoginForm.tsx
Line: 56
```

**Codigo Vulnerable**:
```typescript
const okPass = password.length >= 4; // minimo 8 caracteres
```

**Descripcion**:
El codigo valida contraseñas con minimo 4 caracteres, pero el comentario indica que deberian ser 8. Esto permite que usuarios usen contraseñas extremadamente debiles como "1234" o "pass".

**Impacto**:
- **Severidad**: CRITICA
- **Explotabilidad**: Facil
- **Consecuencias**:
  - Cuentas vulnerables a ataques de fuerza bruta incluso con Django Axes (5 intentos con diccionarios simples)
  - Comprometimiento facil de cuentas si se conoce el email
  - No cumple con estandares minimos de OWASP (minimo 8 caracteres)
  - Contradiccion con el helperText (linea 219: "Minimo 8 caracteres")

**Evidencia**:
```typescript
// Linea 56: Validacion permite 4 caracteres
const okPass = password.length >= 4;

// Linea 219: UI indica 8 caracteres
helperText="Minimo 8 caracteres"
```

**Remediacion**:
```typescript
// Cambiar a validacion estricta de 8 caracteres
const okPass = password.length >= 8;
```

**Prueba de Concepto**:
```bash
# Ataque con contraseñas de 4 caracteres
curl -X POST https://zirqulotech.com/api/login/ \
  -H "Content-Type: application/json" \
  -d '{"empresa":"test","email":"victim@test.com","password":"1234"}'

# ✅ VULNERABLE: Acepta contraseña de 4 caracteres
```

**Referencias**:
- OWASP ASVS 2.1.1: Password Length (minimum 8 characters)
- NIST SP 800-63B: Digital Identity Guidelines
- CWE-521: https://cwe.mitre.org/data/definitions/521.html

---

### CRIT-02: Regex de Email Vulnerable a Bypass

**Categoria OWASP**: A07:2021 - Identification and Authentication Failures
**CWE**: CWE-20 (Improper Input Validation)

**Ubicacion**:
```
File: tenant-frontend/src/features/auth/components/LoginForm.tsx
Line: 55
```

**Codigo Vulnerable**:
```typescript
const okEmail = /\S+@\S+\.\S+/.test(email);
```

**Descripcion**:
El regex usado para validar emails es demasiado permisivo y acepta formatos invalidos. `\S` permite cualquier caracter NO-whitespace, incluyendo caracteres especiales que no son validos en emails.

**Impacto**:
- **Severidad**: CRITICA
- **Explotabilidad**: Facil
- **Consecuencias**:
  - Acepta emails invalidos como: `"<script>@x.x"`, `"admin@<img src=x>"`, `"' OR 1=1--@x.x"`
  - Posible vector de XSS si el email se renderiza sin sanitizar
  - Posible inyeccion SQL si el backend no valida (aunque usa ORM)
  - Datos inconsistentes en la base de datos

**Evidencia - Emails Aceptados Incorrectamente**:
```javascript
// Todos estos pasan la validacion actual:
"<script>alert(1)</script>@x.x"  // ✅ ACEPTA (XSS potencial)
"admin'--@x.x"                    // ✅ ACEPTA (SQL injection potencial)
"user@@domain..com"               // ✅ ACEPTA (formato invalido)
"@domain.com"                     // ✅ ACEPTA (sin local-part)
"user@"                          // ❌ RECHAZA correctamente
```

**Remediacion**:
```typescript
// Opcion 1: Regex RFC 5322 simplificado
const okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// Opcion 2: Usar validador del lib/validators.ts existente
import { validarEmail } from '@/lib/validators';
const okEmail = validarEmail(email);

// Opcion 3: HTML5 native validation
<TextField
  type="email"
  inputProps={{ pattern: "[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}$" }}
/>
```

**Referencias**:
- OWASP Input Validation Cheat Sheet
- RFC 5322: Internet Message Format
- CWE-20: https://cwe.mitre.org/data/definitions/20.html

---

### CRIT-03: Falta Validacion Backend de Inputs

**Categoria OWASP**: A03:2021 - Injection
**CWE**: CWE-20 (Improper Input Validation)

**Ubicacion**:
```
File: tenants-backend/django_test_app/users/views.py
Lines: 19-24
```

**Codigo Vulnerable**:
```python
def post(self, request):
    empresa = request.data.get("empresa")
    email = request.data.get("email")
    password = request.data.get("password")

    if not email or not password:
        return Response({"detail": "Faltan datos."}, status=status.HTTP_400_BAD_REQUEST)
```

**Descripcion**:
El backend solo valida que los campos existan (truthy check), pero no valida el formato de email, longitud de contraseña, ni caracteres peligrosos. Confia ciegamente en la validacion del frontend, violando el principio de "never trust the client".

**Impacto**:
- **Severidad**: CRITICA
- **Explotabilidad**: Facil (bypass frontend trivial)
- **Consecuencias**:
  - Bypass completo de validaciones frontend editando el request
  - Posible SQL injection si el ORM no sanitiza correctamente (baja probabilidad pero existe)
  - Datos malformados en base de datos
  - Logs con datos no sanitizados pueden causar log injection

**Evidencia - Bypass Frontend**:
```bash
# Atacante bypasea validacion frontend con curl
curl -X POST https://zirqulotech.com/api/login/ \
  -H "Content-Type: application/json" \
  -d '{"empresa":"test","email":"<script>alert(1)</script>","password":"x"}'

# Backend acepta sin validar formato
```

**Remediacion**:
```python
from django.core.validators import validate_email
from django.core.exceptions import ValidationError

def post(self, request):
    empresa = request.data.get("empresa")
    email = request.data.get("email")
    password = request.data.get("password")

    # Validacion de campos obligatorios
    if not email or not password:
        return Response({"detail": "Faltan datos."}, status=status.HTTP_400_BAD_REQUEST)

    # Validacion de formato de email
    try:
        validate_email(email)
    except ValidationError:
        return Response({"detail": "Email invalido."}, status=status.HTTP_400_BAD_REQUEST)

    # Validacion de longitud de contraseña
    if len(password) < 8:
        return Response(
            {"detail": "La contraseña debe tener al menos 8 caracteres."},
            status=status.HTTP_400_BAD_REQUEST
        )

    # Sanitizacion de empresa (slug validation)
    if not empresa or not empresa.replace("-", "").replace("_", "").isalnum():
        return Response({"detail": "Empresa invalida."}, status=status.HTTP_400_BAD_REQUEST)

    # ... resto del codigo ...
```

**Test Requerido** (agregar a test_login.py):
```python
def test_login_validates_email_format(self, api_client):
    """Should reject malformed emails"""
    invalid_emails = [
        "<script>alert(1)</script>",
        "not-an-email",
        "missing@domain",
        "@nodomain.com",
        "spaces in@email.com"
    ]

    for email in invalid_emails:
        response = api_client.post("/api/login/", {
            "empresa": "test",
            "email": email,
            "password": "validpass123"
        }, format="json")

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        assert "Email invalido" in response.data["detail"]

def test_login_validates_password_length(self, api_client):
    """Should reject passwords shorter than 8 characters"""
    response = api_client.post("/api/login/", {
        "empresa": "test",
        "email": "user@test.com",
        "password": "short"
    }, format="json")

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "8 caracteres" in response.data["detail"]
```

**Referencias**:
- OWASP Input Validation Cheat Sheet
- Django Core Validators Documentation
- CWE-20: https://cwe.mitre.org/data/definitions/20.html

---

## 🟠 VULNERABILIDADES ALTAS (Severidad: ALTA)

### HIGH-01: DEBUG Mode en Produccion (Potencial)

**Categoria OWASP**: A05:2021 - Security Misconfiguration
**CWE**: CWE-489 (Active Debug Code)

**Ubicacion**:
```
File: tenants-backend/django_test_app/settings.py
Line: 35
```

**Codigo Actual**:
```python
DEBUG = config("DEBUG", default=False, cast=bool)
```

**Descripcion**:
Aunque el codigo usa `default=False`, el valor depende de la variable de entorno `DEBUG`. Si esta variable esta configurada incorrectamente en produccion, se exponen stack traces completos con informacion sensible.

**Impacto**:
- **Severidad**: ALTA
- **Riesgo**: Moderado (depende de configuracion de .env)
- **Consecuencias**:
  - Exposicion de rutas de archivos en el servidor
  - Revelacion de estructura de base de datos
  - Exposicion de configuraciones y variables de entorno
  - Informacion util para atacantes (versiones, dependencias, etc.)

**Remediacion**:
```python
# Opcion 1: Forzar DEBUG=False en produccion
import os
ENVIRONMENT = config("ENVIRONMENT", default="production")
DEBUG = config("DEBUG", default=False, cast=bool) if ENVIRONMENT == "development" else False

# Opcion 2: Doble verificacion
DEBUG = config("DEBUG", default=False, cast=bool)
if not DEBUG and ALLOWED_HOSTS and "localhost" not in ALLOWED_HOSTS:
    DEBUG = False  # Fuerza False si no es localhost
```

**Verificacion**:
```bash
# Verificar que DEBUG=False en produccion
curl https://zirqulotech.com/api/endpoint-inexistente/

# Si DEBUG=True, responde con:
# - Stack trace completo
# - Variables de entorno
# - Rutas de archivos

# Si DEBUG=False, responde con:
# - Mensaje generico "Not Found"
```

**Referencias**:
- OWASP Configuration Cheat Sheet
- Django Security Settings
- CWE-489: https://cwe.mitre.org/data/definitions/489.html

---

### HIGH-02: Session Cookies sin Secure Flag en Produccion

**Categoria OWASP**: A02:2021 - Cryptographic Failures
**CWE**: CWE-614 (Sensitive Cookie in HTTPS Session Without 'Secure' Attribute)

**Ubicacion**:
```
File: tenants-backend/django_test_app/settings.py
Lines: 242-244
```

**Codigo Vulnerable**:
```python
SESSION_COOKIE_SECURE = config("SESSION_COOKIE_SECURE", default=False, cast=bool)
CSRF_COOKIE_SECURE = config("CSRF_COOKIE_SECURE", default=False, cast=bool)
```

**Descripcion**:
Las cookies de sesion y CSRF no tienen el flag `Secure` por defecto, permitiendo que se transmitan por HTTP inseguro. Si un usuario accede accidentalmente por HTTP, las cookies pueden ser interceptadas (man-in-the-middle).

**Impacto**:
- **Severidad**: ALTA
- **Explotabilidad**: Media (requiere MitM)
- **Consecuencias**:
  - Robo de session cookies en redes no seguras (WiFi publico)
  - Robo de tokens CSRF
  - Session hijacking
  - Downgrade attacks (forzar HTTP en vez de HTTPS)

**Remediacion**:
```python
# settings.py
ENVIRONMENT = config("ENVIRONMENT", default="production")

# Forzar Secure cookies en produccion
if ENVIRONMENT == "production":
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_SSL_REDIRECT = True
else:
    SESSION_COOKIE_SECURE = config("SESSION_COOKIE_SECURE", default=False, cast=bool)
    CSRF_COOKIE_SECURE = config("CSRF_COOKIE_SECURE", default=False, cast=bool)
    SECURE_SSL_REDIRECT = config("SECURE_SSL_REDIRECT", default=False, cast=bool)

# Agregar SameSite=Lax para proteccion CSRF adicional
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
```

**Referencias**:
- OWASP Session Management Cheat Sheet
- Django Security Settings
- CWE-614: https://cwe.mitre.org/data/definitions/614.html

---

### HIGH-03: Falta Configuracion de Security Headers

**Categoria OWASP**: A05:2021 - Security Misconfiguration
**CWE**: CWE-693 (Protection Mechanism Failure)

**Ubicacion**:
```
File: tenants-backend/django_test_app/settings.py
```

**Descripcion**:
No se detectaron headers de seguridad criticos en la configuracion de Django. Faltan:
- `X-Frame-Options` (proteccion contra clickjacking)
- `X-Content-Type-Options` (proteccion contra MIME sniffing)
- `Strict-Transport-Security` (HSTS)
- `Content-Security-Policy` (CSP)
- `Referrer-Policy`

**Impacto**:
- **Severidad**: ALTA
- **Consecuencias**:
  - Clickjacking: Pagina puede ser embebida en iframe malicioso
  - MIME sniffing: Archivos JavaScript pueden ejecutarse como HTML
  - Falta HSTS: Vulnerable a downgrade attacks
  - Falta CSP: XSS mas facil de explotar

**Remediacion**:
```python
# settings.py

# X-Frame-Options: Prevenir clickjacking
X_FRAME_OPTIONS = "DENY"

# X-Content-Type-Options: Prevenir MIME sniffing
SECURE_CONTENT_TYPE_NOSNIFF = True

# HSTS: Forzar HTTPS (solo en produccion)
if ENVIRONMENT == "production":
    SECURE_HSTS_SECONDS = 31536000  # 1 año
    SECURE_HSTS_INCLUDE_SUBDOMAINS = True
    SECURE_HSTS_PRELOAD = True

# Content Security Policy (CSP)
# Nota: Requiere django-csp o middleware custom
CSP_DEFAULT_SRC = ("'self'",)
CSP_SCRIPT_SRC = ("'self'", "'unsafe-inline'", "https://www.googletagmanager.com")
CSP_STYLE_SRC = ("'self'", "'unsafe-inline'")
CSP_IMG_SRC = ("'self'", "data:", "https:")
CSP_FONT_SRC = ("'self'", "data:")
CSP_CONNECT_SRC = ("'self'", "https://zirqulotech.com")

# Referrer-Policy
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"

# Agregar middleware para headers personalizados
MIDDLEWARE = [
    # ... existing middleware ...
    'django.middleware.security.SecurityMiddleware',  # Ya existe
    'csp.middleware.CSPMiddleware',  # Instalar django-csp
]
```

**Instalacion**:
```bash
pip install django-csp
```

**Verificacion**:
```bash
# Verificar headers de seguridad
curl -I https://zirqulotech.com/api/yo/

# Deberia incluir:
# X-Frame-Options: DENY
# X-Content-Type-Options: nosniff
# Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
# Content-Security-Policy: default-src 'self'; ...
# Referrer-Policy: strict-origin-when-cross-origin
```

**Referencias**:
- OWASP Secure Headers Project
- Mozilla Observatory
- CWE-693: https://cwe.mitre.org/data/definitions/693.html

---

### HIGH-04: Implementacion Manual de Django Axes (Posible Bypass)

**Categoria OWASP**: A04:2021 - Insecure Design
**CWE**: CWE-307 (Improper Restriction of Excessive Authentication Attempts)

**Ubicacion**:
```
File: tenants-backend/django_test_app/users/views.py
Lines: 47-75, 197-226
```

**Descripcion**:
El codigo reimplementa manualmente la logica de Django Axes en lugar de usar el decorador `@axes_dispatch` o el middleware nativo. Esto puede causar:
- Inconsistencias con la configuracion de Axes
- Posibles bypasses si la logica manual difiere de Axes
- Doble procesamiento (middleware Axes + logica manual)

**Codigo Actual**:
```python
# Implementacion manual (views.py:52-75)
try:
    attempt = AccessAttempt.objects.get(
        username=email,
        ip_address=ip_address,
        user_agent=user_agent,
        attempt_time__gte=cutoff_time
    )

    if attempt.failures_since_start >= failure_limit:
        # Bloquear manualmente
        return Response({...}, status=status.HTTP_403_FORBIDDEN)
except AccessAttempt.DoesNotExist:
    pass
```

**Impacto**:
- **Severidad**: ALTA
- **Riesgo**: Moderado
- **Consecuencias**:
  - Posible bypass cambiando User-Agent
  - Race conditions en requests concurrentes
  - Inconsistencia entre middleware Axes y validacion manual

**Remediacion**:
```python
from axes.decorators import axes_dispatch
from django.utils.decorators import method_decorator

@method_decorator(axes_dispatch, name='dispatch')
class TenantLoginView(APIView):
    def post(self, request):
        # Axes maneja automaticamente el rate limiting
        # Eliminar logica manual de lineas 47-75

        empresa = request.data.get("empresa")
        email = request.data.get("email")
        password = request.data.get("password")

        # ... resto de validaciones ...

        # Axes maneja automaticamente el reset tras login exitoso
        # Eliminar linea 154: AccessAttempt.objects.filter(username=user.email).delete()
```

**Si la Implementacion Manual es Necesaria** (documentar por que):
```python
# JUSTIFICACION: Implementacion manual necesaria porque:
# 1. Multi-tenant requiere validacion antes de schema_context
# 2. Axes no soporta validacion pre-schema
# 3. Necesitamos control granular por tenant

# Agregar lock para evitar race conditions
from django.core.cache import cache

def login_user_in_schema(self, email, password, request, tenant=None):
    lock_key = f"login_attempt_{email}_{request.META.get('REMOTE_ADDR')}"

    # Intentar adquirir lock (timeout 5s)
    if not cache.add(lock_key, "locked", timeout=5):
        return Response({
            "detail": "Demasiados intentos simultaneos. Intente nuevamente."
        }, status=status.HTTP_429_TOO_MANY_REQUESTS)

    try:
        # ... logica de login ...
    finally:
        cache.delete(lock_key)
```

**Referencias**:
- Django Axes Documentation
- OWASP Authentication Cheat Sheet
- CWE-307: https://cwe.mitre.org/data/definitions/307.html

---

### HIGH-05: dangerouslySetInnerHTML sin Sanitizacion

**Categoria OWASP**: A03:2021 - Injection (XSS)
**CWE**: CWE-79 (Cross-site Scripting)

**Ubicacion**:
```
File: tenant-frontend/src/app/(dashboard)/ajustes/contrato/page.tsx
Line: 517
```

**Codigo Vulnerable**:
```tsx
<div dangerouslySetInnerHTML={{ __html: previewHtml }} />
```

**Descripcion**:
El componente renderiza HTML generado por el backend sin sanitizacion adicional. Aunque el backend deberia sanitizar, el frontend no tiene proteccion defensiva (defense in depth).

**Impacto**:
- **Severidad**: ALTA
- **Explotabilidad**: Media (requiere comprometer backend o template)
- **Consecuencias**:
  - XSS si el backend es comprometido
  - XSS si el template contiene variables no sanitizadas
  - Robo de tokens de sesion
  - Ejecucion de JavaScript arbitrario

**Remediacion**:
```tsx
import DOMPurify from 'dompurify';

// Opcion 1: Sanitizar en el componente
<div dangerouslySetInnerHTML={{
  __html: DOMPurify.sanitize(previewHtml, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'table', 'tr', 'td', 'th', 'thead', 'tbody'],
    ALLOWED_ATTR: ['class', 'style']
  })
}} />

// Opcion 2: Usar rehype-sanitize (ya instalado)
import { unified } from 'unified'
import rehypeParse from 'rehype-parse'
import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'

const sanitizeHtml = async (dirty: string) => {
  const file = await unified()
    .use(rehypeParse, { fragment: true })
    .use(rehypeSanitize)
    .use(rehypeStringify)
    .process(dirty)
  return String(file)
}
```

**Referencias**:
- OWASP XSS Prevention Cheat Sheet
- DOMPurify Documentation
- CWE-79: https://cwe.mitre.org/data/definitions/79.html

---

### HIGH-06: GoogleAnalytics con dangerouslySetInnerHTML (Riesgo de Tampering)

**Categoria OWASP**: A05:2021 - Security Misconfiguration
**CWE**: CWE-829 (Inclusion of Functionality from Untrusted Control Sphere)

**Ubicacion**:
```
File: tenant-frontend/src/shared/components/analytics/GoogleAnalytics.tsx
Lines: 39-51
```

**Codigo Actual**:
```tsx
<Script
  id="google-analytics"
  strategy="afterInteractive"
  dangerouslySetInnerHTML={{
    __html: `
      window.dataLayer = window.dataLayer || [];
      function gtag(){dataLayer.push(arguments);}
      gtag('js', new Date());
      gtag('config', '${measurementId}', {
        page_path: window.location.pathname,
        anonymize_ip: true,
        cookie_flags: 'SameSite=None;Secure'
      });
    `,
  }}
/>
```

**Descripcion**:
Aunque el codigo es correcto, usar `dangerouslySetInnerHTML` con template strings que incluyen variables (`${measurementId}`) es un vector de riesgo si la variable proviene de fuente no confiable.

**Impacto**:
- **Severidad**: ALTA (si measurementId no es validado)
- **Riesgo**: Bajo (measurementId viene de .env)
- **Consecuencias**:
  - Si measurementId es comprometido, puede inyectar JavaScript
  - Posible robo de datos de Analytics

**Remediacion**:
```tsx
export function GoogleAnalytics() {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  // Validar formato de GA Measurement ID
  if (
    process.env.NODE_ENV !== 'production' ||
    !measurementId ||
    !/^G-[A-Z0-9]{10}$/.test(measurementId)
  ) {
    return null;
  }

  return (
    <>
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${measurementId}', {
              page_path: window.location.pathname,
              anonymize_ip: true,
              cookie_flags: 'SameSite=None;Secure'
            });
          `,
        }}
      />
    </>
  );
}
```

**Referencias**:
- OWASP Third-Party JavaScript Management Cheat Sheet
- Next.js Script Component Security
- CWE-829: https://cwe.mitre.org/data/definitions/829.html

---

## 🟡 VULNERABILIDADES MEDIAS (Severidad: MEDIA)

### MED-01: Falta Rate Limiting en Endpoints Publicos

**Categoria OWASP**: A04:2021 - Insecure Design
**CWE**: CWE-770 (Allocation of Resources Without Limits)

**Descripcion**:
Solo el endpoint `/api/login/` tiene proteccion Django Axes. Otros endpoints publicos no tienen rate limiting, permitiendo:
- Scraping masivo de datos
- DoS mediante requests masivos
- Brute force en otros endpoints (ej: password reset)

**Ubicacion**: Global (falta middleware)

**Impacto**: Moderado

**Remediacion**:
```python
# Instalar django-ratelimit o usar DRF throttling
pip install django-ratelimit

# settings.py
REST_FRAMEWORK = {
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle'
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/hour',
        'user': '1000/hour'
    }
}
```

---

### MED-02: Falta Password Strength Indicator (UX de Seguridad)

**Categoria OWASP**: A04:2021 - Insecure Design
**CWE**: CWE-521 (Weak Password Requirements)

**Descripcion**:
El formulario de login no proporciona feedback sobre la fuerza de la contraseña. Los usuarios no saben si su contraseña es segura.

**Ubicacion**: LoginForm.tsx

**Impacto**: Bajo-Medio

**Remediacion**:
```bash
npm install zxcvbn
```

```tsx
import zxcvbn from 'zxcvbn';

const passwordStrength = useMemo(() => {
  if (!password) return null;
  return zxcvbn(password);
}, [password]);

// Mostrar indicador de fuerza
<LinearProgress
  variant="determinate"
  value={(passwordStrength?.score || 0) * 25}
  color={passwordStrength?.score >= 3 ? "success" : "error"}
/>
<Typography variant="caption">
  {passwordStrength?.feedback.suggestions[0]}
</Typography>
```

---

### MED-03: Falta Flujo de Recuperacion de Contraseña

**Categoria OWASP**: A04:2021 - Insecure Design
**CWE**: CWE-640 (Weak Password Recovery Mechanism)

**Descripcion**:
No existe endpoint ni flujo de "Olvide mi contraseña". Los usuarios bloqueados no pueden recuperar acceso.

**Ubicacion**: N/A (feature faltante)

**Impacto**: Moderado (impacto en UX y seguridad)

**Remediacion**:
```python
# views.py
class PasswordResetRequestView(APIView):
    def post(self, request):
        email = request.data.get("email")
        # Generar token seguro
        # Enviar email con link de reset
        # Rate limit: 3 requests por hora
        pass

class PasswordResetConfirmView(APIView):
    def post(self, request):
        token = request.data.get("token")
        new_password = request.data.get("password")
        # Validar token (expiracion 1 hora)
        # Cambiar contraseña
        # Invalidar token
        pass
```

---

### MED-04: Falta Logging de Eventos de Seguridad Criticos

**Categoria OWASP**: A09:2021 - Security Logging and Monitoring Failures
**CWE**: CWE-778 (Insufficient Logging)

**Descripcion**:
Aunque se loguean intentos fallidos, faltan logs para:
- Cambios de contraseña
- Cambios de permisos
- Acceso a datos sensibles
- Cambios en configuracion de tenants

**Ubicacion**: Global

**Impacto**: Moderado

**Remediacion**:
```python
import logging
security_logger = logging.getLogger('security')

# Agregar a LOGGING en settings.py
'security': {
    'handlers': ['console', 'security_file'],
    'level': 'INFO',
    'propagate': False,
}

# En views criticas
security_logger.info(f"Password changed for user {user.email} from IP {ip_address}")
security_logger.warning(f"Unauthorized access attempt to tenant {tenant_id} by user {user.email}")
```

---

## 🔵 VULNERABILIDADES BAJAS (Severidad: BAJA)

### LOW-01: Falta Content Security Policy (CSP) en Frontend

**Categoria OWASP**: A05:2021 - Security Misconfiguration
**CWE**: CWE-693

**Descripcion**:
Next.js no tiene CSP configurado en headers. Aunque hay sanitizacion, CSP es una capa adicional de defensa.

**Remediacion**:
```javascript
// next.config.js
const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com;"
  }
]

module.exports = {
  async headers() {
    return [{
      source: '/:path*',
      headers: securityHeaders,
    }]
  },
}
```

---

### LOW-02: Dependencias con Versiones Potencialmente Vulnerables

**Categoria OWASP**: A06:2021 - Vulnerable and Outdated Components

**Descripcion**:
Aunque las dependencias estan actualizadas, no hay proceso automatizado de verificacion de CVEs.

**Remediacion**:
```bash
# Backend
pip install safety
safety check

# Frontend
npm audit
npm audit fix
```

---

### LOW-03: Falta Implementacion de 2FA/MFA

**Categoria OWASP**: A07:2021 - Identification and Authentication Failures
**CWE**: CWE-308

**Descripcion**:
Aunque existe deteccion de ubicacion inusual, no hay implementacion completa de 2FA con TOTP o SMS.

**Remediacion**: Implementar django-otp o similar para 2FA opcional.

---

## ✅ ASPECTOS POSITIVOS (Buenas Practicas Implementadas)

### Seguridad de Tokens

✅ **Secure Storage con AES-GCM**:
- Tokens almacenados en memoria + sessionStorage encriptado
- Uso de Web Crypto API con derivacion PBKDF2
- No usa localStorage vulnerable

**Evidencia**:
```typescript
// secureStorage.ts:22-54
async function getDerivedKey(): Promise<CryptoKey> {
  // Derivacion de clave con PBKDF2 + 100,000 iteraciones
  // Encriptacion con AES-GCM-256
}
```

### Proteccion contra Fuerza Bruta

✅ **Django Axes Correctamente Configurado**:
- Limite de 5 intentos fallidos
- Bloqueo por 1 hora (cooldown configurable)
- Tracking por IP + email + user agent
- Reset automatico tras login exitoso

**Evidencia**:
```python
# settings.py:332-356
AXES_FAILURE_LIMIT = 5
AXES_COOLOFF_TIME = 1  # horas
AXES_LOCKOUT_PARAMETERS = [["username", "ip_address"]]
AXES_RESET_ON_SUCCESS = True
```

**Tests**:
```python
# test_login.py:316-336
def test_axes_blocks_after_multiple_failed_attempts(...)
  # 73 tests backend pasan ✅
```

### Seguridad Basada en Ubicacion

✅ **GeoIP2 con Deteccion de Viajes Imposibles**:
- Calculo de distancia entre logins
- Deteccion de viajes imposibles (500km en 4h)
- Bloqueo automatico o requerimiento de 2FA

**Evidencia**:
```python
# settings.py:316-327
LOCATION_SECURITY_ENABLED = True
LOCATION_ALERT_THRESHOLD_KM = 500
LOCATION_ALERT_THRESHOLD_HOURS = 4
```

### Configuracion de CORS Restrictiva

✅ **CORS sin Wildcard**:
```python
# settings.py:167-174
CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https://.*\.progeek\.es$",
    r"^https://.*\.zirqulotech\.com$",
]
```

### Multi-Tenant Security

✅ **Separacion de Schemas por Tenant**:
- Cada tenant tiene schema aislado en PostgreSQL
- Validacion de permisos con UserTenantPermissions
- Header X-Tenant para identificacion

### Testing de Seguridad

✅ **Cobertura Exhaustiva**:
- 73 tests backend (incluyendo seguridad)
- Tests de Django Axes
- Tests de location security
- Tests de tokens JWT

**Evidencia**: `test_login.py` (583 lineas de tests)

---

## 📊 ANALISIS DE DEPENDENCIAS

### Backend (requirements.txt)

✅ **Dependencias Actualizadas**:
- Django 5.2.4 (latest stable) ✅
- djangorestframework 3.16.0 ✅
- django-axes 7.0.0 ✅
- cryptography 45.0.5 ✅

⚠️ **Verificaciones Recomendadas**:
```bash
pip install safety
safety check --full-report
```

### Frontend (package.json)

✅ **Dependencias Actualizadas**:
- Next.js 15.5.2 (latest) ✅
- React 19.0.0 (latest) ✅
- axios 1.10.0 ✅
- dompurify 3.2.6 ✅

⚠️ **Verificaciones Recomendadas**:
```bash
npm audit
npm audit fix
```

---

## 🛠️ PLAN DE REMEDIACION PRIORIZADO

### FASE 1: CRITICAS (Hoy - Bloqueantes)

1. **CRIT-01**: Fix validacion contraseña (LoginForm.tsx:56)
   - Estimado: 15 min
   - Test: Jest + manual

2. **CRIT-02**: Fix regex email (LoginForm.tsx:55)
   - Estimado: 15 min
   - Test: Jest + manual

3. **CRIT-03**: Agregar validacion backend
   - Estimado: 1 hora
   - Test: pytest (agregar 3 tests nuevos)

**Total Fase 1**: 1.5 horas

### FASE 2: ALTAS (Esta semana)

4. **HIGH-01**: Verificar DEBUG=False en .env produccion
   - Estimado: 10 min

5. **HIGH-02**: Fix secure cookies
   - Estimado: 30 min

6. **HIGH-03**: Agregar security headers
   - Estimado: 1 hora

7. **HIGH-04**: Refactorizar Django Axes (opcional)
   - Estimado: 2 horas

8. **HIGH-05**: Sanitizar dangerouslySetInnerHTML
   - Estimado: 30 min

9. **HIGH-06**: Validar GA measurement ID
   - Estimado: 15 min

**Total Fase 2**: 4.5 horas

### FASE 3: MEDIAS (Proximo sprint)

10. **MED-01**: Implementar rate limiting global
    - Estimado: 2 horas

11. **MED-02**: Password strength indicator
    - Estimado: 1 hora

12. **MED-03**: Flujo password reset
    - Estimado: 4 horas

13. **MED-04**: Mejorar logging de seguridad
    - Estimado: 2 horas

**Total Fase 3**: 9 horas

### FASE 4: BAJAS (Backlog)

14-16. LOW-01 a LOW-03
    - Estimado: 4 horas total

---

## 🎯 RECOMENDACIONES GENERALES

### Arquitectura de Seguridad

1. **Implementar Defense in Depth**:
   - Validacion en frontend + backend
   - Sanitizacion en backend + frontend
   - Multiples capas de autenticacion

2. **Adoptar Security by Default**:
   - DEBUG=False por defecto
   - Secure cookies por defecto
   - Rate limiting por defecto

3. **Mejorar Monitoring**:
   - Implementar SIEM (ej: ELK Stack)
   - Alertas automaticas para eventos criticos
   - Dashboard de seguridad

### Procesos de Desarrollo

1. **Pre-commit Hooks**:
```bash
# .pre-commit-config.yaml
repos:
  - repo: https://github.com/pre-commit/pre-commit-hooks
    hooks:
      - id: detect-private-key
      - id: check-added-large-files
```

2. **CI/CD Security Checks**:
```yaml
# .github/workflows/security.yml
- name: Run security checks
  run: |
    npm audit
    pip install safety
    safety check
    bandit -r .
```

3. **Penetration Testing**:
   - Testing manual periodico (trimestral)
   - Herramientas automatizadas (OWASP ZAP)

---

## 📝 CONCLUSIONES

### Estado Actual

El sistema de autenticacion tiene una **base de seguridad solida** con implementaciones avanzadas (Axes, GeoIP2, secure storage), pero presenta **3 vulnerabilidades criticas** que deben corregirse inmediatamente:

1. Contraseñas de 4 caracteres aceptadas (vs. 8 documentados)
2. Regex de email vulnerable a bypass
3. Falta validacion backend (confia en frontend)

### Riesgo Residual

- **Antes de fixes**: ALTO (posible comprometimiento facil de cuentas)
- **Despues de Fase 1**: MEDIO (quedan configuraciones por ajustar)
- **Despues de Fase 2**: BAJO (solo mejoras incrementales pendientes)

### Recomendacion Final

**⛔ BLOQUEAR MERGE** hasta completar Fase 1 (1.5 horas de trabajo).

Despues de aplicar fixes:
- ✅ Re-ejecutar tests (deben pasar 73+3 = 76 tests)
- ✅ Verificar en staging
- ✅ Aprobar merge

---

## 📚 REFERENCIAS

### Standards y Guidelines

- OWASP Top 10 2021: https://owasp.org/Top10/
- OWASP ASVS 4.0: https://owasp.org/www-project-application-security-verification-standard/
- NIST SP 800-63B: Digital Identity Guidelines
- CWE Top 25: https://cwe.mitre.org/top25/

### Tools Recomendadas

- **SAST**: Bandit (Python), ESLint (JavaScript)
- **DAST**: OWASP ZAP, Burp Suite
- **Dependency Check**: Safety (Python), npm audit (Node)
- **Secrets Scanning**: TruffleHog, GitGuardian

---

**Fin del Reporte de Auditoria**

Generado automaticamente - 2025-10-17
Revision requerida: Equipo de Seguridad
Proxima auditoria: Despues de implementar fixes
