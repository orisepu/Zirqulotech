# Plan: Adaptar Sistema de Grading Avanzado para Todos los Dispositivos (B2B)

## 🎯 Objetivo
Extender el sistema de valoración avanzado (gates + grados A+/A/B/C/D + deducciones) actualmente usado solo para iPhone/iPad a **todos los tipos de dispositivos** (MacBook Air/Pro, iMac, iPad, Mac Pro, Mac Studio, Mac mini) en canal **B2B**.

---

## 📊 Análisis de Situación Actual

### ⚠️ Importante: Existen DOS Sistemas Paralelos

#### **Sistema 1: LEGACY (checkouters/views/dispositivo.py)**
**Usado actualmente por:** TODOS los dispositivos (iPhone, iPad, MacBook, iMac, etc.)

**Funcionamiento:**
- Campo `Dispositivo.estado_valoracion` con opciones: `excelente`, `muy_bueno`, `bueno`, `a_revision`
- Cálculo simple con factores escalonados (76%-89% según precio)
- Sin gates automáticos
- Sin deducciones por piezas
- Se asigna manualmente o mediante `recalcular_precio()`
- Persiste en BD (tabla `checkouters_dispositivo`)

**Estado:** ✅ En producción, NO se va a tocar en este plan

---

#### **Sistema 2: NUEVO (productos/views/valoraciones.py + grading.py)**
**Usado actualmente por:** Solo iPhone/iPad (endpoints especializados)

**Endpoints actuales:**
- `POST /api/valoraciones/iphone/comercial/`
- `POST /api/valoraciones/iphone/auditoria/`

**Funcionamiento:**
- ✅ Gates automáticos (OK/DEFECTUOSO)
- ✅ Grados estéticos (A+/A/B/C/D)
- ✅ Deducciones por costes de reparación (batería, pantalla, chasis)
- ✅ Suelo dinámico (6 bandas según V_Aplus)
- ✅ Multi-tenant con precios por schema (`PrecioRecompra`)
- ✅ Canal B2B/B2C diferenciado
- ✅ 17 campos evaluados en cuestionario comercial
- ❌ NO persiste en BD (solo retorna JSON calculado)

**Estado:** ✅ En producción para iPhone/iPad, **ESTE es el que vamos a extender**

---

### 🎯 Estrategia de este Plan

**Objetivo:** Extender el **Sistema Nuevo** a todos los tipos de dispositivos

**NO se va a hacer:**
- ❌ Tocar el Sistema Legacy
- ❌ Migrar datos históricos del Sistema Legacy al Nuevo
- ❌ Eliminar `Dispositivo.estado_valoracion`

**SÍ se va a hacer:**
- ✅ Crear endpoints genéricos: `/api/valoraciones/{tipo}/comercial/`
- ✅ Extender `grading.py` para soportar múltiples tipos
- ✅ Crear serializers para MacBook, iMac, etc.
- ✅ Poblar precios B2B para otros dispositivos
- ✅ Componentes frontend para cuestionarios por tipo

**Resultado final:**
- Sistema Legacy: Sigue funcionando igual (para compatibilidad)
- Sistema Nuevo: Disponible para todos los tipos de dispositivos
- Los dos sistemas coexisten sin conflicto

---

## 📋 Fase 1: Backend - Generalización del Motor de Grading

### 1.1 Crear modelo de configuración por tipo de dispositivo
**Archivo nuevo:** `tenants-backend/productos/models/grading_config.py`

**Crear modelo `GradingConfig`:**

```python
from django.db import models
from django.contrib.postgres.fields import ArrayField

class GradingConfig(models.Model):
    """
    Configuración de parámetros de grading por tipo de dispositivo.
    Permite customizar gates, penalizaciones y componentes evaluables.
    """
    TIPOS_DISPOSITIVO = [
        ('iPhone', 'iPhone'),
        ('iPad', 'iPad'),
        ('MacBook Air', 'MacBook Air'),
        ('MacBook Pro', 'MacBook Pro'),
        ('iMac', 'iMac'),
        ('Mac Pro', 'Mac Pro'),
        ('Mac Studio', 'Mac Studio'),
        ('Mac mini', 'Mac mini'),
    ]

    tipo_dispositivo = models.CharField(
        max_length=50,
        choices=TIPOS_DISPOSITIVO,
        unique=True,
        db_index=True
    )

    # Penalizaciones estéticas (0.0 a 1.0)
    pp_A = models.DecimalField(
        max_digits=4, decimal_places=3, default=0.08,
        help_text="Penalización de A+ a A (ej: 0.08 = 8%)"
    )
    pp_B = models.DecimalField(
        max_digits=4, decimal_places=3, default=0.12,
        help_text="Penalización de A a B"
    )
    pp_C = models.DecimalField(
        max_digits=4, decimal_places=3, default=0.15,
        help_text="Penalización de B a C"
    )
    pp_func = models.DecimalField(
        max_digits=4, decimal_places=3, default=0.15,
        help_text="Penalización por fallo funcional"
    )

    # Características del tipo
    tiene_bateria = models.BooleanField(
        default=True,
        help_text="Si el dispositivo tiene batería (iMac/Mac Pro = False)"
    )

    # Componentes evaluables (JSON)
    componentes_evaluables = models.JSONField(
        default=list,
        help_text="Lista de componentes a evaluar: ['pantalla', 'teclado', 'trackpad', etc.]"
    )

    # Gates específicos (JSON)
    gates_especificos = models.JSONField(
        default=dict,
        help_text="Reglas específicas que fuerzan DEFECTUOSO: {'bisagras_rotas': true, 'teclado_no_funciona': true}"
    )

    # Metadata
    activo = models.BooleanField(default=True)
    fecha_creacion = models.DateTimeField(auto_now_add=True)
    fecha_actualizacion = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'productos_grading_config'
        verbose_name = 'Configuración de Grading'
        verbose_name_plural = 'Configuraciones de Grading'

    def __str__(self):
        return f"Grading Config: {self.tipo_dispositivo}"
```

**Ejemplo de datos para MacBook Pro:**
```python
{
    "tipo_dispositivo": "MacBook Pro",
    "pp_A": 0.08,
    "pp_B": 0.12,
    "pp_C": 0.15,
    "pp_func": 0.15,
    "tiene_bateria": True,
    "componentes_evaluables": [
        "pantalla",
        "teclado",
        "trackpad",
        "chasis_superior",
        "chasis_inferior",
        "bateria",
        "bisagras",
        "puerto_carga"
    ],
    "gates_especificos": {
        "bisagras_rotas": True,
        "teclado_no_funciona": True,
        "trackpad_no_funciona": True,
        "puerto_carga_roto": True,
        "display_image_bad": True,
        "glass_agrietado": True,
        "chasis_doblado": True
    }
}
```

**Migración:**
```bash
python manage.py makemigrations productos
python manage.py migrate
```

---

### 1.2 Extender serializers para soportar múltiples tipos
**Archivo:** `tenants-backend/productos/serializers/valoraciones.py`

**Añadir serializers específicos:**

```python
from rest_framework import serializers

# Choices compartidos
DISPLAY_IMAGE_CHOICES = ['OK','PIX','LINES','BURN','MURA']
GLASS_CHOICES = ['NONE','MICRO','VISIBLE','DEEP','CHIP','CRACK']
HOUSING_CHOICES = ['SIN_SIGNOS','MINIMOS','ALGUNOS','DESGASTE_VISIBLE','DOBLADO']
BISAGRAS_CHOICES = ['OK','FLOJAS','ROTAS']

# Base serializer con campos comunes
class BaseValoracionInputSerializer(serializers.Serializer):
    """Campos comunes a todos los tipos de dispositivos"""
    dispositivo_id = serializers.IntegerField(required=False)
    tenant = serializers.CharField(required=False, allow_blank=True)
    canal = serializers.ChoiceField(choices=['B2B','B2C'], required=False)

    # IDs o nombres
    modelo_id = serializers.IntegerField(required=False)
    capacidad_id = serializers.IntegerField(required=False)
    modelo_nombre = serializers.CharField(required=False, allow_blank=True)
    capacidad_texto = serializers.CharField(required=False, allow_blank=True)

    # Campos comunes de energía y funcionalidad
    enciende = serializers.BooleanField(allow_null=True, required=False)
    carga = serializers.BooleanField(allow_null=True, required=False)
    funcional_basico_ok = serializers.BooleanField(allow_null=True, required=False)

    # Batería (opcional según tipo)
    battery_health_pct = serializers.IntegerField(
        min_value=0, max_value=100,
        required=False, allow_null=True
    )
    ciclos_bateria = serializers.IntegerField(required=False, allow_null=True)

    # Estética (común a todos)
    display_image_status = serializers.ChoiceField(choices=DISPLAY_IMAGE_CHOICES)
    glass_status = serializers.ChoiceField(choices=GLASS_CHOICES)
    housing_status = serializers.ChoiceField(choices=HOUSING_CHOICES)


# iPhone/iPad (ya existente, sin cambios)
class ComercialIphoneInputSerializer(BaseValoracionInputSerializer):
    """Serializer para iPhone (mantiene compatibilidad)"""
    pass


# MacBook Air/Pro
class ComercialMacBookInputSerializer(BaseValoracionInputSerializer):
    """Serializer específico para MacBook Air y MacBook Pro"""

    # Componentes específicos de portátiles
    teclado_funcional = serializers.BooleanField(
        required=True,
        help_text="¿El teclado funciona correctamente? (todas las teclas)"
    )

    trackpad_funcional = serializers.BooleanField(
        required=True,
        help_text="¿El trackpad responde correctamente?"
    )

    bisagras_estado = serializers.ChoiceField(
        choices=BISAGRAS_CHOICES,
        required=True,
        help_text="Estado de las bisagras: OK/FLOJAS/ROTAS"
    )

    puerto_carga_ok = serializers.BooleanField(
        required=True,
        help_text="¿El puerto de carga MagSafe/USB-C funciona?"
    )

    # Opcional: detalles adicionales
    puertos_usb_ok = serializers.BooleanField(required=False, default=True)
    webcam_ok = serializers.BooleanField(required=False, default=True)
    altavoces_ok = serializers.BooleanField(required=False, default=True)


# iMac
class ComercialIMacInputSerializer(BaseValoracionInputSerializer):
    """Serializer para iMac (sin batería, pantalla grande)"""

    # iMac no tiene batería
    battery_health_pct = None  # override para no validar

    # Específico de iMac
    pie_soporte_ok = serializers.BooleanField(
        required=True,
        help_text="¿El pie/soporte está en buen estado?"
    )

    puerto_alimentacion_ok = serializers.BooleanField(
        required=True,
        help_text="¿El cable de alimentación y puerto funcionan?"
    )

    puertos_traseros_ok = serializers.BooleanField(
        required=False,
        default=True,
        help_text="¿Los puertos USB/Thunderbolt traseros funcionan?"
    )


# Mac Studio / Mac Pro / Mac mini
class ComercialMacDesktopInputSerializer(serializers.Serializer):
    """Serializer para Mac de escritorio (sin pantalla ni batería)"""

    # Estos dispositivos no tienen pantalla ni batería
    # Evaluación más simple centrada en chasis y funcionalidad

    dispositivo_id = serializers.IntegerField(required=False)
    tenant = serializers.CharField(required=False, allow_blank=True)
    canal = serializers.ChoiceField(choices=['B2B','B2C'], required=False)

    modelo_id = serializers.IntegerField(required=False)
    capacidad_id = serializers.IntegerField(required=False)
    modelo_nombre = serializers.CharField(required=False, allow_blank=True)
    capacidad_texto = serializers.CharField(required=False, allow_blank=True)

    enciende = serializers.BooleanField(required=True)
    funcional_basico_ok = serializers.BooleanField(required=True)

    # Solo estética de chasis (no tienen pantalla)
    housing_status = serializers.ChoiceField(choices=HOUSING_CHOICES)

    puertos_ok = serializers.BooleanField(required=True)
    puerto_alimentacion_ok = serializers.BooleanField(required=True)
```

**Función helper para seleccionar serializer:**
```python
def get_serializer_for_tipo(tipo_dispositivo: str):
    """Retorna el serializer apropiado según tipo de dispositivo"""
    SERIALIZER_MAP = {
        'iPhone': ComercialIphoneInputSerializer,
        'iPad': ComercialIphoneInputSerializer,  # iPad usa mismo que iPhone
        'MacBook Air': ComercialMacBookInputSerializer,
        'MacBook Pro': ComercialMacBookInputSerializer,
        'iMac': ComercialIMacInputSerializer,
        'Mac Studio': ComercialMacDesktopInputSerializer,
        'Mac Pro': ComercialMacDesktopInputSerializer,
        'Mac mini': ComercialMacDesktopInputSerializer,
    }
    return SERIALIZER_MAP.get(tipo_dispositivo, BaseValoracionInputSerializer)
```

---

### 1.3 Generalizar el motor de cálculo
**Archivo:** `tenants-backend/productos/services/grading.py`

**Añadir funciones de gates específicos:**

```python
from dataclasses import dataclass
from typing import Dict, Literal

@dataclass
class Params:
    """Parámetros de grading (sin cambios, ya existente)"""
    V_Aplus: int
    pp_A: float
    pp_B: float
    pp_C: float
    V_suelo: int
    pr_bateria: int
    pr_pantalla: int
    pr_chasis: int
    v_suelo_regla: Dict
    # NUEVO: tipo de dispositivo
    tipo_dispositivo: str = 'iPhone'


def aplicar_gates_macbook(i: dict) -> Literal['OK', 'DEFECTUOSO']:
    """Gates específicos para MacBook Air/Pro"""

    # Gates comunes de energía
    if i.get('enciende') is False or i.get('carga') is False:
        return 'DEFECTUOSO'

    # Gates específicos de MacBook
    if i.get('bisagras_estado') == 'ROTAS':
        return 'DEFECTUOSO'

    if i.get('teclado_funcional') is False:
        return 'DEFECTUOSO'

    if i.get('trackpad_funcional') is False:
        return 'DEFECTUOSO'

    if i.get('puerto_carga_ok') is False:
        return 'DEFECTUOSO'

    # Gates de pantalla (igual que iPhone)
    if i['display_image_status'] != 'OK':
        return 'DEFECTUOSO'

    if i['glass_status'] in ['DEEP','CHIP','CRACK']:
        return 'DEFECTUOSO'

    # Gates de chasis
    if i['housing_status'] == 'DOBLADO':
        return 'DEFECTUOSO'

    if i.get('funcional_basico_ok') is False:
        return 'DEFECTUOSO'

    return 'OK'


def aplicar_gates_imac(i: dict) -> Literal['OK', 'DEFECTUOSO']:
    """Gates específicos para iMac"""

    if i.get('enciende') is False:
        return 'DEFECTUOSO'

    if i.get('puerto_alimentacion_ok') is False:
        return 'DEFECTUOSO'

    # Pantalla (crítico en iMac por tamaño y coste)
    if i['display_image_status'] != 'OK':
        return 'DEFECTUOSO'

    if i['glass_status'] in ['DEEP','CHIP','CRACK']:
        return 'DEFECTUOSO'

    if i.get('funcional_basico_ok') is False:
        return 'DEFECTUOSO'

    return 'OK'


def aplicar_gates_mac_desktop(i: dict) -> Literal['OK', 'DEFECTUOSO']:
    """Gates para Mac Studio/Pro/mini (sin pantalla)"""

    if i.get('enciende') is False:
        return 'DEFECTUOSO'

    if i.get('puerto_alimentacion_ok') is False:
        return 'DEFECTUOSO'

    if i.get('puertos_ok') is False:
        return 'DEFECTUOSO'

    if i.get('funcional_basico_ok') is False:
        return 'DEFECTUOSO'

    # Chasis abollado/doblado
    if i.get('housing_status') == 'DOBLADO':
        return 'DEFECTUOSO'

    return 'OK'


def aplicar_gates_por_tipo(tipo_dispositivo: str, i: dict) -> Literal['OK', 'DEFECTUOSO']:
    """Router de gates según tipo de dispositivo"""

    if tipo_dispositivo in ['iPhone', 'iPad']:
        # Lógica original (ya existente en calcular())
        if i.get('enciende') is False or i.get('carga') is False:
            return 'DEFECTUOSO'
        if i['display_image_status'] != 'OK':
            return 'DEFECTUOSO'
        if i['glass_status'] in ['DEEP','CHIP','CRACK']:
            return 'DEFECTUOSO'
        if i['housing_status'] == 'DOBLADO':
            return 'DEFECTUOSO'
        if i.get('funcional_basico_ok') is False:
            return 'DEFECTUOSO'
        return 'OK'

    elif tipo_dispositivo in ['MacBook Air', 'MacBook Pro']:
        return aplicar_gates_macbook(i)

    elif tipo_dispositivo == 'iMac':
        return aplicar_gates_imac(i)

    elif tipo_dispositivo in ['Mac Studio', 'Mac Pro', 'Mac mini']:
        return aplicar_gates_mac_desktop(i)

    else:
        # Fallback: gates mínimos
        return 'DEFECTUOSO' if (i.get('enciende') is False or i.get('funcional_basico_ok') is False) else 'OK'


def calcular_deducciones_por_tipo(tipo_dispositivo: str, i: dict, params: Params) -> dict:
    """Calcula deducciones de piezas según tipo de dispositivo"""

    deducciones = {
        'pr_bat': 0,
        'pr_pant': 0,
        'pr_chas': 0,
        'pr_teclado': 0,  # nuevo
        'pr_trackpad': 0,  # nuevo
        'pr_bisagras': 0,  # nuevo
    }

    # Batería (solo si el tipo tiene batería)
    if params.pr_bateria > 0 and i.get('battery_health_pct') is not None:
        if i['battery_health_pct'] < 85:
            deducciones['pr_bat'] = params.pr_bateria

    # Pantalla (todos excepto Mac desktop)
    if tipo_dispositivo not in ['Mac Studio', 'Mac Pro', 'Mac mini']:
        if i['display_image_status'] != 'OK' or i['glass_status'] in ['DEEP','CHIP','CRACK']:
            deducciones['pr_pant'] = params.pr_pantalla

    # Chasis (todos)
    if i['housing_status'] in ['DESGASTE_VISIBLE','DOBLADO'] or i.get('backglass_status') in ('AGRIETADO', 'ROTO'):
        deducciones['pr_chas'] = params.pr_chasis

    # Componentes específicos MacBook
    if tipo_dispositivo in ['MacBook Air', 'MacBook Pro']:
        # Teclado (si no funciona, ya es DEFECTUOSO, pero bisagras flojas sí se deduce)
        if i.get('bisagras_estado') == 'FLOJAS':
            deducciones['pr_bisagras'] = params.get('pr_bisagras', 0)  # nuevo coste

    return deducciones


# Modificar función calcular() existente
def calcular(params: Params, i: dict):
    """
    Función principal de cálculo (MODIFICADA para soportar múltiples tipos)
    """

    tipo_dispositivo = params.tipo_dispositivo

    # 1. Evaluar gates
    gate = aplicar_gates_por_tipo(tipo_dispositivo, i)

    # 2. Calcular topes
    A, B, C = topes(params.V_Aplus, params.pp_A, params.pp_B, params.pp_C)

    # 3. Grado estético (solo si gate OK)
    if gate == 'OK':
        g = grado(i['glass_status'], i['housing_status'])
        V_tope = params.V_Aplus if g=='A+' else (A if g=='A' else (B if g=='B' else C))
    else:
        # Lógica de tope en DEFECTUOSO (sin cambios respecto a implementación actual)
        # ... (mantener lógica existente) ...
        g = 'D'
        # código existente para calcular V_tope en caso DEFECTUOSO
        pass

    # 4. Deducciones por piezas
    deduc = calcular_deducciones_por_tipo(tipo_dispositivo, i, params)
    pr_bat = deduc['pr_bat']
    pr_pant = deduc['pr_pant']
    pr_chas = deduc['pr_chas']
    # pr_bisagras, pr_teclado, pr_trackpad se pueden añadir después

    V1 = V_tope - (pr_bat + pr_pant + pr_chas)
    if not isfinite(V1): V1 = 0

    # 5. Penalización funcional
    aplica_pp_func = (i.get('funcional_basico_ok') is False)
    pp_func = params.pp_C if aplica_pp_func else 0.0  # usar pp_C como % funcional
    V2 = round(V1*(1-pp_func)) if aplica_pp_func else V1

    redondeo5 = round(V2/5)*5
    oferta = max(redondeo5, params.V_suelo, 0)

    return {
        "oferta": oferta,
        "gate": gate,
        "grado_estetico": g,
        "V_Aplus": params.V_Aplus,
        "V_A": A,
        "V_B": B,
        "V_C": C,
        "V_tope": V_tope,
        "deducciones": {
            "pr_bat": pr_bat,
            "pr_pant": pr_pant,
            "pr_chas": pr_chas,
            "pp_func": pp_func
        },
        "calculo": {
            "V1": V1,
            "aplica_pp_func": aplica_pp_func,
            "V2": V2,
            "redondeo5": redondeo5,
            "suelo": params.V_suelo,
            "oferta_final": oferta
        },
    }
```

---

### 1.4 Crear endpoints genéricos de valoración
**Archivo:** `tenants-backend/productos/views/valoraciones.py`

**Añadir mapeo de slugs:**

```python
# Mapeo de URL slug a tipo de dispositivo
SLUG_TO_TIPO = {
    'iphone': 'iPhone',
    'ipad': 'iPad',
    'macbook-air': 'MacBook Air',
    'macbook-pro': 'MacBook Pro',
    'imac': 'iMac',
    'mac-studio': 'Mac Studio',
    'mac-pro': 'Mac Pro',
    'mac-mini': 'Mac mini',
}

TIPO_TO_SLUG = {v: k for k, v in SLUG_TO_TIPO.items()}
```

**Crear view genérica:**

```python
class ValoracionComercialGenericaView(APIView):
    """
    POST /api/valoraciones/{tipo_slug}/comercial/
    Calcula oferta comercial para cualquier tipo de dispositivo.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, tipo_slug):
        # 1. Resolver tipo desde slug
        tipo_dispositivo = SLUG_TO_TIPO.get(tipo_slug)
        if not tipo_dispositivo:
            return Response(
                {"detail": f"Tipo '{tipo_slug}' no soportado. Tipos válidos: {list(SLUG_TO_TIPO.keys())}"},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 2. Cargar configuración de grading
        try:
            config = GradingConfig.objects.get(tipo_dispositivo=tipo_dispositivo, activo=True)
        except GradingConfig.DoesNotExist:
            return Response(
                {"detail": f"No hay configuración de grading para {tipo_dispositivo}"},
                status=status.HTTP_404_NOT_FOUND
            )

        # 3. Validar input con serializer apropiado
        serializer_class = get_serializer_for_tipo(tipo_dispositivo)
        ser = serializer_class(data=request.data)
        ser.is_valid(raise_exception=True)
        i = ser.validated_data

        try:
            logger.info(
                "[valoraciones] Comercial POST tipo=%s payload=%s",
                tipo_dispositivo,
                {k: i.get(k) for k in list(i.keys())[:50]}
            )
        except Exception:
            pass

        # 4. Resolver modelo_id y capacidad_id (misma lógica que iPhone)
        if not i.get('modelo_id') or not i.get('capacidad_id'):
            # ... (copiar lógica de resolución de IDs de IphoneComercialValoracionView)
            pass

        # 5. Obtener precio base (V_Aplus)
        active_schema = getattr(connection, 'schema_name', None)
        tenant_schema = i.get('tenant') or (active_schema if active_schema != 'public' else None)
        canal = i.get('canal') or ('B2B' if tenant_schema else 'B2C')

        v_aplus = vigente_precio_recompra(i['capacidad_id'], canal, tenant_schema)
        if v_aplus is None:
            return Response(
                {"detail": f"No hay precio vigente para {tipo_dispositivo} capacidad_id={i['capacidad_id']} canal={canal}"},
                status=status.HTTP_404_NOT_FOUND
            )

        V_Aplus = int(Decimal(v_aplus).quantize(Decimal('1')))

        # 6. Obtener costes de piezas
        pr_bateria = 0
        if config.tiene_bateria:
            pr_bateria = int(vigente_coste_pieza(i['modelo_id'], i['capacidad_id'], ['bater', 'battery']))

        pr_pantalla = 0
        if tipo_dispositivo not in ['Mac Studio', 'Mac Pro', 'Mac mini']:
            pr_pantalla = int(vigente_coste_pieza(i['modelo_id'], i['capacidad_id'], ['pant', 'screen', 'display']))

        pr_chasis = int(vigente_coste_pieza(i['modelo_id'], i['capacidad_id'], ['chasis','tapa','back','carcasa','housing','glass']))

        # 7. Calcular suelo dinámico
        V_suelo, regla = v_suelo_desde_max(V_Aplus)

        # 8. Crear params
        params = Params(
            V_Aplus=V_Aplus,
            pp_A=float(config.pp_A),
            pp_B=float(config.pp_B),
            pp_C=float(config.pp_C),
            V_suelo=V_suelo,
            pr_bateria=pr_bateria,
            pr_pantalla=pr_pantalla,
            pr_chasis=pr_chasis,
            v_suelo_regla=regla,
            tipo_dispositivo=tipo_dispositivo  # NUEVO
        )

        try:
            logger.info(
                "[valoraciones] Comercial tipo=%s params: modelo_id=%s capacidad_id=%s canal=%s tenant=%s V_Aplus=%s V_suelo=%s",
                tipo_dispositivo, i['modelo_id'], i['capacidad_id'], canal, tenant_schema, V_Aplus, V_suelo
            )
        except Exception:
            pass

        # 9. Calcular valoración
        out = calcular(params, i)

        # 10. Respuesta
        return Response({
            **out,
            "tipo_dispositivo": tipo_dispositivo,
            "params": {
                "V_suelo": params.V_suelo,
                "pp_A": params.pp_A,
                "pp_B": params.pp_B,
                "pp_C": params.pp_C,
                "pr_bateria": params.pr_bateria,
                "pr_pantalla": params.pr_pantalla,
                "pr_chasis": params.pr_chasis,
                "v_suelo_regla": params.v_suelo_regla,
            },
        }, status=status.HTTP_200_OK)
```

**Crear view de auditoría genérica:**

```python
class ValoracionAuditoriaGenericaView(APIView):
    """
    POST /api/valoraciones/{tipo_slug}/auditoria/
    Alias técnico del cálculo comercial (misma lógica).
    """
    permission_classes = [IsAuthenticated]

    def post(self, request, tipo_slug):
        # Reutilizar la lógica de comercial
        # (en el futuro puede divergir si hay diferencias en auditoría)
        comercial_view = ValoracionComercialGenericaView()
        return comercial_view.post(request, tipo_slug)
```

---

### 1.5 Actualizar URLs
**Archivo:** `tenants-backend/productos/urls.py`

```python
from django.urls import path
from productos.views.valoraciones import (
    # Endpoints antiguos (mantener para retrocompatibilidad)
    IphoneComercialValoracionView,
    IphoneAuditoriaValoracionView,
    # Endpoints nuevos genéricos
    ValoracionComercialGenericaView,
    ValoracionAuditoriaGenericaView,
)

urlpatterns = [
    # ... otras URLs ...

    # === Valoraciones Genéricas (NUEVO SISTEMA) ===
    path('valoraciones/<slug:tipo_slug>/comercial/',
         ValoracionComercialGenericaView.as_view(),
         name='valoracion_comercial_generica'),

    path('valoraciones/<slug:tipo_slug>/auditoria/',
         ValoracionAuditoriaGenericaView.as_view(),
         name='valoracion_auditoria_generica'),

    # === Valoraciones Legacy (mantener para compatibilidad) ===
    path('valoraciones/iphone/comercial/',
         IphoneComercialValoracionView.as_view(),
         name='valoracion_iphone_comercial_legacy'),

    path('valoraciones/iphone/auditoria/',
         IphoneAuditoriaValoracionView.as_view(),
         name='valoracion_iphone_auditoria_legacy'),
]
```

---

## 📋 Fase 2: Base de Datos - Verificación de Datos

### ✅ Precios y Costes Ya Existen

**IMPORTANTE:** Los precios B2B (`PrecioRecompra`) y costes de piezas (`CostoPieza`) **YA ESTÁN POBLADOS** en la base de datos para todos los dispositivos.

**NO es necesario:**
- ❌ Crear scripts de poblado de precios
- ❌ Crear scripts de poblado de costes
- ❌ Poblar datos manualmente

**SÍ es necesario:**
- ✅ Verificar que los datos existen y son correctos
- ✅ Validar que hay precios B2B para los modelos que vamos a usar en testing

---

### 2.1 Verificar PrecioRecompra para dispositivos clave

**Tarea:** Validar que existen precios B2B para modelos de referencia

**Script de verificación (opcional):** `tenants-backend/productos/management/commands/verificar_precios_grading.py`

```python
from django.core.management.base import BaseCommand
from productos.models.modelos import Modelo, Capacidad
from productos.models.precios import PrecioRecompra
from django.utils import timezone

class Command(BaseCommand):
    help = 'Verifica que existen precios B2B para modelos clave'

    def handle(self, *args, **options):
        self.stdout.write('Verificando precios B2B existentes...\n')

        modelos_clave = [
            ('MacBook Pro 14', ['512 GB', '1 TB']),
            ('MacBook Pro 16', ['512 GB', '1 TB']),
            ('MacBook Air', ['256 GB', '512 GB']),
            ('iPad Pro 11', ['256 GB', '512 GB']),
            ('iMac 24', ['256 GB', '512 GB']),
        ]

        total_encontrados = 0
        total_faltantes = 0

        for modelo_pattern, capacidades in modelos_clave:
            self.stdout.write(f'\n📱 {modelo_pattern}:')

            modelos = Modelo.objects.filter(descripcion__icontains=modelo_pattern)

            if not modelos.exists():
                self.stdout.write(self.style.WARNING(f'  ⚠️  No se encontró modelo con patrón "{modelo_pattern}"'))
                continue

            for modelo in modelos[:2]:  # primeros 2 modelos encontrados
                for capacidad_str in capacidades:
                    try:
                        capacidad = Capacidad.objects.get(modelo=modelo, tamaño=capacidad_str)

                        # Buscar precio B2B vigente
                        now = timezone.now()
                        precio = PrecioRecompra.objects.filter(
                            capacidad=capacidad,
                            canal='B2B',
                            valid_from__lte=now
                        ).filter(
                            models.Q(valid_to__isnull=True) | models.Q(valid_to__gt=now)
                        ).order_by('-valid_from').first()

                        if precio:
                            self.stdout.write(self.style.SUCCESS(
                                f'  ✓ {modelo.descripcion} {capacidad_str}: {precio.precio_neto}€ B2B'
                            ))
                            total_encontrados += 1
                        else:
                            self.stdout.write(self.style.WARNING(
                                f'  ⚠️  {modelo.descripcion} {capacidad_str}: SIN PRECIO B2B'
                            ))
                            total_faltantes += 1

                    except Capacidad.DoesNotExist:
                        self.stdout.write(self.style.WARNING(
                            f'  ⚠️  Capacidad {capacidad_str} no encontrada para {modelo.descripcion}'
                        ))

        self.stdout.write(f'\n\n📊 Resumen:')
        self.stdout.write(f'  ✅ Precios encontrados: {total_encontrados}')
        self.stdout.write(f'  ⚠️  Precios faltantes: {total_faltantes}')

        if total_faltantes == 0:
            self.stdout.write(self.style.SUCCESS('\n✅ Todos los modelos clave tienen precios B2B'))
        else:
            self.stdout.write(self.style.WARNING(f'\n⚠️  Faltan {total_faltantes} precios B2B'))
```

**Ejecutar (opcional):**
```bash
python manage.py verificar_precios_grading
```

---

### 2.2 Verificar CostoPieza para componentes clave

**Los costes de piezas YA EXISTEN en la BD.** Solo verificar que están disponibles para los modelos que se van a usar en testing.

**Script de verificación (opcional):** `tenants-backend/productos/management/commands/verificar_costes_piezas.py`

```python
from django.core.management.base import BaseCommand
from productos.models.modelos import Modelo
from productos.models.precios import CostoPieza, PiezaTipo
from django.utils import timezone

class Command(BaseCommand):
    help = 'Verifica que existen costes de piezas para modelos clave'

    def handle(self, *args, **options):
        self.stdout.write('Verificando costes de piezas existentes...\n')

        modelos_clave = ['MacBook Pro 14', 'MacBook Pro 16', 'MacBook Air', 'iPad Pro', 'iPhone']
        piezas_clave = ['pant', 'bater', 'chasis', 'screen', 'battery', 'display']

        total_encontrados = 0
        total_modelos = 0

        for modelo_pattern in modelos_clave:
            modelos = Modelo.objects.filter(descripcion__icontains=modelo_pattern)

            if not modelos.exists():
                continue

            for modelo in modelos[:2]:  # primeros 2
                self.stdout.write(f'\n📱 {modelo.descripcion}:')
                total_modelos += 1

                now = timezone.now()
                costes = CostoPieza.objects.filter(
                    modelo=modelo,
                    valid_from__lte=now
                ).filter(
                    models.Q(valid_to__isnull=True) | models.Q(valid_to__gt=now)
                ).select_related('pieza_tipo', 'mano_obra_tipo')

                if costes.exists():
                    for coste in costes:
                        total_coste = coste.coste_neto + (coste.mano_obra_tipo.coste_por_hora * coste.horas)
                        self.stdout.write(self.style.SUCCESS(
                            f'  ✓ {coste.pieza_tipo.nombre}: {coste.coste_neto}€ + {coste.horas}h MO = {total_coste}€'
                        ))
                        total_encontrados += 1
                else:
                    self.stdout.write(self.style.WARNING(f'  ⚠️  Sin costes configurados'))

        self.stdout.write(f'\n\n📊 Resumen:')
        self.stdout.write(f'  ✅ Modelos verificados: {total_modelos}')
        self.stdout.write(f'  ✅ Costes encontrados: {total_encontrados}')

        if total_encontrados > 0:
            self.stdout.write(self.style.SUCCESS('\n✅ Hay costes de piezas configurados en la BD'))
```

**Ejecutar (opcional):**
```bash
python manage.py verificar_costes_piezas
```

---

### 2.3 Crear configuraciones de grading iniciales

**Archivo nuevo:** `tenants-backend/productos/management/commands/init_grading_configs.py`

```python
from django.core.management.base import BaseCommand
from productos.models.grading_config import GradingConfig

class Command(BaseCommand):
    help = 'Inicializa configuraciones de grading para todos los tipos'

    def handle(self, *args, **options):
        self.stdout.write('Creando configuraciones de grading...')

        configs = [
            # iPhone (referencia actual)
            {
                'tipo_dispositivo': 'iPhone',
                'pp_A': 0.08, 'pp_B': 0.12, 'pp_C': 0.15, 'pp_func': 0.15,
                'tiene_bateria': True,
                'componentes_evaluables': ['pantalla', 'cristal', 'chasis', 'bateria'],
                'gates_especificos': {
                    'no_enciende': True,
                    'no_carga': True,
                    'display_image_bad': True,
                    'glass_agrietado': True,
                    'chasis_doblado': True,
                    'funcional_basico_falla': True,
                },
            },

            # iPad (similar a iPhone)
            {
                'tipo_dispositivo': 'iPad',
                'pp_A': 0.08, 'pp_B': 0.12, 'pp_C': 0.15, 'pp_func': 0.15,
                'tiene_bateria': True,
                'componentes_evaluables': ['pantalla', 'cristal', 'chasis', 'bateria'],
                'gates_especificos': {
                    'no_enciende': True,
                    'no_carga': True,
                    'display_image_bad': True,
                    'glass_agrietado': True,
                    'chasis_doblado': True,
                },
            },

            # MacBook Pro
            {
                'tipo_dispositivo': 'MacBook Pro',
                'pp_A': 0.08, 'pp_B': 0.12, 'pp_C': 0.15, 'pp_func': 0.15,
                'tiene_bateria': True,
                'componentes_evaluables': [
                    'pantalla', 'cristal', 'chasis', 'bateria',
                    'teclado', 'trackpad', 'bisagras', 'puertos'
                ],
                'gates_especificos': {
                    'no_enciende': True,
                    'no_carga': True,
                    'bisagras_rotas': True,
                    'teclado_no_funciona': True,
                    'trackpad_no_funciona': True,
                    'display_image_bad': True,
                    'glass_agrietado': True,
                    'chasis_doblado': True,
                },
            },

            # MacBook Air
            {
                'tipo_dispositivo': 'MacBook Air',
                'pp_A': 0.08, 'pp_B': 0.12, 'pp_C': 0.15, 'pp_func': 0.15,
                'tiene_bateria': True,
                'componentes_evaluables': [
                    'pantalla', 'cristal', 'chasis', 'bateria',
                    'teclado', 'trackpad', 'bisagras', 'puertos'
                ],
                'gates_especificos': {
                    'no_enciende': True,
                    'no_carga': True,
                    'bisagras_rotas': True,
                    'teclado_no_funciona': True,
                    'trackpad_no_funciona': True,
                    'display_image_bad': True,
                    'glass_agrietado': True,
                },
            },

            # iMac (sin batería)
            {
                'tipo_dispositivo': 'iMac',
                'pp_A': 0.08, 'pp_B': 0.12, 'pp_C': 0.15, 'pp_func': 0.15,
                'tiene_bateria': False,  # ⚠️
                'componentes_evaluables': ['pantalla', 'cristal', 'chasis', 'puertos', 'soporte'],
                'gates_especificos': {
                    'no_enciende': True,
                    'display_image_bad': True,
                    'glass_agrietado': True,
                    'puerto_alimentacion_falla': True,
                },
            },

            # Mac Studio (sin pantalla ni batería)
            {
                'tipo_dispositivo': 'Mac Studio',
                'pp_A': 0.08, 'pp_B': 0.12, 'pp_C': 0.15, 'pp_func': 0.15,
                'tiene_bateria': False,
                'componentes_evaluables': ['chasis', 'puertos'],
                'gates_especificos': {
                    'no_enciende': True,
                    'puertos_no_funcionan': True,
                    'chasis_dañado': True,
                },
            },

            # Mac Pro
            {
                'tipo_dispositivo': 'Mac Pro',
                'pp_A': 0.08, 'pp_B': 0.12, 'pp_C': 0.15, 'pp_func': 0.15,
                'tiene_bateria': False,
                'componentes_evaluables': ['chasis', 'puertos'],
                'gates_especificos': {
                    'no_enciende': True,
                    'puertos_no_funcionan': True,
                },
            },

            # Mac mini
            {
                'tipo_dispositivo': 'Mac mini',
                'pp_A': 0.08, 'pp_B': 0.12, 'pp_C': 0.15, 'pp_func': 0.15,
                'tiene_bateria': False,
                'componentes_evaluables': ['chasis', 'puertos'],
                'gates_especificos': {
                    'no_enciende': True,
                    'puertos_no_funcionan': True,
                },
            },
        ]

        for config_data in configs:
            obj, created = GradingConfig.objects.update_or_create(
                tipo_dispositivo=config_data['tipo_dispositivo'],
                defaults=config_data
            )
            status = '✓ Creado' if created else '↻ Actualizado'
            self.stdout.write(f'  {status}: {obj.tipo_dispositivo}')

        self.stdout.write(self.style.SUCCESS('✅ Configuraciones inicializadas'))
```

**Ejecutar:**
```bash
python manage.py init_grading_configs
```

---

## 📋 Fase 3: Frontend - Componentes de Valoración

### 3.1 Crear tipos TypeScript genéricos
**Archivo:** `tenant-frontend/src/shared/types/grading.ts`

**Añadir al final del archivo:**

```typescript
// ========== TIPOS GENÉRICOS PARA MÚLTIPLES DISPOSITIVOS ==========

export enum TipoDispositivo {
  IPHONE = 'iPhone',
  IPAD = 'iPad',
  MACBOOK_AIR = 'MacBook Air',
  MACBOOK_PRO = 'MacBook Pro',
  IMAC = 'iMac',
  MAC_STUDIO = 'Mac Studio',
  MAC_PRO = 'Mac Pro',
  MAC_MINI = 'Mac mini',
}

export enum BisagrasStatus {
  OK = 'OK',
  FLOJAS = 'FLOJAS',
  ROTAS = 'ROTAS',
}

// Input de valoración para MacBooks
export interface MacBookValoracionInput extends CuestionarioComercialInput {
  teclado_funcional: boolean
  trackpad_funcional: boolean
  bisagras_estado: BisagrasStatus
  puerto_carga_ok: boolean
  // Opcionales
  puertos_usb_ok?: boolean
  webcam_ok?: boolean
  altavoces_ok?: boolean
}

// Input de valoración para iMac
export interface IMacValoracionInput extends Omit<CuestionarioComercialInput, 'battery_health_pct'> {
  pie_soporte_ok: boolean
  puerto_alimentacion_ok: boolean
  puertos_traseros_ok?: boolean
}

// Input de valoración para Mac desktop (Studio/Pro/mini)
export interface MacDesktopValoracionInput {
  identificacion: ModeloCapacidad | null
  enciende: boolean
  funcional_basico_ok: boolean
  housing_status: HousingStatus
  puertos_ok: boolean
  puerto_alimentacion_ok: boolean
}

// Tipo union para facilitar uso
export type ValoracionInputGenerico =
  | CuestionarioComercialInput
  | MacBookValoracionInput
  | IMacValoracionInput
  | MacDesktopValoracionInput

// Helper para mapear tipo a slug de URL
export function tipoToSlug(tipo: TipoDispositivo): string {
  const map: Record<TipoDispositivo, string> = {
    [TipoDispositivo.IPHONE]: 'iphone',
    [TipoDispositivo.IPAD]: 'ipad',
    [TipoDispositivo.MACBOOK_AIR]: 'macbook-air',
    [TipoDispositivo.MACBOOK_PRO]: 'macbook-pro',
    [TipoDispositivo.IMAC]: 'imac',
    [TipoDispositivo.MAC_STUDIO]: 'mac-studio',
    [TipoDispositivo.MAC_PRO]: 'mac-pro',
    [TipoDispositivo.MAC_MINI]: 'mac-mini',
  }
  return map[tipo]
}

// Helper para detectar tipo desde string de modelo
export function detectarTipoDispositivo(modeloDescripcion: string): TipoDispositivo {
  const desc = modeloDescripcion.toLowerCase()

  if (desc.includes('iphone')) return TipoDispositivo.IPHONE
  if (desc.includes('ipad')) return TipoDispositivo.IPAD
  if (desc.includes('macbook pro')) return TipoDispositivo.MACBOOK_PRO
  if (desc.includes('macbook air')) return TipoDispositivo.MACBOOK_AIR
  if (desc.includes('imac')) return TipoDispositivo.IMAC
  if (desc.includes('mac studio')) return TipoDispositivo.MAC_STUDIO
  if (desc.includes('mac pro')) return TipoDispositivo.MAC_PRO
  if (desc.includes('mac mini')) return TipoDispositivo.MAC_MINI

  // Fallback: si contiene "Mac" genérico, asumir MacBook Pro
  if (desc.includes('mac')) return TipoDispositivo.MACBOOK_PRO

  return TipoDispositivo.IPHONE // default
}
```

---

### 3.2 Crear componente de cuestionario para MacBook

**Archivo nuevo:** `tenant-frontend/src/features/opportunities/components/grading/CuestionarioComercialMacBook.tsx`

```typescript
'use client'

import React from 'react'
import {
  Box,
  Typography,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Paper,
  Alert,
  Divider,
  Stack,
} from '@mui/material'
import LaptopIcon from '@mui/icons-material/Laptop'
import KeyboardIcon from '@mui/icons-material/Keyboard'
import TouchAppIcon from '@mui/icons-material/TouchApp'
import BatteryChargingFullIcon from '@mui/icons-material/BatteryChargingFull'
import ScreenRotationIcon from '@mui/icons-material/ScreenRotation'
import { MacBookValoracionInput, BisagrasStatus, DisplayImageStatus, GlassStatus, HousingStatus } from '@/shared/types/grading'

interface Props {
  value: Partial<MacBookValoracionInput>
  onChange: (updated: Partial<MacBookValoracionInput>) => void
  disabled?: boolean
}

export default function CuestionarioComercialMacBook({ value, onChange, disabled = false }: Props) {

  const update = (field: keyof MacBookValoracionInput, val: any) => {
    onChange({ ...value, [field]: val })
  }

  return (
    <Stack spacing={3}>

      {/* Sección 1: Energía y Encendido */}
      <Paper elevation={1} sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BatteryChargingFullIcon color="primary" />
          Energía y Encendido
        </Typography>

        <Stack spacing={2} sx={{ mt: 2 }}>
          <FormControl component="fieldset">
            <FormLabel>¿El MacBook enciende correctamente?</FormLabel>
            <RadioGroup
              row
              value={value.enciende === null ? '' : value.enciende?.toString() || ''}
              onChange={(e) => update('enciende', e.target.value === 'true')}
            >
              <FormControlLabel value="true" control={<Radio />} label="Sí" disabled={disabled} />
              <FormControlLabel value="false" control={<Radio />} label="No" disabled={disabled} />
            </RadioGroup>
          </FormControl>

          <FormControl component="fieldset">
            <FormLabel>¿El MacBook carga correctamente?</FormLabel>
            <RadioGroup
              row
              value={value.carga === null ? '' : value.carga?.toString() || ''}
              onChange={(e) => update('carga', e.target.value === 'true')}
            >
              <FormControlLabel value="true" control={<Radio />} label="Sí" disabled={disabled} />
              <FormControlLabel value="false" control={<Radio />} label="No" disabled={disabled} />
            </RadioGroup>
          </FormControl>

          <FormControl component="fieldset">
            <FormLabel>¿El puerto de carga MagSafe/USB-C funciona?</FormLabel>
            <RadioGroup
              row
              value={value.puerto_carga_ok?.toString() || ''}
              onChange={(e) => update('puerto_carga_ok', e.target.value === 'true')}
            >
              <FormControlLabel value="true" control={<Radio />} label="Sí" disabled={disabled} />
              <FormControlLabel value="false" control={<Radio />} label="No" disabled={disabled} />
            </RadioGroup>
          </FormControl>

          {value.enciende === false && (
            <Alert severity="error">
              ⚠️ MacBook que no enciende será clasificado como DEFECTUOSO
            </Alert>
          )}
        </Stack>
      </Paper>

      {/* Sección 2: Componentes Específicos de Portátil */}
      <Paper elevation={1} sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <LaptopIcon color="primary" />
          Componentes de Portátil
        </Typography>

        <Stack spacing={2} sx={{ mt: 2 }}>

          {/* Teclado */}
          <Box>
            <FormControl component="fieldset">
              <FormLabel sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <KeyboardIcon fontSize="small" />
                ¿El teclado funciona correctamente? (todas las teclas responden)
              </FormLabel>
              <RadioGroup
                row
                value={value.teclado_funcional?.toString() || ''}
                onChange={(e) => update('teclado_funcional', e.target.value === 'true')}
              >
                <FormControlLabel value="true" control={<Radio />} label="Sí" disabled={disabled} />
                <FormControlLabel value="false" control={<Radio />} label="No" disabled={disabled} />
              </RadioGroup>
            </FormControl>
            {value.teclado_funcional === false && (
              <Alert severity="error" sx={{ mt: 1 }}>
                ⚠️ Teclado no funcional → DEFECTUOSO
              </Alert>
            )}
          </Box>

          {/* Trackpad */}
          <Box>
            <FormControl component="fieldset">
              <FormLabel sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TouchAppIcon fontSize="small" />
                ¿El trackpad funciona correctamente?
              </FormLabel>
              <RadioGroup
                row
                value={value.trackpad_funcional?.toString() || ''}
                onChange={(e) => update('trackpad_funcional', e.target.value === 'true')}
              >
                <FormControlLabel value="true" control={<Radio />} label="Sí" disabled={disabled} />
                <FormControlLabel value="false" control={<Radio />} label="No" disabled={disabled} />
              </RadioGroup>
            </FormControl>
            {value.trackpad_funcional === false && (
              <Alert severity="error" sx={{ mt: 1 }}>
                ⚠️ Trackpad no funcional → DEFECTUOSO
              </Alert>
            )}
          </Box>

          {/* Bisagras */}
          <Box>
            <FormControl component="fieldset">
              <FormLabel sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ScreenRotationIcon fontSize="small" />
                Estado de las bisagras:
              </FormLabel>
              <RadioGroup
                value={value.bisagras_estado || ''}
                onChange={(e) => update('bisagras_estado', e.target.value as BisagrasStatus)}
              >
                <FormControlLabel
                  value={BisagrasStatus.OK}
                  control={<Radio />}
                  label="✅ OK - Abren y cierran suavemente"
                  disabled={disabled}
                />
                <FormControlLabel
                  value={BisagrasStatus.FLOJAS}
                  control={<Radio />}
                  label="⚠️ Flojas - Pantalla se mueve sola o no se sostiene"
                  disabled={disabled}
                />
                <FormControlLabel
                  value={BisagrasStatus.ROTAS}
                  control={<Radio />}
                  label="❌ Rotas - No se puede abrir/cerrar o están desprendidas"
                  disabled={disabled}
                />
              </RadioGroup>
            </FormControl>
            {value.bisagras_estado === BisagrasStatus.ROTAS && (
              <Alert severity="error" sx={{ mt: 1 }}>
                ⚠️ Bisagras rotas → DEFECTUOSO
              </Alert>
            )}
            {value.bisagras_estado === BisagrasStatus.FLOJAS && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                ℹ️ Bisagras flojas → Se aplicará deducción por reparación
              </Alert>
            )}
          </Box>

        </Stack>
      </Paper>

      {/* Sección 3: Funcionalidad Básica */}
      <Paper elevation={1} sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Funcionalidad General
        </Typography>

        <FormControl component="fieldset" sx={{ mt: 2 }}>
          <FormLabel>
            ¿Todo funciona correctamente? (Wi-Fi, Bluetooth, cámaras, altavoces, micrófono)
          </FormLabel>
          <RadioGroup
            row
            value={value.funcional_basico_ok === null ? '' : value.funcional_basico_ok?.toString() || ''}
            onChange={(e) => update('funcional_basico_ok', e.target.value === 'true')}
          >
            <FormControlLabel value="true" control={<Radio />} label="Sí, todo funciona" disabled={disabled} />
            <FormControlLabel value="false" control={<Radio />} label="No, hay fallos" disabled={disabled} />
          </RadioGroup>
        </FormControl>

        {value.funcional_basico_ok === false && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            ⚠️ Fallos funcionales aplicarán penalización del 15% sobre el precio
          </Alert>
        )}
      </Paper>

      {/* Sección 4: Batería */}
      <Paper elevation={1} sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Estado de la Batería
        </Typography>

        <FormControl fullWidth sx={{ mt: 2 }}>
          <FormLabel>Salud de la batería (%) - Opcional</FormLabel>
          <input
            type="number"
            min="0"
            max="100"
            value={value.battery_health_pct || ''}
            onChange={(e) => update('battery_health_pct', e.target.value ? parseInt(e.target.value) : null)}
            disabled={disabled}
            style={{ padding: '8px', fontSize: '16px', borderRadius: '4px', border: '1px solid #ccc' }}
            placeholder="Ej: 87"
          />
        </FormControl>

        {value.battery_health_pct !== null && value.battery_health_pct < 85 && (
          <Alert severity="warning" sx={{ mt: 2 }}>
            ℹ️ Batería &lt;85% → Se aplicará deducción por reemplazo de batería
          </Alert>
        )}
      </Paper>

      {/* Sección 5: Estética - Pantalla */}
      <Paper elevation={1} sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Estado Estético - Pantalla
        </Typography>

        <Stack spacing={2} sx={{ mt: 2 }}>
          <FormControl component="fieldset">
            <FormLabel>Estado de la imagen del panel:</FormLabel>
            <RadioGroup
              value={value.display_image_status || ''}
              onChange={(e) => update('display_image_status', e.target.value as DisplayImageStatus)}
            >
              <FormControlLabel value={DisplayImageStatus.OK} control={<Radio />} label="✅ OK - Sin problemas" disabled={disabled} />
              <FormControlLabel value={DisplayImageStatus.PIX} control={<Radio />} label="Píxeles muertos" disabled={disabled} />
              <FormControlLabel value={DisplayImageStatus.LINES} control={<Radio />} label="Líneas verticales/horizontales" disabled={disabled} />
              <FormControlLabel value={DisplayImageStatus.BURN} control={<Radio />} label="Quemaduras (burn-in)" disabled={disabled} />
              <FormControlLabel value={DisplayImageStatus.MURA} control={<Radio />} label="Manchas/Mura" disabled={disabled} />
            </RadioGroup>
          </FormControl>

          <FormControl component="fieldset">
            <FormLabel>Estado del cristal externo:</FormLabel>
            <RadioGroup
              value={value.glass_status || ''}
              onChange={(e) => update('glass_status', e.target.value as GlassStatus)}
            >
              <FormControlLabel value={GlassStatus.NONE} control={<Radio />} label="✅ Sin arañazos" disabled={disabled} />
              <FormControlLabel value={GlassStatus.MICRO} control={<Radio />} label="Micro-arañazos (apenas visibles)" disabled={disabled} />
              <FormControlLabel value={GlassStatus.VISIBLE} control={<Radio />} label="Arañazos visibles" disabled={disabled} />
              <FormControlLabel value={GlassStatus.DEEP} control={<Radio />} label="Arañazos profundos" disabled={disabled} />
              <FormControlLabel value={GlassStatus.CHIP} control={<Radio />} label="Pequeño desconchón" disabled={disabled} />
              <FormControlLabel value={GlassStatus.CRACK} control={<Radio />} label="❌ Agrietado" disabled={disabled} />
            </RadioGroup>
          </FormControl>

          {[DisplayImageStatus.PIX, DisplayImageStatus.LINES, DisplayImageStatus.BURN, DisplayImageStatus.MURA].includes(value.display_image_status as DisplayImageStatus) && (
            <Alert severity="error">
              ⚠️ Problemas de imagen → DEFECTUOSO
            </Alert>
          )}

          {[GlassStatus.DEEP, GlassStatus.CHIP, GlassStatus.CRACK].includes(value.glass_status as GlassStatus) && (
            <Alert severity="error">
              ⚠️ Cristal agrietado/desconchado → DEFECTUOSO
            </Alert>
          )}
        </Stack>
      </Paper>

      {/* Sección 6: Estética - Chasis */}
      <Paper elevation={1} sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          Estado Estético - Chasis/Carcasa
        </Typography>

        <FormControl component="fieldset" sx={{ mt: 2 }}>
          <FormLabel>Estado general del chasis de aluminio:</FormLabel>
          <RadioGroup
            value={value.housing_status || ''}
            onChange={(e) => update('housing_status', e.target.value as HousingStatus)}
          >
            <FormControlLabel value={HousingStatus.SIN_SIGNOS} control={<Radio />} label="✅ Sin signos de uso" disabled={disabled} />
            <FormControlLabel value={HousingStatus.MINIMOS} control={<Radio />} label="Signos mínimos (micro-arañazos)" disabled={disabled} />
            <FormControlLabel value={HousingStatus.ALGUNOS} control={<Radio />} label="Algunos golpes/arañazos" disabled={disabled} />
            <FormControlLabel value={HousingStatus.DESGASTE_VISIBLE} control={<Radio />} label="Desgaste visible (esquinas, bordes)" disabled={disabled} />
            <FormControlLabel value={HousingStatus.DOBLADO} control={<Radio />} label="❌ Abollado/doblado" disabled={disabled} />
          </RadioGroup>
        </FormControl>

        {value.housing_status === HousingStatus.DOBLADO && (
          <Alert severity="error" sx={{ mt: 2 }}>
            ⚠️ Chasis abollado/doblado → DEFECTUOSO
          </Alert>
        )}

        {value.housing_status === HousingStatus.DESGASTE_VISIBLE && (
          <Alert severity="info" sx={{ mt: 2 }}>
            ℹ️ Desgaste visible → Se aplicará deducción por reemplazo de carcasa
          </Alert>
        )}
      </Paper>

    </Stack>
  )
}
```

---

### 3.3 Actualizar servicios de API

**Archivo:** `tenant-frontend/src/services/valoraciones.ts`

**Añadir funciones genéricas:**

```typescript
import api from '@/services/api'
import { TipoDispositivo, tipoToSlug, ValoracionInputGenerico } from '@/shared/types/grading'

// Tipos de respuesta (sin cambios)
export type ValoracionComercialResponse = {
  oferta: number
  gate: 'OK' | 'DEFECTUOSO'
  grado_estetico: 'A+' | 'A' | 'B' | 'C' | 'D'
  V_Aplus: number; V_A: number; V_B: number; V_C: number; V_tope: number
  deducciones: {
    pr_bat: number; pr_pant: number; pr_chas: number; pp_func: number
    pr_teclado?: number; pr_trackpad?: number; pr_bisagras?: number  // nuevos opcionales
  }
  params: {
    V_suelo: number; pp_A: number; pp_B: number; pp_C: number
    pr_bateria: number; pr_pantalla: number; pr_chasis: number
    v_suelo_regla: { value: number; pct: number; min: number; label: string }
  }
  calculo: { V1: number; aplica_pp_func: boolean; V2: number; redondeo5: number; suelo: number; oferta_final: number }
  tipo_dispositivo?: string  // añadido por backend genérico
}

// ===== Función genérica para cualquier tipo =====
export async function postValoracionComercial(
  tipoDispositivo: TipoDispositivo,
  payload: ValoracionInputGenerico,
  tenantHeader?: string
): Promise<ValoracionComercialResponse> {
  const slug = tipoToSlug(tipoDispositivo)
  const url = `/api/valoraciones/${slug}/comercial/`

  const headers = tenantHeader ? { 'X-Tenant': tenantHeader } : undefined

  const { data } = await api.post(url, payload, headers ? { headers } : undefined)
  return data
}

export async function postValoracionAuditoria(
  tipoDispositivo: TipoDispositivo,
  payload: ValoracionInputGenerico,
  tenantHeader?: string
): Promise<ValoracionComercialResponse> {
  const slug = tipoToSlug(tipoDispositivo)
  const url = `/api/valoraciones/${slug}/auditoria/`

  const headers = tenantHeader ? { 'X-Tenant': tenantHeader } : undefined

  const { data } = await api.post(url, payload, headers ? { headers } : undefined)
  return data
}

// ===== Funciones legacy (mantener para retrocompatibilidad) =====
export type ValoracionComercialInput = Record<string, unknown>

export async function postValoracionIphoneComercial(payload: ValoracionComercialInput): Promise<ValoracionComercialResponse> {
  // Redirigir a función genérica
  return postValoracionComercial(TipoDispositivo.IPHONE, payload)
}

export type ValoracionTecnicaResponse = ValoracionComercialResponse
export type ValoracionTecnicaInput = Record<string, unknown>

export async function postValoracionIphoneAuditoria(payload: ValoracionTecnicaInput, tenantHeader?: string): Promise<ValoracionTecnicaResponse> {
  // Redirigir a función genérica
  return postValoracionAuditoria(TipoDispositivo.IPHONE, payload, tenantHeader)
}
```

---

### 3.4 Extender gradingCalcs.ts para múltiples tipos

**Archivo:** `tenant-frontend/src/shared/utils/gradingCalcs.ts`

**Añadir al final:**

```typescript
import { TipoDispositivo, MacBookValoracionInput, BisagrasStatus } from '@/shared/types/grading'

// ========== GATES ESPECÍFICOS POR TIPO ==========

export function pasaGatesMacBook(input: MacBookValoracionInput): { gate: ResultadoValoracion['gate'] } {
  // Gates de energía
  if (input.enciende === false || input.carga === false) return { gate: 'DEFECTUOSO' }

  // Gates específicos de MacBook
  if (input.bisagras_estado === BisagrasStatus.ROTAS) return { gate: 'DEFECTUOSO' }
  if (input.teclado_funcional === false) return { gate: 'DEFECTUOSO' }
  if (input.trackpad_funcional === false) return { gate: 'DEFECTUOSO' }
  if (input.puerto_carga_ok === false) return { gate: 'DEFECTUOSO' }

  // Gates comunes (pantalla, cristal, chasis)
  if (input.display_image_status !== DisplayImageStatus.OK) return { gate: 'DEFECTUOSO' }
  if ([GlassStatus.DEEP, GlassStatus.CHIP, GlassStatus.CRACK].includes(input.glass_status)) return { gate: 'DEFECTUOSO' }
  if (input.housing_status === HousingStatus.DOBLADO) return { gate: 'DEFECTUOSO' }
  if (input.funcional_basico_ok === false) return { gate: 'DEFECTUOSO' }

  return { gate: 'OK' }
}

// Función router genérica
export function pasaGatesGenerico(tipo: TipoDispositivo, input: any): { gate: ResultadoValoracion['gate'] } {
  switch (tipo) {
    case TipoDispositivo.IPHONE:
    case TipoDispositivo.IPAD:
      return pasaGatesComercial(input)

    case TipoDispositivo.MACBOOK_AIR:
    case TipoDispositivo.MACBOOK_PRO:
      return pasaGatesMacBook(input)

    // Otros tipos... (implementar según necesidad)

    default:
      // Fallback: gates mínimos
      if (input.enciende === false || input.funcional_basico_ok === false) {
        return { gate: 'DEFECTUOSO' }
      }
      return { gate: 'OK' }
  }
}
```

---

### 3.5 Integrar en formulario de oportunidad

**Archivo:** `tenant-frontend/src/features/opportunities/components/forms/FormularioValoracionOportunidad.tsx`

**Modificar para detectar tipo y renderizar componente apropiado:**

```tsx
import { detectarTipoDispositivo, TipoDispositivo } from '@/shared/types/grading'
import CuestionarioComercialIphone from '../grading/CuestionarioComercialIphone'
import CuestionarioComercialMacBook from '../grading/CuestionarioComercialMacBook'
// import otros componentes según se creen...

// Dentro del componente:
const tipoDispositivo = useMemo(() => {
  if (modeloSeleccionado?.descripcion) {
    return detectarTipoDispositivo(modeloSeleccionado.descripcion)
  }
  return TipoDispositivo.IPHONE // default
}, [modeloSeleccionado])

// En el render:
<Box>
  {tipoDispositivo === TipoDispositivo.IPHONE && (
    <CuestionarioComercialIphone
      value={cuestionarioData}
      onChange={setCuestionarioData}
    />
  )}

  {(tipoDispositivo === TipoDispositivo.MACBOOK_PRO || tipoDispositivo === TipoDispositivo.MACBOOK_AIR) && (
    <CuestionarioComercialMacBook
      value={cuestionarioData}
      onChange={setCuestionarioData}
    />
  )}

  {/* Añadir más tipos conforme se implementen */}
</Box>
```

---

## 📋 Fase 4: Testing

### 4.1 Tests de backend

**Archivo nuevo:** `tenants-backend/productos/tests/test_valoraciones_genericas.py`

```python
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from productos.models.modelos import Modelo, Capacidad
from productos.models.precios import PrecioRecompra
from productos.models.grading_config import GradingConfig
from django.utils import timezone
from decimal import Decimal

User = get_user_model()

class ValoracionGenericaTestCase(TestCase):

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='testuser', password='testpass')
        self.client.force_authenticate(user=self.user)

        # Crear modelo MacBook Pro 14"
        self.mbp14 = Modelo.objects.create(
            descripcion='MacBook Pro 14" M2',
            tipo='MacBook Pro',
            marca='Apple'
        )

        self.cap_512 = Capacidad.objects.create(
            modelo=self.mbp14,
            tamaño='512 GB',
            activo=True
        )

        # Precio de recompra B2B
        PrecioRecompra.objects.create(
            capacidad=self.cap_512,
            canal='B2B',
            precio_neto=Decimal('950.00'),
            valid_from=timezone.now()
        )

        # Configuración de grading
        GradingConfig.objects.create(
            tipo_dispositivo='MacBook Pro',
            pp_A=0.08, pp_B=0.12, pp_C=0.15, pp_func=0.15,
            tiene_bateria=True,
            componentes_evaluables=['pantalla', 'teclado', 'trackpad'],
            gates_especificos={'bisagras_rotas': True, 'teclado_no_funciona': True}
        )

    def test_macbook_pro_perfecto_grado_aplus(self):
        """MacBook Pro en estado perfecto debe valorarse como A+"""

        payload = {
            'modelo_id': self.mbp14.id,
            'capacidad_id': self.cap_512.id,
            'enciende': True,
            'carga': True,
            'funcional_basico_ok': True,
            'battery_health_pct': 90,
            'display_image_status': 'OK',
            'glass_status': 'NONE',
            'housing_status': 'SIN_SIGNOS',
            'teclado_funcional': True,
            'trackpad_funcional': True,
            'bisagras_estado': 'OK',
            'puerto_carga_ok': True,
        }

        response = self.client.post('/api/valoraciones/macbook-pro/comercial/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()

        self.assertEqual(data['gate'], 'OK')
        self.assertEqual(data['grado_estetico'], 'A+')
        self.assertEqual(data['V_Aplus'], 950)
        self.assertEqual(data['oferta'], 950)  # sin deducciones

    def test_macbook_pro_bisagras_rotas_defectuoso(self):
        """MacBook Pro con bisagras rotas debe ser DEFECTUOSO"""

        payload = {
            'modelo_id': self.mbp14.id,
            'capacidad_id': self.cap_512.id,
            'enciende': True,
            'carga': True,
            'funcional_basico_ok': True,
            'battery_health_pct': 85,
            'display_image_status': 'OK',
            'glass_status': 'NONE',
            'housing_status': 'SIN_SIGNOS',
            'teclado_funcional': True,
            'trackpad_funcional': True,
            'bisagras_estado': 'ROTAS',  # ⚠️
            'puerto_carga_ok': True,
        }

        response = self.client.post('/api/valoraciones/macbook-pro/comercial/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()

        self.assertEqual(data['gate'], 'DEFECTUOSO')
        # oferta será menor por aplicar lógica de DEFECTUOSO

    def test_macbook_pro_bateria_baja_deduccion(self):
        """MacBook Pro con batería <85% debe tener deducción"""

        payload = {
            'modelo_id': self.mbp14.id,
            'capacidad_id': self.cap_512.id,
            'enciende': True,
            'carga': True,
            'funcional_basico_ok': True,
            'battery_health_pct': 75,  # <85%
            'display_image_status': 'OK',
            'glass_status': 'MICRO',
            'housing_status': 'MINIMOS',
            'teclado_funcional': True,
            'trackpad_funcional': True,
            'bisagras_estado': 'OK',
            'puerto_carga_ok': True,
        }

        response = self.client.post('/api/valoraciones/macbook-pro/comercial/', payload, format='json')

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        data = response.json()

        self.assertEqual(data['gate'], 'OK')
        self.assertEqual(data['grado_estetico'], 'A')  # MICRO + MINIMOS = A
        self.assertGreater(data['deducciones']['pr_bat'], 0)  # debe haber deducción
        self.assertLess(data['oferta'], data['V_A'])  # oferta menor por deducción
```

---

### 4.2 Tests de frontend

**Archivo:** `tenant-frontend/src/shared/utils/gradingCalcs.test.ts`

**Añadir al final:**

```typescript
describe('MacBook grading', () => {
  const baseMacBookInput: MacBookValoracionInput = {
    identificacion: null,
    enciende: true,
    carga: true,
    display_image_status: DisplayImageStatus.OK,
    glass_status: GlassStatus.NONE,
    housing_status: HousingStatus.SIN_SIGNOS,
    funcional_basico_ok: true,
    battery_health_pct: 90,
    teclado_funcional: true,
    trackpad_funcional: true,
    bisagras_estado: BisagrasStatus.OK,
    puerto_carga_ok: true,
  }

  it('should return OK for perfect MacBook', () => {
    const result = pasaGatesMacBook(baseMacBookInput)
    expect(result.gate).toBe('OK')
  })

  it('should return DEFECTUOSO when hinges are broken', () => {
    const input = { ...baseMacBookInput, bisagras_estado: BisagrasStatus.ROTAS }
    const result = pasaGatesMacBook(input)
    expect(result.gate).toBe('DEFECTUOSO')
  })

  it('should return DEFECTUOSO when keyboard does not work', () => {
    const input = { ...baseMacBookInput, teclado_funcional: false }
    const result = pasaGatesMacBook(input)
    expect(result.gate).toBe('DEFECTUOSO')
  })

  it('should return DEFECTUOSO when trackpad does not work', () => {
    const input = { ...baseMacBookInput, trackpad_funcional: false }
    const result = pasaGatesMacBook(input)
    expect(result.gate).toBe('DEFECTUOSO')
  })

  it('should grade MacBook with micro scratches as A', () => {
    const input = {
      ...baseMacBookInput,
      glass_status: GlassStatus.MICRO,
      housing_status: HousingStatus.MINIMOS
    }
    const grade = gradoEsteticoDesdeTabla(input.glass_status, input.housing_status)
    expect(grade).toBe('A')
  })
})
```

---

### 4.3 Tests de integración API

**Archivo:** `tenant-frontend/src/__tests__/api/tier2-business.test.ts`

**Añadir:**

```typescript
describe('Valoraciones Genéricas', () => {

  test('POST /api/valoraciones/macbook-pro/comercial/ - successful valuation', async () => {
    const payload = {
      modelo_nombre: 'MacBook Pro 14" M2',
      capacidad_texto: '512 GB',
      enciende: true,
      carga: true,
      funcional_basico_ok: true,
      battery_health_pct: 88,
      display_image_status: 'OK',
      glass_status: 'NONE',
      housing_status: 'SIN_SIGNOS',
      teclado_funcional: true,
      trackpad_funcional: true,
      bisagras_estado: 'OK',
      puerto_carga_ok: true,
    }

    mockAdapter.onPost('/api/valoraciones/macbook-pro/comercial/').reply(200, {
      oferta: 950,
      gate: 'OK',
      grado_estetico: 'A+',
      V_Aplus: 950,
      V_A: 874,
      V_B: 769,
      V_C: 653,
      V_tope: 950,
      deducciones: { pr_bat: 0, pr_pant: 0, pr_chas: 0, pp_func: 0 },
      params: { V_suelo: 76, pp_A: 0.08, pp_B: 0.12, pp_C: 0.15 },
      tipo_dispositivo: 'MacBook Pro'
    })

    const response = await fetch('/api/valoraciones/macbook-pro/comercial/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer mocktoken' },
      body: JSON.stringify(payload)
    })

    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data.gate).toBe('OK')
    expect(data.grado_estetico).toBe('A+')
    expect(data.tipo_dispositivo).toBe('MacBook Pro')
  })

  test('POST /api/valoraciones/macbook-pro/comercial/ - reject broken hinges', async () => {
    const payload = {
      modelo_nombre: 'MacBook Pro 14" M2',
      capacidad_texto: '512 GB',
      enciende: true,
      carga: true,
      funcional_basico_ok: true,
      battery_health_pct: 90,
      display_image_status: 'OK',
      glass_status: 'NONE',
      housing_status: 'SIN_SIGNOS',
      teclado_funcional: true,
      trackpad_funcional: true,
      bisagras_estado: 'ROTAS',  // ⚠️
      puerto_carga_ok: true,
    }

    mockAdapter.onPost('/api/valoraciones/macbook-pro/comercial/').reply(200, {
      oferta: 400,  // precio reducido por defecto
      gate: 'DEFECTUOSO',
      grado_estetico: 'D',
      // ... resto de respuesta
    })

    const response = await fetch('/api/valoraciones/macbook-pro/comercial/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer mocktoken' },
      body: JSON.stringify(payload)
    })

    const data = await response.json()
    expect(data.gate).toBe('DEFECTUOSO')
  })

})
```

---

## 📋 Fase 5: Convivencia de Sistemas y Retrocompatibilidad

### ⚠️ Importante: Coexistencia Sin Conflicto

El Sistema Nuevo y el Sistema Legacy van a coexistir de forma independiente:

**Sistema Legacy (`checkouters/`):**
- Sigue utilizando `Dispositivo.estado_valoracion`
- Sigue utilizando `recalcular_precio()` con factores
- NO se modifica, NO se migra
- Continúa funcionando para compatibilidad con flujos existentes

**Sistema Nuevo (`productos/valoraciones`):**
- Endpoints especializados `/api/valoraciones/{tipo}/comercial/`
- Retorna JSON calculado, NO persiste en `Dispositivo`
- Solo se consulta cuando se necesita valoración avanzada

**NO hay migración de datos:** Los dos sistemas operan en paralelos sin interferencia.

---

### 5.1 Mantener endpoints antiguos de iPhone

Ya implementado en Fase 1.5 (URLs legacy).

**URLs finales:**
```python
# Genéricos (NUEVOS)
path('valoraciones/<slug:tipo_slug>/comercial/', ...)
path('valoraciones/<slug:tipo_slug>/auditoria/', ...)

# Legacy iPhone (mantener para compatibilidad)
path('valoraciones/iphone/comercial/', IphoneComercialValoracionView.as_view())
path('valoraciones/iphone/auditoria/', IphoneAuditoriaValoracionView.as_view())
```

---

### 5.2 (OPCIONAL) Añadir campos de telemetría a DispositivoReal

**Si en el futuro se quiere persistir resultados del Sistema Nuevo, añadir campos opcionales:**

**Migración:** `tenants-backend/checkouters/migrations/XXXX_add_grading_telemetry.py`

```python
from django.db import migrations, models

class Migration(migrations.Migration):
    dependencies = [
        ('checkouters', 'XXXX_previous_migration'),
    ]

    operations = [
        # Campos opcionales para guardar telemetría del Sistema Nuevo
        migrations.AddField(
            model_name='dispositivoreal',
            name='grading_gate',
            field=models.CharField(
                max_length=20, blank=True, null=True,
                help_text='Gate del Sistema Nuevo: OK o DEFECTUOSO (opcional)'
            ),
        ),
        migrations.AddField(
            model_name='dispositivoreal',
            name='grading_grado',
            field=models.CharField(
                max_length=5, blank=True, null=True,
                help_text='Grado estético Sistema Nuevo: A+/A/B/C/D (opcional)'
            ),
        ),
        migrations.AddField(
            model_name='dispositivoreal',
            name='grading_oferta_calculada',
            field=models.IntegerField(
                blank=True, null=True,
                help_text='Última oferta calculada por Sistema Nuevo (opcional, solo telemetría)'
            ),
        ),
        migrations.AddField(
            model_name='dispositivoreal',
            name='grading_telemetria_json',
            field=models.JSONField(
                blank=True, null=True,
                help_text='Telemetría completa de última valoración Sistema Nuevo (opcional)'
            ),
        ),
    ]
```

**Nota:** Estos campos son **opcionales** y solo para telemetría/histórico. El `precio_final` oficial sigue siendo el del Sistema Legacy.

---

### 5.3 NO hay migración de datos históricos

**Decisión de diseño:** Los datos del Sistema Legacy (`estado_valoracion`) NO se migran al Sistema Nuevo porque:

1. Son incompatibles (estados simples vs. grados complejos)
2. El Sistema Nuevo solo se invoca cuando se hace una valoración nueva
3. Los datos históricos siguen siendo válidos en su contexto legacy
4. No hay necesidad de unificar retroactivamente

---

## 📋 Fase 6: Documentación

### 6.1 Actualizar CLAUDE.md

Añadir sección al final:

```markdown
## Sistema de Grading Unificado (Multi-dispositivo)

### Arquitectura
El sistema de valoración avanzado (gates + grados A+/A/B/C/D + deducciones por costes de reparación) está unificado para todos los tipos de dispositivos:

- **iPhone, iPad**: Sistema original (17 campos evaluados)
- **MacBook Air, MacBook Pro**: Campos adicionales (teclado, trackpad, bisagras)
- **iMac**: Sin batería, enfoque en pantalla grande
- **Mac Studio, Mac Pro, Mac mini**: Sin pantalla ni batería

### Endpoints Genéricos
```
POST /api/valoraciones/{tipo_slug}/comercial/
POST /api/valoraciones/{tipo_slug}/auditoria/
```

Tipos soportados: `iphone`, `ipad`, `macbook-air`, `macbook-pro`, `imac`, `mac-studio`, `mac-pro`, `mac-mini`

### Parámetros de Grading por Tipo

| Tipo | pp_A | pp_B | pp_C | Batería | Componentes Específicos |
|------|------|------|------|---------|------------------------|
| iPhone/iPad | 8% | 12% | 15% | ✅ | - |
| MacBook Pro/Air | 8% | 12% | 15% | ✅ | Teclado, Trackpad, Bisagras |
| iMac | 8% | 12% | 15% | ❌ | Soporte, Puerto alimentación |
| Mac desktop | 8% | 12% | 15% | ❌ | Solo puertos y chasis |

### Gates Específicos

**MacBook:**
- Bisagras rotas → DEFECTUOSO
- Teclado no funciona → DEFECTUOSO
- Trackpad no funciona → DEFECTUOSO
- Puerto carga roto → DEFECTUOSO

**iMac:**
- Puerto alimentación falla → DEFECTUOSO
- Pantalla dañada (crítico por tamaño) → DEFECTUOSO

### Costes de Piezas

**MacBook Pro 14":**
- Pantalla: 350€ + 2h MO = 440€
- Teclado: 180€ + 1.5h MO = 247€
- Batería: 150€ + 1h MO = 195€
- Chasis: 120€ + 1.5h MO = 187€

**MacBook Pro 16":**
- Pantalla: 450€ + 2.5h MO = 562€
- (resto similar ajustado)

### Configuración en BD

**Modelo `GradingConfig`** almacena configuración por tipo:
- `tipo_dispositivo`: Tipo del dispositivo
- `pp_A`, `pp_B`, `pp_C`: Penalizaciones estéticas
- `tiene_bateria`: Bool indicando si tiene batería
- `componentes_evaluables`: JSON con lista de componentes
- `gates_especificos`: JSON con reglas de gates

**Gestionar configuraciones:**
```bash
python manage.py init_grading_configs
```
```

---

### 6.2 Crear documento de configuración

**Archivo nuevo:** `docs/Grading_Configuration.md`

```markdown
# Configuración del Sistema de Grading Unificado

## Tabla de Parámetros por Tipo de Dispositivo

| Tipo | V_suelo (dinámico) | pp_A | pp_B | pp_C | pp_func | Tiene Batería |
|------|-------------------|------|------|------|---------|--------------|
| iPhone | 8-20% según V_Aplus | 8% | 12% | 15% | 15% | ✅ |
| iPad | 8-20% | 8% | 12% | 15% | 15% | ✅ |
| MacBook Pro | 8-20% | 8% | 12% | 15% | 15% | ✅ |
| MacBook Air | 8-20% | 8% | 12% | 15% | 15% | ✅ |
| iMac | 8-20% | 8% | 12% | 15% | 15% | ❌ |
| Mac Studio | 8-20% | 8% | 12% | 15% | 15% | ❌ |
| Mac Pro | 8-20% | 8% | 12% | 15% | 15% | ❌ |
| Mac mini | 8-20% | 8% | 12% | 15% | 15% | ❌ |

## Costes de Piezas y Mano de Obra

### MacBook Pro 14"
- **Pantalla Retina 14"**: 350€ neto + 2h MO (90€) = **440€ total**
- **Teclado completo**: 180€ + 1.5h MO (67.5€) = **247.5€ total**
- **Batería**: 150€ + 1h MO (45€) = **195€ total**
- **Chasis**: 120€ + 1.5h MO (67.5€) = **187.5€ total**

### MacBook Pro 16"
- **Pantalla Retina 16"**: 450€ + 2.5h MO (112.5€) = **562.5€ total**
- **Teclado completo**: 200€ + 1.5h MO = **267.5€ total**
- **Batería**: 180€ + 1h MO = **225€ total**
- **Chasis**: 150€ + 1.5h MO = **217.5€ total**

### MacBook Air M2
- **Pantalla**: 280€ + 1.5h MO = **347.5€ total**
- **Teclado**: 150€ + 1.5h MO = **217.5€ total**
- **Batería**: 120€ + 1h MO = **165€ total**
- **Chasis**: 100€ + 1h MO = **145€ total**

### iPad Pro 11"
- **Pantalla táctil**: 200€ + 1.5h MO = **267.5€ total**
- **Batería**: 80€ + 0.5h MO = **102.5€ total**
- **Cristal trasero**: 50€ + 1h MO = **95€ total**

### iMac 24" M1
- **Panel 4.5K**: 600€ + 3h MO = **735€ total**
- **Chasis/Pie**: 150€ + 2h MO = **240€ total**

## Reglas de Gates por Tipo

### iPhone/iPad
- ❌ No enciende
- ❌ No carga
- ❌ Display image status ≠ OK (PIX, LINES, BURN, MURA)
- ❌ Glass status = DEEP/CHIP/CRACK
- ❌ Housing status = DOBLADO
- ❌ Funcionalidad básica falla

### MacBook Pro/Air
- ❌ No enciende
- ❌ No carga
- ❌ Bisagras rotas
- ❌ Teclado no funciona
- ❌ Trackpad no funciona
- ❌ Puerto carga roto
- ❌ Display image ≠ OK
- ❌ Glass agrietado (DEEP/CHIP/CRACK)
- ❌ Chasis doblado
- ❌ Funcionalidad básica falla

### iMac
- ❌ No enciende
- ❌ Puerto alimentación falla
- ❌ Display image ≠ OK (crítico por tamaño)
- ❌ Glass agrietado
- ❌ Funcionalidad básica falla

### Mac Studio/Pro/mini
- ❌ No enciende
- ❌ Puertos no funcionan
- ❌ Chasis gravemente dañado
- ❌ Funcionalidad básica falla

## Ejemplo de Cálculo (MacBook Pro 14" 512GB B2B)

**Datos iniciales:**
- Modelo: MacBook Pro 14" M2 Pro
- Capacidad: 512 GB
- Canal: B2B
- V_Aplus (precio base): 950€

**Evaluación:**
- Enciende: ✅ Sí
- Carga: ✅ Sí
- Teclado: ✅ Funciona
- Trackpad: ✅ Funciona
- Bisagras: OK
- Funcionalidad básica: ✅ OK
- Batería: 82% (< 85% → deducción)
- Display: OK
- Glass: MICRO (arañazos leves)
- Housing: MINIMOS (signos mínimos)

**Paso 1: Gates**
- Resultado: ✅ OK (pasa todos los gates)

**Paso 2: Grado estético**
- Glass=MICRO + Housing=MINIMOS → Grado **A**
- Topes: V_A = 950 × (1-0.08) = **874€**

**Paso 3: Deducciones**
- Batería <85%: 195€ (coste batería + MO)
- Pantalla: 0€ (está OK)
- Chasis: 0€ (no hay desgaste visible)
- **Total deducciones: 195€**

**Paso 4: Cálculo precio**
- V1 = 874 - 195 = **679€**
- V2 = 679 (sin penalización funcional, todo funciona OK)
- Redondeo a múltiplo de 5: **680€**
- V_suelo = max(50€, 950×0.08) = 76€ (redondeo 75€)
- **Oferta final: max(680, 75) = 680€**

**Resultado:**
- ✅ Gate: OK
- 🏷️ Grado: A
- 💰 Oferta: **680€**
```

---

### 6.3 Actualizar API docs

**Archivo:** `docs/Api_Endpoints.md`

Añadir sección:

```markdown
### Valoración Comercial y Auditoría Genérica (Multi-dispositivo)

#### Valoración Comercial
**Endpoint:** `POST /api/valoraciones/{tipo_slug}/comercial/`

Calcula la oferta de compra para cualquier tipo de dispositivo en contexto comercial (B2B/B2C).

**Tipos soportados (`tipo_slug`):**
- `iphone` - iPhone (todas las generaciones)
- `ipad` - iPad (todas las variantes)
- `macbook-air` - MacBook Air
- `macbook-pro` - MacBook Pro
- `imac` - iMac
- `mac-studio` - Mac Studio
- `mac-pro` - Mac Pro
- `mac-mini` - Mac mini

**Payload (ejemplo MacBook Pro):**
```json
{
  "modelo_nombre": "MacBook Pro 14\" M2",
  "capacidad_texto": "512 GB",
  "canal": "B2B",
  "tenant": "progeek",
  "enciende": true,
  "carga": true,
  "funcional_basico_ok": true,
  "battery_health_pct": 88,
  "display_image_status": "OK",
  "glass_status": "MICRO",
  "housing_status": "MINIMOS",
  "teclado_funcional": true,
  "trackpad_funcional": true,
  "bisagras_estado": "OK",
  "puerto_carga_ok": true
}
```

**Respuesta (200 OK):**
```json
{
  "oferta": 820,
  "gate": "OK",
  "grado_estetico": "A",
  "tipo_dispositivo": "MacBook Pro",
  "V_Aplus": 950,
  "V_A": 874,
  "V_B": 769,
  "V_C": 653,
  "V_tope": 874,
  "deducciones": {
    "pr_bat": 0,
    "pr_pant": 0,
    "pr_chas": 0,
    "pp_func": 0
  },
  "params": {
    "V_suelo": 76,
    "pp_A": 0.08,
    "pp_B": 0.12,
    "pp_C": 0.15,
    "pr_bateria": 195,
    "pr_pantalla": 440,
    "pr_chasis": 187,
    "v_suelo_regla": {
      "value": 76,
      "pct": 0.08,
      "min": 50,
      "label": ">=800: 8% / min 50€"
    }
  },
  "calculo": {
    "V1": 874,
    "aplica_pp_func": false,
    "V2": 874,
    "redondeo5": 870,
    "suelo": 76,
    "oferta_final": 870
  }
}
```

**Errores:**
- `400`: Tipo no soportado o datos inválidos
- `404`: No hay precio vigente para capacidad/canal
- `401`: No autenticado

---

#### Auditoría Técnica
**Endpoint:** `POST /api/valoraciones/{tipo_slug}/auditoria/`

Mismo comportamiento que valoración comercial, pero endpoint separado para claridad semántica.

---

#### Endpoints Legacy (Retrocompatibilidad)
**Mantienen funcionamiento pero se recomienda usar genéricos:**
- `POST /api/valoraciones/iphone/comercial/` → usar `/api/valoraciones/iphone/comercial/`
- `POST /api/valoraciones/iphone/auditoria/` → usar `/api/valoraciones/iphone/auditoria/`
```

---

## 🎯 Orden de Implementación Sugerido

### Sprint 1: Backend Core (1 semana)
1. ✅ Crear modelo `GradingConfig` y migración
2. ✅ Crear serializers genéricos (Base + MacBook + iMac)
3. ✅ Generalizar `grading.py` (gates por tipo, deducciones condicionales)
4. ✅ Implementar `ValoracionComercialGenericaView` y `ValoracionAuditoriaGenericaView`
5. ✅ Actualizar URLs con endpoints genéricos
6. ✅ Testing básico backend (pytest)

### Sprint 2: Datos (3-4 días)
7. ✅ Script `poblar_precios_grading.py` (precios B2B MacBooks, iPads, iMacs)
8. ✅ Script `poblar_costes_piezas.py` (costes con MO para todos los tipos)
9. ✅ Script `init_grading_configs.py` (configuraciones iniciales)
10. ✅ Ejecutar scripts y validar datos en BD

### Sprint 3: Frontend (1 semana)
11. ✅ Actualizar `grading.ts` con tipos genéricos (TipoDispositivo, MacBookInput, etc.)
12. ✅ Crear `CuestionarioComercialMacBook.tsx`
13. ✅ Actualizar `valoraciones.ts` con funciones genéricas
14. ✅ Actualizar `gradingCalcs.ts` (pasaGatesMacBook, router genérico)
15. ✅ Integrar en `FormularioValoracionOportunidad.tsx` (detección de tipo + render condicional)
16. ✅ Testing frontend (Jest + React Testing Library)

### Sprint 4: Resto de Tipos (1 semana)
17. ✅ Repetir Sprint 3 para iPad (reutilizar iPhone en mayoría)
18. ✅ Repetir Sprint 3 para iMac
19. ✅ Repetir Sprint 3 para Mac desktop (Studio/Pro/mini)
20. ✅ Testing frontend completo para todos los tipos
21. ✅ Testing de integración API (tier2-business.test.ts)

### Sprint 5: Polish y Documentación (3-4 días)
22. ✅ Migración de datos históricos (`migrar_valoraciones_antiguas.py`)
23. ✅ Actualizar `CLAUDE.md` con sistema unificado
24. ✅ Crear `Grading_Configuration.md` con tablas detalladas
25. ✅ Actualizar `Api_Endpoints.md`
26. ✅ Validación end-to-end con datos reales
27. ✅ Code review y ajustes finales

---

## ✅ Criterios de Aceptación

**Backend (Sistema Nuevo):**
- [ ] Backend acepta valoraciones para todos los tipos de dispositivo (8 tipos)
- [ ] Endpoints genéricos funcionando: `/api/valoraciones/{tipo}/comercial/` y `/auditoria/`
- [ ] Cálculos de precio correctos para MacBook Pro (validado con 10+ casos reales)
- [ ] Gates específicos funcionan correctamente (bisagras rotas → DEFECTUOSO, etc.)
- [ ] Deducciones de piezas aplican correctamente por tipo (batería solo si tiene, etc.)
- [ ] Modelo `GradingConfig` creado y poblado para todos los tipos
- [ ] `PrecioRecompra` B2B verificados (ya existen en BD)
- [ ] `CostoPieza` verificados (ya existen en BD)

**Frontend:**
- [ ] Frontend renderiza cuestionarios específicos según tipo detectado automáticamente
- [ ] Componente `CuestionarioComercialMacBook` funcionando y validando
- [ ] Servicios `valoraciones.ts` con funciones genéricas implementadas
- [ ] `gradingCalcs.ts` con soporte para múltiples tipos (iPhone + MacBook mínimo)
- [ ] Detección automática de tipo desde descripción de modelo

**Testing:**
- [ ] Tests backend cubren al menos 80% de casos por tipo (pytest)
- [ ] Tests frontend para utilidades y hooks (Jest + RTL)
- [ ] Tests de integración API para valoraciones genéricas (tier2-business.test.ts)
- [ ] Casos edge validados: todos gates, todas deducciones, límites de bandas de suelo

**Coexistencia:**
- [ ] Sistema Legacy (checkouters/) sigue funcionando sin cambios
- [ ] Endpoints legacy iPhone mantienen compatibilidad (`/valoraciones/iphone/comercial/`)
- [ ] NO hay conflictos entre ambos sistemas (operan independientemente)
- [ ] NO se requiere migración de datos históricos

**Documentación:**
- [ ] CLAUDE.md actualizado con sección de Sistema de Grading Unificado
- [ ] `docs/Grading_Configuration.md` creado con tablas de configuración por tipo
- [ ] `docs/Api_Endpoints.md` actualizado con endpoints genéricos
- [ ] Ejemplos de payloads documentados para cada tipo de dispositivo

**Performance:**
- [ ] Endpoint responde en <500ms (P95) para valoraciones
- [ ] Queries de BD optimizadas (`vigente_precio_recompra`, `vigente_coste_pieza`)
- [ ] Configuraciones de grading cacheadas (rara vez cambian)

---

## 🚨 Consideraciones Importantes

### 1. Coexistencia de Sistemas
⚠️ **MUY IMPORTANTE**: NO tocar el Sistema Legacy
- El Sistema Legacy (`Dispositivo.estado_valoracion`) **NO se modifica**
- **NO se migran** datos históricos
- **NO se eliminan** endpoints o funcionalidades existentes
- Los dos sistemas operan de forma **completamente independiente**
- El Sistema Nuevo es **adicional**, no reemplaza al Legacy

### 2. Precios y Costes Ya Existen
✅ **Los datos ya están en BD**: `PrecioRecompra` y `CostoPieza` están poblados para todos los dispositivos.

**Solo es necesario:**
- Verificar que hay precios B2B para modelos de testing (script opcional de verificación)
- Verificar que hay costes de piezas para componentes clave (script opcional)

**NO es necesario:**
- ❌ Poblar precios manualmente
- ❌ Poblar costes de piezas manualmente
- ❌ Validar con comercial (ya están en producción)

### 4. Testing Exhaustivo
✅ Validar con casos extremos:
- Todos los gates activados simultáneamente
- Todas las deducciones aplicadas (máximo impacto)
- Precios en los límites de las bandas de suelo
- Dispositivos sin batería (iMac, Mac desktop)
- Bisagras flojas vs rotas (MacBook)

### 5. Mantener Endpoints Legacy
✅ Mantener endpoints legacy de iPhone durante toda la vida del sistema:
- `/api/valoraciones/iphone/comercial/` debe seguir funcionando
- `/api/valoraciones/iphone/auditoria/` debe seguir funcionando
- Son alias de los genéricos, pero mantienen URL original por compatibilidad

### 6. Fase B2C Posterior
⚠️ Este plan es **solo B2B**. Para B2C se necesitará:
- Ajustar precios (canal B2C típicamente 10-15% menor)
- Posiblemente ajustar penalizaciones (pp_A, pp_B, pp_C)
- Validar suelos dinámicos para B2C
- Testing adicional con flujo B2C completo

### 6. Performance y Escalabilidad
✅ Considerar:
- Índices en BD para `GradingConfig.tipo_dispositivo`
- Cache de configuraciones de grading (rara vez cambian)
- Optimización de queries `vigente_precio_recompra` y `vigente_coste_pieza`

### 7. Monitoreo en Producción
📊 Implementar métricas:
- Distribución de gates (% OK vs DEFECTUOSO por tipo)
- Distribución de grados (% A+/A/B/C/D por tipo)
- Oferta promedio por tipo y canal
- Errores de validación (campos faltantes, etc.)

---

## 📞 Contacto y Soporte

Para dudas sobre este plan:
- **Backend**: Consultar con equipo de productos/valoraciones
- **Frontend**: Consultar con equipo de UX/formularios
- **Datos**: Consultar con comercial (precios) y técnicos (costes)
- **Testing**: Asegurar cobertura antes de merge a main

---

**Última actualización:** 2025-10-01
**Versión del plan:** 1.0
**Estado:** ✅ Listo para aprobación e implementación
