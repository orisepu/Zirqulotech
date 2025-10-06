# Configuración de Conector de Exchange Online para VPS

**Fecha:** 2025-10-04
**IP del VPS:** 83.45.228.120
**Dominio:** zirqulo.com
**Error actual:** 550 5.7.708 Service unavailable. Access denied, traffic not accepted from this IP

---

## ¿Qué es un Conector de Exchange?

Un **conector** es una configuración en Microsoft 365 que le dice a Exchange Online:
> "Acepta emails que vengan desde esta IP específica (83.45.228.120) porque es nuestro servidor legítimo"

Sin el conector, Microsoft 365 rechaza todos los emails que vengan desde IPs externas por seguridad.

---

## 📋 Paso 1: Acceder a Exchange Admin Center

1. Abre tu navegador
2. Ve a: **https://admin.exchange.microsoft.com**
3. Inicia sesión con tu cuenta de administrador de Microsoft 365
4. Espera a que cargue el panel

---

## 📋 Paso 2: Navegar a Connectors

1. En el **menú lateral izquierdo**, busca **"Mail flow"**
2. Haz clic en **"Mail flow"** para expandir el menú
3. Dentro de "Mail flow", haz clic en **"Connectors"**

**Deberías ver:**
- Una lista de conectores existentes (puede estar vacía)
- Un botón **"+ Add a connector"** en la parte superior

---

## 📋 Paso 3: Verificar si Ya Existe un Conector

**Busca en la lista** si ya existe un conector con:
- **From:** `Your organization's email server`
- **To:** `Office 365`

### Si YA existe:

1. **Haz clic** en el nombre del conector
2. Verifica que tenga:
   - **Status:** `On` (activado, toggle verde)
   - **IP address:** `83.45.228.120` (tu VPS)
3. Si está desactivado → **Actívalo** (toggle en la parte superior)
4. Si falta la IP → **Edit** → **How Exchange identifies email...** → Añade `83.45.228.120`
5. **Save**

**IMPORTANTE:** Si el conector ya existe y está bien configurado, pasa al **Paso 6 (Troubleshooting avanzado)**.

### Si NO existe:

Continúa al **Paso 4** para crear uno nuevo.

---

## 📋 Paso 4: Crear Nuevo Conector (Si No Existe)

### 4.1 Iniciar creación

1. Haz clic en el botón **"+ Add a connector"**
2. Se abrirá un asistente paso a paso

---

### 4.2 Connection from and to (Paso 1 del asistente)

**Pregunta:** "Where do you want to send email from?"

**Selecciona:**
- **Connection from:** `Your organization's email server`

**Pregunta:** "Where do you want to send email to?"

**Selecciona:**
- **Connection to:** `Office 365`

**Haz clic en:** `Next`

**Explicación:** Esto le dice a Microsoft que los emails VAN DESDE tu servidor HACIA Office 365 (para que Office 365 los acepte y reenvíe).

---

### 4.3 Connector name (Paso 2 del asistente)

**Campos a llenar:**

- **Name:** `VPS Zirqulo Inbound Connector`
  - (Puedes poner el nombre que quieras, pero que sea descriptivo)

- **Description:** `Allows emails from VPS 83.45.228.120 to send via Office 365`
  - (Opcional pero recomendado)

**Opciones adicionales:**
- ❌ **NO marques** "Turn it on" todavía (lo activaremos al final)

**Haz clic en:** `Next`

---

### 4.4 Identifying email from your server (Paso 3 del asistente - CRÍTICO)

**Pregunta:** "How should Office 365 identify email from your email server?"

**Selecciona:**
- ✅ **By verifying that the IP address of the sending server matches one of these IP addresses that belong only to your organization**

**Debajo aparecerá un campo para añadir IPs:**

1. En el campo de texto, escribe: `83.45.228.120`
2. Haz clic en el botón **"+"** (o presiona Enter) para añadirla
3. Verifica que aparezca en la lista: `83.45.228.120`

**IMPORTANTE:** Esta es la IP pública de tu VPS. Si la pones mal, el conector NO funcionará.

**Haz clic en:** `Next`

---

### 4.5 Security restrictions (Paso 4 del asistente - CRÍTICO)

**Pregunta 1:** "Reject email messages if they aren't sent over a secure channel (TLS)"

**Selecciona:**
- ❌ **NO** (desmarcado)

**Explicación:** Tu VPS puede no tener un certificado TLS válido para email. Desactivar esto permite conexiones sin TLS.

---

**Pregunta 2:** "Require that the subject name or subject alternative name (SAN) on the certificate that your email server uses to authenticate with Office 365 matches this domain name"

**Selecciona:**
- ❌ **NO** (desmarcado)

**Explicación:** Tu VPS no tiene un certificado de dominio específico. Desactivar esto permite que el conector funcione sin validar certificados.

---

**IMPORTANTE:** Ambas opciones deben estar **DESACTIVADAS** para que funcione con tu VPS.

**Haz clic en:** `Next`

---

### 4.6 Validation email address (Paso 5 del asistente - OPCIONAL)

**Pregunta:** "Enter an email address to validate this connector"

**Puedes:**
- **Opción A:** Dejar en blanco y hacer clic en `Next` (saltar validación)
- **Opción B:** Poner `orisepu@gmail.com` y hacer clic en `Validate`

**Recomendación:** Salta la validación por ahora (Opción A).

**Haz clic en:** `Next`

---

### 4.7 Review connector (Paso 6 del asistente - FINAL)

**Verifica que todo esté correcto:**

```
Name: VPS Zirqulo Inbound Connector
Connection from: Your organization's email server
Connection to: Office 365
IP address: 83.45.228.120
TLS required: No
Certificate validation: No
Status: Off (lo activaremos después)
```

**Si todo está bien:**
- Haz clic en **`Save`** o **`Create connector`**

**Aparecerá un mensaje:**
- "Connector created successfully" ✅

---

## 📋 Paso 5: Activar el Conector

1. Vuelve a la lista de conectores (**Mail flow** → **Connectors**)
2. Busca tu conector recién creado: `VPS Zirqulo Inbound Connector`
3. Haz clic en el **nombre** del conector
4. En la parte superior derecha verás un **toggle** (interruptor)
5. **Actívalo** (debe quedar en verde: `On`)
6. **Guardar** si es necesario

---

## 📋 Paso 6: Probar el Conector

Después de activar el conector, **espera 2-3 minutos** para que se aplique la configuración.

### Desde el VPS, ejecuta:

```bash
cd /srv/checkouters/Partners/tenants-backend

python manage.py shell -c "
from django.core.mail import send_mail

send_mail(
    subject='✅ Test Conector Exchange - Zirqulo',
    message='Este email confirma que el conector de Exchange Online está funcionando correctamente.',
    from_email='soporte@zirqulo.com',
    recipient_list=['orisepu@gmail.com'],
    fail_silently=False
)
print('Email enviado. Revisa inbox en 2 minutos.')
"
```

### Resultado esperado:

- ✅ Email llega a `orisepu@gmail.com` **SIN bounce**
- ✅ No recibes email de error con código 550 5.7.708

### Si sigue fallando:

Ve al **Paso 7 (Troubleshooting avanzado)**.

---

## 📋 Paso 7: Troubleshooting Avanzado

### 7.1 Verificar que el conector esté realmente activo

1. Exchange Admin Center → **Mail flow** → **Connectors**
2. Haz clic en tu conector
3. Verifica:
   - **Status:** `On` (verde)
   - **Enabled:** `Yes`

### 7.2 Verificar logs del conector

1. En la página del conector, busca **"View details"** o **"Connector usage"**
2. Revisa si aparecen intentos de conexión desde `83.45.228.120`
3. Si NO aparece nada → El tráfico no está llegando al conector

### 7.3 Verificar que la IP es correcta

Desde el VPS, ejecuta:

```bash
curl -s ifconfig.me
```

**Debe mostrar:** `83.45.228.120`

Si muestra otra IP → Actualiza el conector con la IP correcta.

### 7.4 Problema: OAuth2 vs Conector

**IMPORTANTE:** Estás usando `MicrosoftOAuth2EmailBackend`. Este backend:

1. **NO envía emails vía SMTP** (no pasa por el conector tradicional)
2. **Envía emails vía Microsoft Graph API** (autenticación OAuth2)
3. **Microsoft Graph puede tener restricciones de IP propias**

**Solución:** Verificar restricciones de IP en Azure AD (siguiente paso).

---

## 📋 Paso 8: Verificar Restricciones de IP en Azure AD (Para OAuth2)

Si usas OAuth2, el conector de Exchange puede NO ser suficiente. Necesitas autorizar la IP en Azure AD:

### 8.1 Ir a Azure Portal

1. Ve a: **https://portal.azure.com**
2. Inicia sesión con tu cuenta de administrador

### 8.2 Ir a Azure Active Directory

1. En el menú izquierdo, haz clic en **"Azure Active Directory"**
2. O busca "Azure Active Directory" en el buscador superior

### 8.3 Verificar Conditional Access

1. En el menú izquierdo, ve a **"Security"**
2. Haz clic en **"Conditional Access"**
3. Haz clic en **"Named locations"**

**Pregunta:** ¿Hay alguna ubicación (location) definida que bloquee IPs?

**Si SÍ:**
- Añade `83.45.228.120` a las ubicaciones de confianza
- O crea una excepción para la aplicación de email

**Si NO:**
- No hay restricciones de IP → El problema es otro (continúa al siguiente paso)

### 8.4 Verificar la Aplicación de Email

1. Ve a **Azure Active Directory** → **App registrations**
2. Busca tu aplicación: `Django Email Service` (o como la hayas llamado)
3. Haz clic en ella
4. En el menú izquierdo, ve a **"Authentication"**
5. Busca sección **"Advanced settings"**
6. Verifica si hay restricciones de IP
7. Si hay → Añade `83.45.228.120` como IP permitida

---

## 📋 Paso 9: Alternativa - Cambiar a SMTP Relay

Si después de todo esto sigue sin funcionar, el problema puede ser que **Microsoft 365 no permite envío directo desde VPS externos** incluso con OAuth2.

**Solución definitiva:** Usar un servicio de relay SMTP (SendGrid, AWS SES, Mailgun).

### Configurar SendGrid (Gratis 100 emails/día):

1. Regístrate en: https://signup.sendgrid.com
2. Crea una API Key
3. Verifica tu dominio (zirqulo.com)
4. Actualiza `.env`:

```bash
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.sendgrid.net
EMAIL_PORT=587
EMAIL_USE_TLS=True
EMAIL_HOST_USER=apikey
EMAIL_HOST_PASSWORD=SG.tu-api-key-aqui
DEFAULT_FROM_EMAIL=soporte@zirqulo.com
```

5. Reinicia el backend y prueba

**Ventajas de SendGrid:**
- ✅ No necesitas conector de Exchange
- ✅ IPs con buena reputación
- ✅ Logs detallados de emails
- ✅ Gratis hasta 100 emails/día
- ✅ Configuración en 10 minutos

---

## 📊 Resumen de Configuración del Conector

| Parámetro | Valor |
|-----------|-------|
| **Nombre** | VPS Zirqulo Inbound Connector |
| **Connection from** | Your organization's email server |
| **Connection to** | Office 365 |
| **Identificación** | By IP address |
| **IP address** | 83.45.228.120 |
| **TLS required** | No |
| **Certificate validation** | No |
| **Status** | On (activado) |

---

## ❓ FAQ

### P: ¿El conector funciona con OAuth2 (MicrosoftOAuth2EmailBackend)?

**R:** **Depende**. OAuth2 usa Microsoft Graph API, que puede tener sus propias restricciones de IP en Azure AD. El conector tradicional es para SMTP.

**Solución:** Verifica restricciones de IP en Azure AD (Paso 8) o cambia a SMTP tradicional.

---

### P: ¿Cuánto tarda en aplicarse el conector?

**R:** Generalmente 2-5 minutos. En casos raros puede tardar hasta 15 minutos.

---

### P: ¿Puedo tener múltiples IPs en el conector?

**R:** Sí, puedes añadir varias IPs separadas por comas o añadirlas una por una haciendo clic en "+".

---

### P: ¿Necesito configurar algo en mi firewall del VPS?

**R:** No, el conector solo autoriza la IP en Microsoft 365. No requiere cambios en el firewall del VPS.

---

## 🆘 Soporte

Si después de seguir todos los pasos el problema persiste:

1. **Exporta la configuración del conector:**
   - Haz captura de pantalla de todos los settings
   - Copia los logs del conector si están disponibles

2. **Verifica que OAuth2 funcione:**
   - Los logs deben mostrar "Access token obtenido exitosamente"
   - Si no → Revisa credenciales de Azure AD

3. **Contacta con soporte de Microsoft 365:**
   - Proporciona el error exacto: `550 5.7.708`
   - Indica la IP del VPS: `83.45.228.120`
   - Menciona que tienes un conector configurado

4. **Considera usar SendGrid como relay:**
   - Es más confiable para VPS
   - No depende de configuraciones de Microsoft
   - Gratis hasta 100 emails/día

---

**Última actualización:** 2025-10-04
**Autor:** Claude Code
