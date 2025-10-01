from rest_framework import serializers

DISPLAY_IMAGE_CHOICES = ['OK','PIX','LINES','BURN','MURA']
GLASS_CHOICES         = ['NONE','MICRO','VISIBLE','DEEP','CHIP','CRACK']
HOUSING_CHOICES       = ['SIN_SIGNOS','MINIMOS','ALGUNOS','DESGASTE_VISIBLE','DOBLADO']


class BaseValoracionInputSerializer(serializers.Serializer):
    """
    Serializer base para valoraciones comerciales/auditorías.
    Campos comunes a todos los tipos de dispositivos.
    """
    dispositivo_id = serializers.IntegerField(required=False)
    tenant = serializers.CharField(required=False, allow_blank=True)
    canal  = serializers.ChoiceField(choices=['B2B','B2C'], required=False)

    # IDs o nombres (backend intentará resolver si faltan IDs)
    modelo_id    = serializers.IntegerField(required=False)
    capacidad_id = serializers.IntegerField(required=False)
    modelo_nombre   = serializers.CharField(required=False, allow_blank=True)
    capacidad_texto = serializers.CharField(required=False, allow_blank=True)

    # Campos básicos (todos los dispositivos)
    enciende = serializers.BooleanField(allow_null=True, required=False)
    funcional_basico_ok = serializers.BooleanField(allow_null=True, required=False)

    # Housing/chasis (todos los dispositivos)
    housing_status = serializers.ChoiceField(
        choices=HOUSING_CHOICES,
        required=False,
        allow_null=True
    )

    # Campos opcionales según tipo de dispositivo (definidos en subclases)
    # - carga: solo dispositivos con batería
    # - battery_health_pct: solo dispositivos con batería
    # - display_image_status: solo dispositivos con pantalla integrada
    # - glass_status: solo dispositivos con pantalla integrada


class ValoracionConBateriaYPantallaMixin:
    """Mixin para dispositivos con batería y pantalla (iPhone, iPad, MacBook)."""
    def get_fields(self):
        fields = super().get_fields()
        fields['carga'] = serializers.BooleanField(allow_null=True, required=False)
        fields['battery_health_pct'] = serializers.IntegerField(
            min_value=0, max_value=100, required=False, allow_null=True
        )
        fields['display_image_status'] = serializers.ChoiceField(
            choices=DISPLAY_IMAGE_CHOICES,
            required=False,
            allow_null=True
        )
        fields['glass_status'] = serializers.ChoiceField(
            choices=GLASS_CHOICES,
            required=False,
            allow_null=True
        )
        return fields


class ValoracionSoloPantallaMixin:
    """Mixin para dispositivos solo con pantalla, sin batería (iMac)."""
    def get_fields(self):
        fields = super().get_fields()
        fields['display_image_status'] = serializers.ChoiceField(
            choices=DISPLAY_IMAGE_CHOICES,
            required=False,
            allow_null=True
        )
        fields['glass_status'] = serializers.ChoiceField(
            choices=GLASS_CHOICES,
            required=False,
            allow_null=True
        )
        return fields


# === Serializers específicos por tipo de dispositivo ===

class ComercialIphoneInputSerializer(ValoracionConBateriaYPantallaMixin, BaseValoracionInputSerializer):
    """Valoración comercial para iPhone (legacy, mantener compatibilidad)."""
    # Sobrescribir campos para hacerlos requeridos (mantener comportamiento legacy)
    display_image_status = serializers.ChoiceField(choices=DISPLAY_IMAGE_CHOICES)
    glass_status = serializers.ChoiceField(choices=GLASS_CHOICES)
    housing_status = serializers.ChoiceField(choices=HOUSING_CHOICES)


class ComercialIpadInputSerializer(ValoracionConBateriaYPantallaMixin, BaseValoracionInputSerializer):
    """Valoración comercial para iPad."""
    pass


class ComercialMacBookInputSerializer(ValoracionConBateriaYPantallaMixin, BaseValoracionInputSerializer):
    """Valoración comercial para MacBook (Air/Pro)."""
    # MacBooks tienen batería, pantalla, y teclado/trackpad
    # Campos específicos opcionales (se pueden agregar después):
    # - keyboard_ok: bool
    # - trackpad_ok: bool
    # - ports_ok: bool
    pass


class ComercialIMacInputSerializer(ValoracionSoloPantallaMixin, BaseValoracionInputSerializer):
    """Valoración comercial para iMac (desktop, sin batería)."""
    # iMacs tienen pantalla pero NO batería
    # Campos específicos opcionales:
    # - stand_ok: bool
    # - ports_ok: bool
    pass


class ComercialMacProInputSerializer(BaseValoracionInputSerializer):
    """
    Valoración comercial para Mac Pro/Studio/mini (sin pantalla ni batería).
    Solo evalúa housing y funcionalidad.
    """
    # Mac Pro/Studio/mini: sin pantalla ni batería
    # Solo housing + funcional + posibles campos específicos:
    # - ports_ok: bool
    # - cooling_ok: bool
    pass
