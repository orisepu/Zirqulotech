# Sistema de Autenticación - Checkouters Partners

## Visión General

Sistema de autenticación multi-tenant con JWT, protección contra fuerza bruta, seguridad basada en ubicación y almacenamiento encriptado de tokens.

### Stack Tecnológico

**Frontend**:
- Next.js 15 + React 19 + TypeScript
- Axios con interceptores
- Secure Storage (AES-GCM + memoria)
- TanStack Query para estado del servidor

**Backend**:
- Django 5 + Django REST Framework
- django-tenants (aislamiento por schema)
- SimpleJWT (tokens JWT)
- Django Axes (protección fuerza bruta)
- GeoLite2 (seguridad por ubicación)

---

## Flujo de Autenticación Completo

```
┌─────────────┐         ┌──────────────┐         ┌─────────────────┐
│  LoginForm  │────1───>│  api.login() │────2───>│  POST /api/login/│
│ (Next.js)   │         │  (axios)     │         │    (Django)      │
└─────────────┘         └──────────────┘         └─────────────────┘
       │                                                    │
       │                                                    3. Resolve tenant
       │                                                    │  (by empresa slug)
       │                                                    │
       │                                                    4. Authenticate user
       │                                                    │  • Check password
       │                                                    │  • Axes protection
       │                                                    │  • Location security
       │                                                    │  • Validate permissions
       │                                                    │
       5. Store tokens    <─────────6─────────────────────│  Generate JWT tokens
       │  (secureStorage)                                  │
       │                                                    │
       7. Redirect to /dashboard                           │
```

### Paso a Paso

#### 1. Usuario Completa Formulario
```typescript
// LoginForm.tsx
const handleLogin = async (e: React.FormEvent) => {
  const res = await loginRequest(empresa.trim(), email.trim(), password);
  const { access, refresh, user, schema, tenantAccess } = res.data;
}
```

#### 2. Frontend Envía Request
```typescript
// api.ts
export function login(empresa: string, email: string, password: string) {
  return axios.post(`${BASE_URL}/api/login/`,
    { empresa, email, password },
    { headers: { "X-Tenant": empresa } }
  );
}
```

#### 3. Backend Resuelve Tenant
```python
# users/views.py - TenantLoginView
def post(self, request):
    empresa = request.data.get("empresa")

    # Caso especial: usuarios internos
    if empresa and empresa.lower() == "zirqulotech":
        with schema_context("public"):
            return self.login_user_in_schema(email, password, request)

    # Caso normal: buscar tenant por slug
    tenant = Company.objects.get(slug=empresa)  # 404 si no existe

    with schema_context(tenant.schema_name):
        return self.login_user_in_schema(email, password, request, tenant)
```

#### 4. Verificaciones de Seguridad

**A. Django Axes - Protección Fuerza Bruta**:
```python
# Verifica intentos fallidos por IP + email + user agent
cutoff_time = timezone.now() - timedelta(hours=1)
attempt = AccessAttempt.objects.get(
    username=email,
    ip_address=request.META['REMOTE_ADDR'],
    attempt_time__gte=cutoff_time
)

if attempt.failures_since_start >= 5:
    return 403 "Cuenta bloqueada"
```

**B. Seguridad Basada en Ubicación (GeoLite2)**:
```python
security_service = LocationSecurityService()
security_check = security_service.check_login_security(user, request)

if security_check == 'BLOCK':
    return 403 "Login bloqueado por seguridad"
elif security_check == 'REQUIRE_2FA':
    return 401 {"require_verification": True}
```

**C. Validación de Permisos**:
```python
# En schema de tenant
try:
    user.usertenantpermissions  # Lanza 403 si no existe
except UserTenantPermissions.DoesNotExist:
    return 403 "No tienes permisos en esta empresa"

# En schema public
global_role = user.global_role
if not (global_role.es_superadmin or global_role.es_empleado_interno):
    return 403 "No tienes permisos como usuario interno"
```

#### 5. Generación de Tokens JWT
```python
# Generar tokens
refresh = RefreshToken.for_user(user)

# Resetear contador de Axes
AccessAttempt.objects.filter(username=user.email).delete()

return Response({
    "refresh": str(refresh),
    "access": str(refresh.access_token),
    "schema": tenant.schema_name,  # o "public"
    "tenantAccess": [schemas_accesibles],
    "user": {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "global_role": {...}
    }
})
```

#### 6. Almacenamiento Seguro de Tokens

**Secure Storage con Doble Capa**:
```typescript
// secureStorage.ts

// 1. Memoria (primaria, no accesible por scripts)
const memoryStorage: Map<string, string> = new Map();

// 2. SessionStorage Encriptado (backup, temporal)
async function encryptValue(value: string): Promise<string> {
  // Derivar key de fingerprint del navegador + PBKDF2
  const key = await deriveKey();

  // Encriptar con AES-GCM + IV aleatorio
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(value)
  );

  return base64Encode(iv + encrypted);
}

// Guardar tokens
await Promise.all([
  setSecureItem("access", access),
  setSecureItem("refresh", refresh),
  setSecureItem("schema", schema),
  setSecureItem("user", JSON.stringify(user)),
  setSecureItem("tenantAccess", JSON.stringify(tenantAccess))
]);
```

#### 7. Interceptores de Axios

**Request Interceptor** - Añadir Headers:
```typescript
api.interceptors.request.use(async (config) => {
  const token = await getSecureItem("access");
  const schema = await getSecureItem("schema");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (schema) {
    config.headers["X-Tenant"] = schema;
  }

  return config;
});
```

**Response Interceptor** - Auto-Refresh:
```typescript
api.interceptors.response.use(
  response => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const newAccess = await refreshToken();
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return api(originalRequest);  // Retry
      } catch {
        // Refresh falló: limpiar y redirigir
        secureTokens.removeAllTokens();
        navigateToLogin();
      }
    }

    return Promise.reject(error);
  }
);
```

---

## Multi-Tenant: Resolución de Schema

### Middleware de Tenants

```python
# middleware/custom_tenant_middleware.py
class HeaderTenantMiddleware:
    def __call__(self, request):
        # Rutas públicas → schema public
        if request.path in PUBLIC_ROUTES:
            connection.set_schema_to_public()
            return self.get_response(request)

        # Leer X-Tenant header o query param
        tenant_slug = (
            request.headers.get('X-Tenant') or
            request.GET.get('schema')
        )

        if tenant_slug:
            tenant = Company.objects.get(schema_name=tenant_slug)
            connection.set_tenant(tenant)

        return self.get_response(request)
```

### Flujo de Headers

```
┌──────────────────────────────────────────────────┐
│ REQUEST                                          │
├──────────────────────────────────────────────────┤
│ POST /api/clientes/                              │
│ Authorization: Bearer eyJ0eXAi...               │
│ X-Tenant: empresa-abc                           │
└──────────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────┐
│ MIDDLEWARE                                       │
├──────────────────────────────────────────────────┤
│ 1. Lee X-Tenant: "empresa-abc"                  │
│ 2. Busca Company con schema_name="empresa-abc"  │
│ 3. SET search_path = "empresa-abc", public;     │
└──────────────────────────────────────────────────┘
            │
            ▼
┌──────────────────────────────────────────────────┐
│ VIEW                                             │
├──────────────────────────────────────────────────┤
│ Cliente.objects.all()                            │
│ ↓                                                │
│ SELECT * FROM clientes                           │
│ (automáticamente en schema "empresa-abc")        │
└──────────────────────────────────────────────────┘
```

---

## Casos Especiales

### 1. Login como Usuario Interno (Zirqulotech)

```python
# Backend detecta empresa="zirqulotech"
if empresa.lower() == "zirqulotech":
    with schema_context("public"):
        # Usuario debe tener UserGlobalRole
        # con es_empleado_interno=True
        return login_in_public_schema()
```

```typescript
// Frontend usa misma API
await login("zirqulotech", "admin@zirqulotech.com", "pass");
// Retorna: { schema: "public", ... }
```

### 2. Tenant No Existe (ej: 'progeek')

**Backend**:
```python
try:
    tenant = Company.objects.get(slug=empresa)
except Company.DoesNotExist:
    return Response(
        {"detail": "Empresa no encontrada."},
        status=404
    )
```

**Frontend**:
```typescript
// Muestra error específico
if (error.response?.status === 404) {
  setError("Empresa no encontrada. Verifica el nombre.");
}
```

### 3. Usuario Multi-Tenant

**Backend retorna lista de acceso**:
```python
tenant_schemas = list(user.tenants.values_list("schema_name", flat=True))
# Ejemplo: ["empresa-a", "empresa-b", "empresa-c"]

return Response({
    "tenantAccess": tenant_schemas,
    # ...
})
```

**Frontend permite cambiar tenant**:
```typescript
const cambiarTenant = async (nuevoSchema: string) => {
  await setSecureItem("schema", nuevoSchema);
  window.location.reload();  // Recargar con nuevo tenant
};
```

---

## Gestión de Tokens JWT

### Estructura del Token

```json
{
  "header": {
    "alg": "HS256",
    "typ": "JWT"
  },
  "payload": {
    "user_id": 123,
    "username": "user@example.com",
    "exp": 1735686000,
    "iat": 1735682400,
    "jti": "abc123..."
  },
  "signature": "..."
}
```

### Refresh Flow

```
┌──────────┐                    ┌───────────┐
│ Frontend │                    │  Backend  │
└─────┬────┘                    └─────┬─────┘
      │                               │
      │  1. API Request               │
      ├──────────────────────────────>│
      │     Authorization: Bearer XXX  │
      │                               │
      │  2. 401 Unauthorized          │
      │<──────────────────────────────┤
      │     (token expirado)          │
      │                               │
      │  3. POST /api/token/refresh/  │
      ├──────────────────────────────>│
      │     { refresh: "YYY" }        │
      │                               │
      │  4. { access: "ZZZ" }         │
      │<──────────────────────────────┤
      │                               │
      │  5. Retry Request             │
      ├──────────────────────────────>│
      │     Authorization: Bearer ZZZ  │
      │                               │
      │  6. 200 OK + Data             │
      │<──────────────────────────────┤
      │                               │
```

### Endpoints

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/login/` | POST | Autenticación inicial, retorna access + refresh |
| `/api/token/refresh/` | POST | Obtener nuevo access token |
| `/api/yo/` | GET | Información del usuario actual (requiere auth) |

---

## Características de Seguridad

### 1. Almacenamiento Encriptado de Tokens

**Problema**: LocalStorage es vulnerable a XSS
**Solución**: Secure Storage con doble capa

```typescript
// ✅ SEGURO
await setSecureItem("access", token);
// Guarda en:
// 1. memoria (no accesible por scripts)
// 2. sessionStorage encriptado (AES-GCM)

// ❌ INSEGURO (no usar)
localStorage.setItem("access", token);
```

**Beneficios**:
- Protección contra XSS
- Tokens no persisten después de cerrar tab
- Encriptación con key derivada de navegador

### 2. Django Axes - Protección Fuerza Bruta

**Configuración**:
```python
# settings.py
AXES_FAILURE_LIMIT = 5
AXES_COOLOFF_TIME = 1  # hora
AXES_LOCKOUT_PARAMETERS = ["username", "ip_address", "user_agent"]
```

**Tracking**:
```python
# Rastrea por:
# - Email del usuario
# - Dirección IP
# - User Agent del navegador

# Después de 5 intentos fallidos → Bloqueo por 1 hora
# Después de login exitoso → Reset contador
```

### 3. Seguridad Basada en Ubicación (GeoLite2)

**Detección de Viaje Imposible**:
```python
# security/services.py
class LocationSecurityService:
    def check_login_security(self, user, request):
        ip = request.META['REMOTE_ADDR']
        location = self.geolocate(ip)

        last_login = user.last_login_location

        # Calcular distancia y tiempo
        distance_km = haversine(location, last_login.location)
        time_hours = (now() - last_login.timestamp).total_seconds() / 3600

        # Velocidad = distancia / tiempo
        if distance_km / time_hours > 900:  # > 900 km/h (imposible)
            return 'BLOCK'

        if location.country != last_login.country:
            return 'REQUIRE_2FA'

        return True
```

**Acciones**:
- `BLOCK`: Bloquea login, envía email de alerta
- `REQUIRE_2FA`: Requiere verificación adicional
- `True`: Permite login normal

### 4. CORS Configuration

```python
# settings.py
CORS_ALLOWED_ORIGINS = [
    "https://app.checkouters.com",
    "http://localhost:3000",
]

CORS_ALLOW_HEADERS = [
    ...default_headers,
    "Authorization",
    "X-Tenant",
]

CORS_ALLOW_CREDENTIALS = True
```

---

## API de Usuario Actual

### GET /api/yo/

Retorna información del usuario autenticado y su tenant actual.

**Request**:
```http
GET /api/yo/ HTTP/1.1
Authorization: Bearer eyJ0eXAi...
X-Tenant: empresa-abc
```

**Response**:
```json
{
  "id": 123,
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "global": {
    "es_superadmin": false,
    "es_empleado_interno": true,
    "roles_por_tenant": {
      "empresa-abc": {
        "rol": "empleado",
        "tienda_id": 5
      },
      "empresa-xyz": {
        "rol": "manager",
        "tienda_id": 8
      }
    },
    "rol_actual": {
      "rol": "empleado",
      "tienda_id": 5
    }
  },
  "tenant": {
    "schema": "empresa-abc",
    "name": "Empresa ABC S.L.",
    "solo_empresas": false,
    "es_demo": false,
    "management_mode": "default"
  }
}
```

**Uso en Frontend**:
```typescript
// hooks/useUsuarioActual.ts
export function useUsuarioActual() {
  return useQuery({
    queryKey: ['usuario-actual'],
    queryFn: async () => {
      const { data } = await api.get('/api/yo/');
      return data;
    }
  });
}

// En componente
const { data: usuario } = useUsuarioActual();
console.log(usuario.tenant.schema);  // "empresa-abc"
```

---

## Troubleshooting

### Problema: "Empresa no encontrada" (404)

**Causa**: El slug de empresa no existe en la BD.

**Verificar**:
```sql
SELECT slug, schema_name, name FROM companies_company;
```

**Solución**:
- Verificar que el tenant exista
- Usuario debe escribir slug exacto (ej: "empresa-abc", no "Empresa ABC")

---

### Problema: "Cuenta bloqueada" (403)

**Causa**: Django Axes bloqueó después de 5 intentos fallidos.

**Ver intentos**:
```python
from axes.models import AccessAttempt
AccessAttempt.objects.filter(username='user@example.com')
```

**Desbloquear manualmente**:
```python
AccessAttempt.objects.filter(username='user@example.com').delete()
```

**Esperar**: 1 hora (AXES_COOLOFF_TIME)

---

### Problema: Token expirado constantemente

**Verificar configuración**:
```python
# settings.py
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),   # Vida del access token
    'REFRESH_TOKEN_LIFETIME': timedelta(days=7),      # Vida del refresh token
}
```

**Debug**:
```typescript
// Ver expiración del token
const token = await getSecureItem("access");
const payload = JSON.parse(atob(token.split('.')[1]));
console.log('Expira:', new Date(payload.exp * 1000));
```

---

### Problema: Usuario tiene acceso pero ve "Sin permisos"

**Verificar permisos en tenant**:
```python
from tenant_users.permissions.models import UserTenantPermissions

# En schema del tenant
with schema_context("empresa-abc"):
    perms = UserTenantPermissions.objects.filter(
        user__email='user@example.com'
    )
    print(perms)  # Debe existir
```

**Crear permiso si falta**:
```python
UserTenantPermissions.objects.create(
    user=user,
    profile=company
)
```

---

### Problema: Headers X-Tenant no llega al backend

**Verificar CORS**:
```python
# settings.py - debe incluir X-Tenant
CORS_ALLOW_HEADERS = [..., "X-Tenant"]
```

**Verificar Middleware**:
```python
# settings.py - orden correcto
MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",  # PRIMERO
    "django_test_app.middleware.custom_tenant_middleware.HeaderTenantMiddleware",
    ...
]
```

**Debug en Frontend**:
```typescript
api.interceptors.request.use(config => {
  console.log('Headers:', config.headers);
  return config;
});
```

---

## Testing

### Cobertura de Tests

**Frontend** (49 tests):
- **API Tests**: 24 tests (auth-advanced.test.ts)
  - Login error scenarios
  - Token refresh con race conditions
  - Header management
- **Component Tests**: 25 tests (LoginForm.test.tsx)
  - Form validation
  - User interactions
  - Error handling

**Backend** (23 tests):
- **test_login.py**: Tests de autenticación
  - Login multi-tenant
  - Django Axes protection
  - Location-based security
  - JWT generation

### Ejecutar Tests

**Frontend**:
```bash
cd tenant-frontend

# Todos los tests
pnpm test

# Solo autenticación
pnpm test auth

# Con cobertura
pnpm test:coverage
```

**Backend**:
```bash
cd tenants-backend
source venv/bin/activate

# Todos los tests de auth
pytest django_test_app/users/tests/test_login.py -v

# Test específico
pytest django_test_app/users/tests/test_login.py::TestLoginEndpoint::test_successful_login_in_tenant -v
```

---

## Referencias

### Archivos Clave

**Frontend**:
- `src/features/auth/components/LoginForm.tsx` - Formulario de login
- `src/services/api.ts` - Cliente Axios con interceptores
- `src/shared/lib/secureStorage.ts` - Almacenamiento encriptado
- `src/context/UsuarioContext.tsx` - Context de usuario

**Backend**:
- `django_test_app/users/views.py` - TenantLoginView
- `django_test_app/middleware/custom_tenant_middleware.py` - Middleware multi-tenant
- `security/services.py` - LocationSecurityService
- `checkouters/serializers/user.py` - CustomTokenObtainPairSerializer

### Documentación Externa

- [Django Tenants](https://django-tenants.readthedocs.io/)
- [SimpleJWT](https://django-rest-framework-simplejwt.readthedocs.io/)
- [Django Axes](https://django-axes.readthedocs.io/)
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/SubtleCrypto)

---

**Última actualización**: 2025-01-17
**Versión**: 1.0
**Autor**: Equipo Zirqulotech
