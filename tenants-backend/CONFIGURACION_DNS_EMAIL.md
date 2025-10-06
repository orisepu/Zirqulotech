# Configuración DNS para Validación de Emails (SPF/DKIM/DMARC)

**Fecha:** 2025-10-04
**Servidor:** 83.45.228.120
**Email remitente:** soporte@zirqulo.com
**Dominio:** zirqulo.com

---

## Problema Actual

Microsoft 365 rechaza emails con error:
```
550 5.7.708 Service unavailable. Access denied, traffic not accepted from this IP
```

**Causa:** Falta configuración DNS de validación (SPF/DKIM/DMARC)

---

## Solución: Añadir Registros DNS

### 📍 Paso 1: SPF (Sender Policy Framework)

**¿Qué es?** Autoriza qué servidores pueden enviar emails desde tu dominio.

**Registro DNS a añadir en `zirqulo.com`:**

| Tipo | Nombre | Valor | TTL |
|------|--------|-------|-----|
| TXT | @ | `v=spf1 ip4:83.45.228.120 include:_spf.protection.outlook.com ~all` | 3600 |

**Explicación:**
- `v=spf1` - Versión de SPF
- `ip4:83.45.228.120` - Autoriza tu VPS
- `include:_spf.protection.outlook.com` - Autoriza Microsoft 365
- `~all` - Soft fail (recomienda rechazar otros orígenes pero permite)

**Alternativa más permisiva (si tienes otros servicios de email):**
```
v=spf1 ip4:83.45.228.120 include:_spf.protection.outlook.com include:_spf.google.com ~all
```

---

### 🔐 Paso 2: DKIM (DomainKeys Identified Mail)

**¿Qué es?** Firma criptográfica que verifica que el email no fue modificado.

#### Opción A: DKIM de Microsoft 365 (Recomendado si usas solo M365)

1. Ir a **Microsoft 365 Admin Center**
2. Ve a **Security** → **Email & collaboration** → **Policies & rules** → **Threat policies**
3. Buscar **DKIM** en configuración
4. Activar DKIM para el dominio `zirqulo.com`
5. Microsoft te dará 2 registros CNAME para añadir:

| Tipo | Nombre | Valor |
|------|--------|-------|
| CNAME | selector1._domainkey | selector1-zirqulo-com._domainkey.zirqulo.onmicrosoft.com |
| CNAME | selector2._domainkey | selector2-zirqulo-com._domainkey.zirqulo.onmicrosoft.com |

**NOTA:** Los valores exactos te los dará Microsoft 365, pueden variar.

#### Opción B: DKIM Manual (Si envías desde VPS directamente)

**Generar claves DKIM en el VPS:**

```bash
# Instalar OpenDKIM
sudo apt-get install opendkim opendkim-tools

# Generar claves
sudo mkdir -p /etc/opendkim/keys/zirqulo.com
cd /etc/opendkim/keys/zirqulo.com
sudo opendkim-genkey -s mail -d zirqulo.com

# Ver clave pública
sudo cat mail.txt
```

Esto generará un registro DNS similar a:

| Tipo | Nombre | Valor | TTL |
|------|--------|-------|-----|
| TXT | mail._domainkey | `v=DKIM1; k=rsa; p=MIGfMA0GCSq...` (muy largo) | 3600 |

**⚠️ IMPORTANTE:** Si usas OAuth2 con Microsoft 365, usa **Opción A** (DKIM de Microsoft).

---

### 📧 Paso 3: DMARC (Domain-based Message Authentication)

**¿Qué es?** Política de qué hacer con emails que fallen SPF/DKIM.

**Registro DNS a añadir en `zirqulo.com`:**

| Tipo | Nombre | Valor | TTL |
|------|--------|-------|-----|
| TXT | _dmarc | `v=DMARC1; p=none; rua=mailto:dmarc@zirqulo.com; pct=100` | 3600 |

**Explicación:**
- `v=DMARC1` - Versión
- `p=none` - Política: No rechazar (solo monitorear) - RECOMENDADO PARA EMPEZAR
- `rua=mailto:dmarc@zirqulo.com` - Email donde recibir reportes
- `pct=100` - Aplicar a 100% de emails

**Políticas disponibles:**
- `p=none` - Solo monitorear (inicio)
- `p=quarantine` - Mover a spam si falla
- `p=reject` - Rechazar completamente

**⚠️ Recomendación:** Empieza con `p=none`, luego de 1 semana cambia a `p=quarantine` o `p=reject`.

---

## 🚀 Aplicar Cambios en DNS

### Dónde añadir estos registros

1. **Acceder a tu proveedor DNS:**
   - Si usas Cloudflare: https://dash.cloudflare.com
   - Si usas GoDaddy: Panel de control de dominios
   - Si usas Namecheap: Domain List → Manage → Advanced DNS
   - Si es otro proveedor: Buscar sección "DNS Management" o "Zone Editor"

2. **Añadir los 3 registros:**
   - 1 TXT para SPF en `@` (raíz del dominio)
   - 2 CNAME o 1 TXT para DKIM (según opción elegida)
   - 1 TXT para DMARC en `_dmarc`

3. **Guardar cambios**

4. **Esperar propagación DNS:** 5-30 minutos (puede tardar hasta 48 horas)

---

## ✅ Verificar Configuración

### Herramientas Online

**1. Verificar SPF:**
```
https://mxtoolbox.com/spf.aspx
Domain: zirqulo.com
```

**2. Verificar DKIM:**
```
https://mxtoolbox.com/dkim.aspx
Domain: zirqulo.com
Selector: mail (o el que uses)
```

**3. Verificar DMARC:**
```
https://mxtoolbox.com/dmarc.aspx
Domain: zirqulo.com
```

**4. Verificación completa de email:**
```
https://www.mail-tester.com/
```
Envía un email a la dirección que te dan y te darán una puntuación sobre 10.

### Verificar desde Terminal

```bash
# Verificar SPF
dig +short zirqulo.com TXT | grep spf

# Verificar DMARC
dig +short _dmarc.zirqulo.com TXT

# Verificar DKIM
dig +short mail._domainkey.zirqulo.com TXT
```

---

## 🧪 Probar Envío de Email

Una vez configurado y propagado DNS (esperar 30 minutos):

```bash
cd /srv/checkouters/Partners/tenants-backend

python manage.py shell -c "
from django.core.mail import send_mail
from django.conf import settings

send_mail(
    subject='✅ Test después de configurar DNS',
    message='Si recibes este email, SPF/DKIM/DMARC están configurados correctamente.',
    from_email=settings.DEFAULT_FROM_EMAIL,
    recipient_list=['orisepu@gmail.com'],
    fail_silently=False
)
print('Email enviado. Revisa inbox y spam.')
"
```

---

## 📋 Resumen de Configuración

| Registro | Tipo | Nombre | Valor |
|----------|------|--------|-------|
| **SPF** | TXT | @ | `v=spf1 ip4:83.45.228.120 include:_spf.protection.outlook.com ~all` |
| **DKIM 1** | CNAME | selector1._domainkey | selector1-zirqulo-com._domainkey.zirqulo.onmicrosoft.com |
| **DKIM 2** | CNAME | selector2._domainkey | selector2-zirqulo-com._domainkey.zirqulo.onmicrosoft.com |
| **DMARC** | TXT | _dmarc | `v=DMARC1; p=none; rua=mailto:dmarc@zirqulo.com; pct=100` |

**NOTA:** Los valores exactos de DKIM dependen de si usas Microsoft 365 o DKIM manual.

---

## 🔧 Troubleshooting

### Error: "SPF PermError"
**Causa:** Sintaxis incorrecta en el registro SPF.
**Solución:** Verifica que no haya espacios extra o comillas mal cerradas.

### Error: "DKIM signature verification failed"
**Causa:** Selector incorrecto o claves mal configuradas.
**Solución:** Verifica que el selector en Django coincida con el DNS.

### Email sigue siendo rechazado
**Causa:** DNS no propagado o IP en blacklist.
**Solución:**
1. Esperar 1 hora para propagación completa
2. Verificar blacklist: https://mxtoolbox.com/blacklists.aspx
3. Verificar que el conector de Exchange esté activo

### Emails van a spam
**Causa:** Reputación de IP baja o DMARC muy estricto.
**Solución:**
1. Cambiar DMARC `p=none` temporalmente
2. Enviar emails legítimos para mejorar reputación
3. Considerar servicio de relay SMTP (SendGrid, AWS SES)

---

## 📚 Referencias

- [Microsoft 365 DKIM Setup](https://learn.microsoft.com/en-us/microsoft-365/security/office-365-security/email-authentication-dkim-configure)
- [SPF Record Syntax](https://datatracker.ietf.org/doc/html/rfc7208)
- [DMARC Guide](https://dmarc.org/overview/)
- [MXToolbox](https://mxtoolbox.com/) - Herramienta completa de verificación

---

## 🆘 Soporte

Si después de configurar todo sigue fallando:

1. Exporta los resultados de MXToolbox
2. Copia los headers completos del email rechazado
3. Verifica logs de Django: `pm2 logs tenants-backend`
4. Contacta con soporte de Microsoft 365 si el error persiste

---

**Última actualización:** 2025-10-04
**Autor:** Claude Code
**Servidor:** VPS 83.45.228.120
