"""
OAuth2 Email Backend for Microsoft 365/Outlook

Usa MSAL (Microsoft Authentication Library) para autenticación OAuth2
en lugar de contraseñas tradicionales de SMTP.

Configuración necesaria en .env:
- MICROSOFT_CLIENT_ID: Application (client) ID de Azure AD
- MICROSOFT_CLIENT_SECRET: Client secret value de Azure AD
- MICROSOFT_TENANT_ID: Directory (tenant) ID de Azure AD
- DEFAULT_FROM_EMAIL: Email desde el que se envían los correos

Guía para configurar Azure AD:
1. Ve a https://portal.azure.com
2. Azure Active Directory > App registrations > New registration
3. Name: "Django Email Service"
4. Supported account types: Single tenant
5. Register
6. Copia el Application (client) ID → MICROSOFT_CLIENT_ID
7. Copia el Directory (tenant) ID → MICROSOFT_TENANT_ID
8. Certificates & secrets > New client secret
9. Copia el secret value → MICROSOFT_CLIENT_SECRET
10. API permissions > Add permission > Microsoft Graph > Application permissions
11. Añade: Mail.Send
12. Grant admin consent
"""

import logging
import msal
import re
import requests
from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend
from django.core.exceptions import ValidationError
from django.core.validators import validate_email

logger = logging.getLogger(__name__)


def extract_and_validate_email(email_string):
    """
    Extrae y valida un email de una cadena que puede tener formato "Name <email@domain.com>" o "email@domain.com".

    Args:
        email_string (str): Cadena que contiene un email

    Returns:
        str: Email validado y limpio

    Raises:
        ValidationError: Si el email no es válido
    """
    if not email_string or not isinstance(email_string, str):
        raise ValidationError("Email string cannot be empty or non-string")

    email_string = email_string.strip()

    # Patrón regex para extraer email de formato "Name <email@domain.com>"
    # Grupo de captura para el email dentro de < >
    match = re.search(r'<([^>]+)>', email_string)

    if match:
        # Extraído de formato "Name <email@domain.com>"
        email = match.group(1).strip()
    else:
        # Asumir que es solo el email sin formato
        email = email_string

    # Validar el email extraído usando el validador de Django
    try:
        validate_email(email)
        return email
    except ValidationError as e:
        logger.error(f"Invalid email format: '{email_string}' -> extracted: '{email}'")
        raise ValidationError(f"Invalid email address: {email}") from e


class MicrosoftOAuth2EmailBackend(BaseEmailBackend):
    """
    Backend de email usando OAuth2 con Microsoft Graph API.

    Soporta autenticación moderna sin contraseñas SMTP.
    """

    def __init__(self, fail_silently=False, **kwargs):
        super().__init__(fail_silently=fail_silently)

        # Configuración de Azure AD
        self.client_id = getattr(settings, 'MICROSOFT_CLIENT_ID', None)
        self.client_secret = getattr(settings, 'MICROSOFT_CLIENT_SECRET', None)
        self.tenant_id = getattr(settings, 'MICROSOFT_TENANT_ID', None)
        self.from_email = getattr(settings, 'DEFAULT_FROM_EMAIL', None)

        # Validar configuración
        if not all([self.client_id, self.client_secret, self.tenant_id, self.from_email]):
            logger.error(
                "Microsoft OAuth2 email backend requiere: "
                "MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, "
                "MICROSOFT_TENANT_ID, DEFAULT_FROM_EMAIL"
            )
            if not fail_silently:
                raise ValueError("Missing Microsoft OAuth2 configuration")

        # MSAL authority URL
        self.authority = f"https://login.microsoftonline.com/{self.tenant_id}"
        self.scope = ["https://graph.microsoft.com/.default"]

        # Microsoft Graph API endpoint
        self.graph_endpoint = "https://graph.microsoft.com/v1.0"

        # Cache de access token
        self._access_token = None

    def _get_access_token(self):
        """
        Obtiene un access token usando MSAL con client credentials flow.

        Returns:
            str: Access token válido
        """
        try:
            # Crear cliente confidencial de MSAL
            app = msal.ConfidentialClientApplication(
                client_id=self.client_id,
                client_credential=self.client_secret,
                authority=self.authority
            )

            # Obtener token usando client credentials flow
            result = app.acquire_token_for_client(scopes=self.scope)

            if "access_token" in result:
                logger.debug("Access token obtenido exitosamente")
                return result["access_token"]
            else:
                error_msg = result.get("error_description", result.get("error", "Unknown error"))
                logger.error(f"Error obteniendo access token: {error_msg}")
                if not self.fail_silently:
                    raise Exception(f"MSAL token error: {error_msg}")
                return None

        except Exception as e:
            logger.error(f"Exception obteniendo access token: {e}")
            if not self.fail_silently:
                raise
            return None

    def send_messages(self, email_messages):
        """
        Envía una lista de mensajes de email usando Microsoft Graph API.

        Args:
            email_messages: Lista de EmailMessage objects

        Returns:
            int: Número de emails enviados exitosamente
        """
        if not email_messages:
            return 0

        # Obtener access token
        access_token = self._get_access_token()
        if not access_token:
            logger.error("No se pudo obtener access token")
            return 0

        num_sent = 0
        for message in email_messages:
            try:
                if self._send_message(message, access_token):
                    num_sent += 1
            except Exception as e:
                logger.error(f"Error enviando email: {e}")
                if not self.fail_silently:
                    raise

        return num_sent

    def _send_message(self, message, access_token):
        """
        Envía un único mensaje usando Microsoft Graph API.

        Args:
            message: EmailMessage object
            access_token: Access token de Microsoft Graph

        Returns:
            bool: True si el envío fue exitoso
        """
        try:
            # Construir payload de Microsoft Graph
            graph_message = self._build_graph_message(message)

            # Headers de la petición
            headers = {
                'Authorization': f'Bearer {access_token}',
                'Content-Type': 'application/json'
            }

            # ✅ Endpoint para enviar email con validación robusta
            # Extraer y validar email limpio del remitente
            from_email = message.from_email or self.from_email

            try:
                # Usar función segura de extracción y validación
                from_email = extract_and_validate_email(from_email)
                logger.debug(f"Enviando email desde: {from_email}")
            except ValidationError as e:
                logger.error(f"Invalid from_email: {e}")
                if not self.fail_silently:
                    raise
                return False

            endpoint = f"{self.graph_endpoint}/users/{from_email}/sendMail"

            # Enviar petición
            response = requests.post(
                endpoint,
                headers=headers,
                json=graph_message
            )

            if response.status_code == 202:  # Accepted
                logger.info(f"Email enviado exitosamente a {message.to}")
                return True
            else:
                logger.error(
                    f"Error enviando email (status {response.status_code}): "
                    f"{response.text}"
                )
                if not self.fail_silently:
                    raise Exception(f"Graph API error: {response.text}")
                return False

        except Exception as e:
            logger.error(f"Exception enviando email: {e}")
            if not self.fail_silently:
                raise
            return False

    def _build_graph_message(self, message):
        """
        Convierte un EmailMessage de Django a formato Microsoft Graph.

        Args:
            message: EmailMessage object de Django

        Returns:
            dict: Payload en formato Microsoft Graph API
        """
        # ✅ Convertir destinatarios a formato Graph con validación
        to_recipients = []
        for addr in message.to:
            try:
                validated_addr = extract_and_validate_email(addr)
                to_recipients.append({"emailAddress": {"address": validated_addr}})
            except ValidationError:
                logger.warning(f"Skipping invalid TO email: {addr}")
                # Si fail_silently está habilitado, continuamos; si no, el error se propagará

        cc_recipients = []
        if message.cc:
            for addr in message.cc:
                try:
                    validated_addr = extract_and_validate_email(addr)
                    cc_recipients.append({"emailAddress": {"address": validated_addr}})
                except ValidationError:
                    logger.warning(f"Skipping invalid CC email: {addr}")

        bcc_recipients = []
        if message.bcc:
            for addr in message.bcc:
                try:
                    validated_addr = extract_and_validate_email(addr)
                    bcc_recipients.append({"emailAddress": {"address": validated_addr}})
                except ValidationError:
                    logger.warning(f"Skipping invalid BCC email: {addr}")

        # Determinar content type
        content_type = "HTML" if message.content_subtype == "html" else "Text"

        # Construir mensaje en formato Graph
        graph_message = {
            "message": {
                "subject": message.subject,
                "body": {
                    "contentType": content_type,
                    "content": message.body
                },
                "toRecipients": to_recipients,
            },
            "saveToSentItems": "true"
        }

        # Añadir CC si existen
        if cc_recipients:
            graph_message["message"]["ccRecipients"] = cc_recipients

        # Añadir BCC si existen
        if bcc_recipients:
            graph_message["message"]["bccRecipients"] = bcc_recipients

        # Añadir attachments si existen
        if message.attachments:
            graph_message["message"]["attachments"] = self._build_attachments(message)

        return graph_message

    def _build_attachments(self, message):
        """
        Convierte attachments de Django a formato Microsoft Graph.

        Args:
            message: EmailMessage object

        Returns:
            list: Lista de attachments en formato Graph
        """
        import base64

        attachments = []
        for attachment in message.attachments:
            # attachment puede ser tuple (filename, content, mimetype)
            if isinstance(attachment, tuple) and len(attachment) == 3:
                filename, content, mimetype = attachment

                # Codificar contenido en base64
                if isinstance(content, str):
                    content = content.encode()
                content_bytes = base64.b64encode(content).decode()

                attachments.append({
                    "@odata.type": "#microsoft.graph.fileAttachment",
                    "name": filename,
                    "contentType": mimetype,
                    "contentBytes": content_bytes
                })

        return attachments
