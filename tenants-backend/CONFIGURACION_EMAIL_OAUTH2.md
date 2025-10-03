# Configuración de Email con OAuth2 para Microsoft 365

Este documento explica cómo configurar el envío de emails usando **OAuth2** en lugar de contraseñas SMTP tradicionales.

## ¿Por qué OAuth2?

- **Más seguro**: No requiere almacenar contraseñas en texto plano
- **Cumple con Microsoft**: Microsoft desactivará autenticación básica SMTP
- **Sin 2FA**: No necesitas crear contraseñas de aplicación
- **Auditable**: Mejor trazabilidad en logs de Azure AD

## Requisitos Previos

1. Cuenta de Microsoft 365 Business o Enterprise
2. Acceso de administrador a Azure AD
3. Email configurado en Microsoft 365 (ej: `seguridad@zirqulo.com`)

## Paso 1: Crear App Registration en Azure AD

### 1.1 Acceder a Azure Portal

1. Ve a [https://portal.azure.com](https://portal.azure.com)
2. Inicia sesión con tu cuenta de administrador
3. Busca **"Azure Active Directory"** en el buscador superior

### 1.2 Crear una nueva aplicación

1. En el menú izquierdo, haz clic en **"App registrations"**
2. Haz clic en **"+ New registration"**
3. Completa el formulario:
   - **Name**: `Django Email Service` (o el nombre que prefieras)
   - **Supported account types**: Selecciona **"Accounts in this organizational directory only"** (Single tenant)
   - **Redirect URI**: Déjalo vacío (no es necesario para envío de emails)
4. Haz clic en **"Register"**

### 1.3 Copiar IDs importantes

Una vez creada la app, verás la página de **Overview**. Copia estos valores:

- **Application (client) ID**: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
  - Guárdalo como `MICROSOFT_CLIENT_ID`

- **Directory (tenant) ID**: `yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy`
  - Guárdalo como `MICROSOFT_TENANT_ID`

## Paso 2: Crear Client Secret

1. En el menú izquierdo de tu app, haz clic en **"Certificates & secrets"**
2. Haz clic en **"+ New client secret"**
3. Configura:
   - **Description**: `Django Email Backend Secret`
   - **Expires**: Selecciona **24 months** (o según tu política de seguridad)
4. Haz clic en **"Add"**
5. **⚠️ IMPORTANTE**: Copia inmediatamente el **Value** del secret (solo se muestra una vez)
   - Guárdalo como `MICROSOFT_CLIENT_SECRET`
   - Si no lo copias ahora, tendrás que crear uno nuevo

## Paso 3: Configurar Permisos de API

### 3.1 Añadir permisos de Microsoft Graph

1. En el menú izquierdo de tu app, haz clic en **"API permissions"**
2. Haz clic en **"+ Add a permission"**
3. Selecciona **"Microsoft Graph"**
4. Selecciona **"Application permissions"** (no "Delegated permissions")
5. Busca y marca:
   - **Mail.Send** (Permite enviar emails como cualquier usuario)
6. Haz clic en **"Add permissions"**

### 3.2 Dar consentimiento de administrador

1. Haz clic en **"Grant admin consent for [tu organización]"**
2. Confirma haciendo clic en **"Yes"**
3. Verifica que el estado sea **"Granted for [tu organización]"** en verde ✅

## Paso 4: Configurar Django

### 4.1 Editar archivo `.env`

Abre el archivo `tenants-backend/.env` y actualiza estas variables:

```bash
# Email Configuration (Microsoft 365 OAuth2)
EMAIL_BACKEND=security.email_backend.MicrosoftOAuth2EmailBackend
DEFAULT_FROM_EMAIL=seguridad@zirqulo.com  # ← Tu email real

# Credenciales de Azure AD (valores copiados de Azure Portal)
MICROSOFT_CLIENT_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
MICROSOFT_CLIENT_SECRET=tu-client-secret-value-aqui
MICROSOFT_TENANT_ID=yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy
```

### 4.2 Instalar dependencias

```bash
cd tenants-backend
source venv/bin/activate
pip install msal
```

## Paso 5: Probar el envío de emails

### 5.1 Desde Django shell

```bash
cd tenants-backend
source venv/bin/activate
python manage.py shell
```

```python
from django.core.mail import send_mail

send_mail(
    subject='Test desde Django con OAuth2',
    message='Este es un email de prueba usando Microsoft Graph API',
    from_email='soporte@zirqulo.com',
    recipient_list=['orisepu@gmail.com'],
    fail_silently=False
)
```

Si todo está bien configurado, deberías ver:

```
DEBUG: Access token obtenido exitosamente
INFO: Email enviado exitosamente a ['tu-email-personal@ejemplo.com']
```

### 5.2 Verificar email recibido

1. Revisa tu bandeja de entrada
2. El email debe aparecer como enviado desde `seguridad@zirqulo.com`
3. Debe estar en la carpeta **Enviados** de `seguridad@zirqulo.com` en Outlook

## Paso 6: Probar alertas de seguridad

El sistema de seguridad enviará emails automáticamente cuando:

1. **Login desde país diferente**: Email con template `alert_different_country.html`
2. **Viaje imposible detectado**: Email con template `alert_impossible_travel.html`

Para probar las alertas:

```python
from security.services import LocationSecurityService
from django.contrib.auth import get_user_model
from django.test import RequestFactory

# Crear servicio
service = LocationSecurityService()

# Obtener un usuario de prueba
User = get_user_model()
user = User.objects.first()

# Simular request
factory = RequestFactory()
request = factory.post('/api/token/')
request.META['REMOTE_ADDR'] = '8.8.8.8'  # IP de prueba (Google DNS)

# Probar detección
result = service.check_login_security(user, request)
print(f"Resultado: {result}")
```

## Troubleshooting

### Error: "AADSTS700016: Application not found"

**Causa**: El `MICROSOFT_CLIENT_ID` o `MICROSOFT_TENANT_ID` son incorrectos.

**Solución**: Verifica que hayas copiado correctamente los IDs de la página Overview de tu app.

### Error: "AADSTS7000215: Invalid client secret"

**Causa**: El `MICROSOFT_CLIENT_SECRET` es incorrecto o ha expirado.

**Solución**:
1. Ve a "Certificates & secrets" en Azure Portal
2. Elimina el secret antiguo
3. Crea uno nuevo
4. Actualiza el valor en `.env`

### Error: "Insufficient privileges to complete the operation"

**Causa**: No se dieron permisos de administrador a la app.

**Solución**:
1. Ve a "API permissions" en Azure Portal
2. Haz clic en "Grant admin consent for [tu organización]"
3. Espera 5-10 minutos para que se propague el cambio

### Error: "Access token not obtained"

**Causa**: Configuración incorrecta en `.env` o permisos faltantes.

**Solución**:
1. Verifica que todos los valores en `.env` estén correctos
2. Verifica que el permiso `Mail.Send` esté otorgado con consentimiento de admin
3. Revisa los logs de Django para más detalles:

```bash
tail -f logs/django.log | grep -i "email\|msal\|oauth"
```

### Email enviado pero no llega

**Causa**: El email remitente no existe en tu tenant de Microsoft 365.

**Solución**:
1. Verifica que `DEFAULT_FROM_EMAIL` sea un email válido en tu organización
2. El usuario debe tener un buzón activo en Microsoft 365
3. Verifica en "Exchange admin center" que el buzón esté configurado

## Seguridad y Mejores Prácticas

### Rotación de secrets

Los client secrets tienen una fecha de expiración. Configura recordatorios:

1. **90 días antes**: Crear nuevo secret
2. **60 días antes**: Actualizar `.env` en desarrollo
3. **30 días antes**: Actualizar `.env` en producción
4. **Día de expiración**: Eliminar secret antiguo

### Permisos mínimos

La app solo tiene permiso `Mail.Send`. **No añadas más permisos** a menos que sea absolutamente necesario.

### Logs de auditoría

Todos los emails enviados quedan registrados en:

1. **Azure AD Sign-in logs**: Ver actividad de la aplicación
2. **Microsoft 365 Audit logs**: Ver emails enviados
3. **Django logs**: Ver intentos de envío locales

## Alternativa: SMTP Tradicional (No Recomendado)

Si por alguna razón no puedes usar OAuth2, puedes volver a SMTP tradicional:

```bash
# En .env, comenta OAuth2 y descomenta SMTP:

# EMAIL_BACKEND=security.email_backend.MicrosoftOAuth2EmailBackend
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.office365.com
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=seguridad@zirqulo.com
EMAIL_HOST_PASSWORD=tu-contraseña-de-aplicación
```

**⚠️ ADVERTENCIA**: Microsoft está desactivando gradualmente la autenticación básica SMTP. Usa OAuth2 para evitar problemas futuros.

## Referencias

- [Microsoft Graph API - Send Mail](https://learn.microsoft.com/en-us/graph/api/user-sendmail)
- [MSAL Python Documentation](https://msal-python.readthedocs.io/)
- [Azure AD App Registration](https://learn.microsoft.com/en-us/azure/active-directory/develop/quickstart-register-app)

## Soporte

Si tienes problemas, revisa:

1. Logs de Django: `python manage.py runserver` (ver consola)
2. Logs de Azure AD: Azure Portal > Azure AD > Sign-in logs
3. Documentación en `security/email_backend.py` (comentarios en el código)
