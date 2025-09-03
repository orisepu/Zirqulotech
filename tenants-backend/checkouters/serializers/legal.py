from rest_framework import serializers
from ..models.legal import B2CContrato, LegalTemplate
from ..utils.dni import validar_dni_nie, validar_cif
from django.utils import timezone


def _mask_email(email: str) -> str:
    if not email or "@" not in email:
        return email or ""
    local, domain = email.split("@", 1)
    if len(local) <= 2:
        masked_local = local[:1] + "•" * max(0, len(local) - 1)
    else:
        masked_local = local[0] + "•" * (len(local) - 2) + local[-1]
    return f"{masked_local}@{domain}"


class B2CContratoCreateSerializer(serializers.ModelSerializer):
    cliente_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    oportunidad_id = serializers.UUIDField(write_only=True, required=False, allow_null=True)
    class Meta:
        model = B2CContrato
        fields = "__all__"

    def validate_dni_nie(self, value):
        if value and not validar_dni_nie(value):
            raise serializers.ValidationError("DNI/NIE inválido")
        return value

    def validate_nif(self, value):
        if value and not validar_dni_nie(value):
            raise serializers.ValidationError("NIF inválido")
        return value

    def validate_cif(self, value):
        if value and not validar_cif(value):
            raise serializers.ValidationError("CIF inválido")
        return value

    def validate(self, attrs):
        if not attrs.get("dni") and not attrs.get("nif") and not attrs.get("cif"):
             raise serializers.ValidationError("Debe indicar DNI/NIE o NIF o CIF.")
        return super().validate(attrs)

    def create(self, validated_data):
        cliente_id = validated_data.pop("cliente_id", None)
        oportunidad_id = validated_data.pop("oportunidad_id", None)
        contrato = B2CContrato(**validated_data)
        if cliente_id is not None:
            contrato.cliente_id = cliente_id
        if oportunidad_id is not None:
            contrato.oportunidad_id = oportunidad_id
        contrato.save()
        return contrato


class B2CContratoDetailSerializer(serializers.ModelSerializer):
    estado_legible = serializers.SerializerMethodField()
    dias_restantes_otp = serializers.SerializerMethodField()
    otp_vigente = serializers.SerializerMethodField()
    intentos_restantes = serializers.SerializerMethodField()
    firmado = serializers.SerializerMethodField()
    url_pdf_firmado = serializers.SerializerMethodField()
    canal_envio = serializers.SerializerMethodField()

    class Meta:
        model = B2CContrato
        fields = "__all__"
        read_only_fields = [f.name for f in B2CContrato._meta.fields] + [
            "estado_legible", "dias_restantes_otp", "otp_vigente",
            "intentos_restantes", "firmado", "url_pdf_firmado", "canal_envio",
            "cliente_id", 
        ]

    def get_estado_legible(self, obj):
        try:
            return obj.get_estado_display()
        except Exception:
            return obj.estado

    def get_dias_restantes_otp(self, obj):
        if not getattr(obj, "otp_expires_at", None): return 0
        now = timezone.now()
        if now >= obj.otp_expires_at: return 0
        delta = obj.otp_expires_at - now
        return max(0, int(delta.total_seconds() // 86400 + (1 if delta.total_seconds() % 86400 else 0)))

    def get_otp_vigente(self, obj):
        try:
            return bool(obj.otp_expires_at and timezone.now() < obj.otp_expires_at)
        except Exception:
            return False

    def get_intentos_restantes(self, obj):
        try:
            return max(0, int(obj.otp_max_intentos) - int(obj.otp_intentos))
        except Exception:
            return 0

    def get_firmado(self, obj):
        return bool(getattr(obj, "firmado_en", None)) and obj.estado == "firmado"

    def get_url_pdf_firmado(self, obj):
        pdf = getattr(obj, "pdf", None)
        if not pdf: return None
        try:
            url = pdf.url
        except Exception:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(url) if request else url

    def get_canal_envio(self, obj):
        if getattr(obj, "email", None):
            return _mask_email(obj.email)
        return getattr(obj, "telefono", None) or ""


class B2CContratoKYCFlagsSerializer(serializers.ModelSerializer):
    tiene_dni_anverso = serializers.SerializerMethodField()
    tiene_dni_reverso = serializers.SerializerMethodField()

    class Meta:
        model = B2CContrato
        fields = ("id", "tiene_dni_anverso", "tiene_dni_reverso", "kyc_requerido")

    def get_tiene_dni_anverso(self, obj):
        return bool(getattr(obj, "dni_anverso", None))

    def get_tiene_dni_reverso(self, obj):
        return bool(getattr(obj, "dni_reverso", None))


class B2CContratoSerializer(serializers.ModelSerializer):
    pdf_url = serializers.SerializerMethodField()
    pdf_listo = serializers.SerializerMethodField()

    class Meta:
        model = B2CContrato
        fields = "__all__"

    def get_pdf_url(self, obj):
        try:
            return obj.pdf.url if obj.pdf else None
        except Exception:
            return None

    def get_pdf_listo(self, obj):
        return obj.pdf_listo


class LegalTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = LegalTemplate
        fields = ["namespace", "slug", "title", "version", "content", "is_active", "updated_at"]
