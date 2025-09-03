from rest_framework import serializers

DISPLAY_IMAGE_CHOICES = ['OK','PIX','LINES','BURN','MURA']
GLASS_CHOICES         = ['NONE','MICRO','VISIBLE','DEEP','CHIP','CRACK']
HOUSING_CHOICES       = ['SIN_SIGNOS','MINIMOS','ALGUNOS','DESGASTE_VISIBLE','DOBLADO']

class ComercialIphoneInputSerializer(serializers.Serializer):
    tenant = serializers.CharField(required=False, allow_blank=True)
    canal  = serializers.ChoiceField(choices=['B2B','B2C'], required=False)

    modelo_id    = serializers.IntegerField()
    capacidad_id = serializers.IntegerField()

    enciende = serializers.BooleanField(allow_null=True,required=False)
    carga    = serializers.BooleanField(allow_null=True,required=False)

    funcional_basico_ok  = serializers.BooleanField(allow_null=True,required=False)
    battery_health_pct   = serializers.IntegerField(min_value=0, max_value=100, required=False, allow_null=True)

    display_image_status = serializers.ChoiceField(choices=DISPLAY_IMAGE_CHOICES)
    glass_status         = serializers.ChoiceField(choices=GLASS_CHOICES)
    housing_status       = serializers.ChoiceField(choices=HOUSING_CHOICES)
