# productos/services/grading.py
from dataclasses import dataclass
from math import isfinite
from typing import Dict

@dataclass
class Params:
    V_Aplus: int
    pp_A: float
    pp_B: float
    pp_C: float
    V_suelo: int
    pr_bateria: int
    pr_pantalla: int
    pr_chasis: int
    v_suelo_regla: Dict
    # Configuración específica del tipo de dispositivo
    has_battery: bool = True  # ¿Tiene batería?
    has_display: bool = True  # ¿Tiene pantalla integrada?
    tipo_dispositivo: str = 'iPhone'  # Para logging/debugging

def v_suelo_desde_max(V_Aplus: int):
    bands = [
        (100, 0.20, 10, '<100: 20% / min 10€'),
        (200, 0.18, 15, '100–199: 18% / min 15€'),
        (300, 0.15, 20, '200–299: 15% / min 20€'),
        (500, 0.12, 25, '300–499: 12% / min 25€'),
        (800, 0.10, 35, '500–799: 10% / min 35€'),
        (10**9, 0.08, 50, '>=800: 8% / min 50€'),
    ]
    to, pct, minimo, label = next(b for b in bands if V_Aplus < b[0])
    raw = max(minimo, round(V_Aplus * pct))
    value = round(raw / 5) * 5
    return value, {"value": value, "pct": pct, "min": minimo, "label": label}

def topes(V_Aplus:int, ppA:float, ppB:float, ppC:float):
    A = round(V_Aplus*(1-ppA))
    B = round(A*(1-ppB))
    C = round(B*(1-ppC))
    return A,B,C

def calcular(params: Params, i: dict):
    # Gates (configurables según tipo de dispositivo)
    gate = 'OK'

    # Gate básico: enciende y carga (solo si tiene batería para dispositivos portátiles)
    if i.get('enciende') is False:
        gate = 'DEFECTUOSO'
    if params.has_battery and i.get('carga') is False:
        gate = 'DEFECTUOSO'

    # Gates de pantalla (solo si tiene pantalla integrada)
    if params.has_display:
        if i.get('display_image_status') and i['display_image_status'] != 'OK':
            gate = 'DEFECTUOSO'
        if i.get('glass_status') and i['glass_status'] in ['DEEP','CHIP','CRACK']:
            gate = 'DEFECTUOSO'

    # Gate de housing/chasis (todos los dispositivos)
    if i.get('housing_status') == 'DOBLADO':
        gate = 'DEFECTUOSO'

    # Gate funcional básico (todos los dispositivos)
    if i.get('funcional_basico_ok') is False:
        gate = 'DEFECTUOSO'

    A,B,C = topes(params.V_Aplus, params.pp_A, params.pp_B, params.pp_C)

    # Grado estético si gate OK
    def grado(glass, housing):
        if glass=='NONE' and housing=='SIN_SIGNOS': return 'A+'
        if glass in ['NONE','MICRO'] and housing in ['SIN_SIGNOS','MINIMOS']: return 'A'
        if glass in ['VISIBLE','MICRO'] and housing in ['ALGUNOS','MINIMOS']: return 'B'
        return 'C'

    if gate=='OK':
        g = grado(i['glass_status'], i['housing_status'])
        V_tope = params.V_Aplus if g=='A+' else (A if g=='A' else (B if g=='B' else C))
    else:
        # ===== Helpers de grado por dimensión =====
        def grado_pantalla(glass: str) -> str:
            # NOTA: los casos DEEP/CHIP/CRACK ya han forzado D en los gates
            if glass == 'NONE':    return 'A+'
            if glass == 'MICRO':   return 'A'
            if glass == 'VISIBLE': return 'B'
            return 'C'
    
        def grado_chasis(housing: str) -> str:
            # Valores esperados: SIN_SIGNOS, MINIMOS, ALGUNOS, DESGASTE_VISIBLE, DOBLADO, BACKGLASS_ROTO?
            if housing in ('SIN_SIGNOS',):                return 'A+'
            if housing in ('MINIMOS',):                   return 'A'
            if housing in ('ALGUNOS',):                   return 'B'
            # DESGASTE_VISIBLE mantiene C (no fuerza D por sí mismo)
            return 'C'

        def tope_for(grado_dim: str) -> int:
            return params.V_Aplus if grado_dim=='A+' else (A if grado_dim=='A' else (B if grado_dim=='B' else C))

        # Evaluar pantalla solo si el dispositivo tiene pantalla integrada
        if params.has_display:
            pantalla_ok = (i.get('display_image_status')=='OK' and i.get('glass_status') in ['NONE','MICRO','VISIBLE'])
            gp = grado_pantalla(i.get('glass_status', 'NONE'))
            tp = tope_for(gp)
            d_pant = not pantalla_ok
        else:
            # Sin pantalla: siempre OK para esta dimensión
            pantalla_ok = True
            gp = 'A+'
            tp = params.V_Aplus
            d_pant = False

        chasis_doblado = (i.get('housing_status')=='DOBLADO' or i.get('backglass_status')=='AGRIETADO')
        chasis_ok = not chasis_doblado
        fallo_func = (i.get('funcional_basico_ok') is False)

        gh = grado_chasis(i.get('housing_status', 'SIN_SIGNOS'))
        th = tope_for(gh)
        d_chas = not chasis_ok

        # ===== Reglas D (documento) =====
        if d_pant and not d_chas and not fallo_func:
            # D por pantalla -> excluir pantalla: usar grado de chasis
            V_tope = th
        elif d_chas and not d_pant and not fallo_func:
            # D por chasis -> excluir chasis: usar grado de pantalla
            V_tope = tp
        elif d_pant and d_chas and not fallo_func:
            # D por pantalla y chasis (resto OK) -> Propuesta B
            V_tope = params.V_Aplus
        elif fallo_func and not d_pant and not d_chas:
            # D por fallo funcional con pantalla y chasis OK -> mínimo entre ambos
            V_tope = min(tp, th)
        else:
            # Mezclas (p.ej. D por pantalla + fallo funcional, etc.): ser conservadores
            # tomar el mínimo de los topes válidos de las dimensiones sanas
            candidatos = []
            if chasis_ok: candidatos.append(th)
            if pantalla_ok: candidatos.append(tp)
            V_tope = min(candidatos) if candidatos else C  # fallback conservador
        g = 'D'

    # Deducciones (usamos tus costes DB ya calculados en la view)
    # Batería: solo si el dispositivo tiene batería
    pr_bat = 0
    if params.has_battery and i.get('battery_health_pct') is not None and i['battery_health_pct'] < 85:
        pr_bat = params.pr_bateria

    # Pantalla: solo si el dispositivo tiene pantalla integrada
    pr_pant = 0
    if params.has_display:
        if (i.get('display_image_status') and i['display_image_status'] != 'OK') or \
           (i.get('glass_status') and i['glass_status'] in ['DEEP','CHIP','CRACK']):
            pr_pant = params.pr_pantalla

    # Chasis: todos los dispositivos
    pr_chas = 0
    if (i.get('housing_status') in ['DESGASTE_VISIBLE','DOBLADO']) or \
       i.get('backglass_status') in ('AGRIETADO', 'ROTO'):
        pr_chas = params.pr_chasis

    V1 = V_tope - (pr_bat+pr_pant+pr_chas)
    if not isfinite(V1): V1 = 0

    # Penalización funcional: sólo si el usuario declaró explícitamente fallo funcional (False).
    # Si es None (aún no evaluado) no se aplica en etapas tempranas de la auditoría.
    aplica_pp_func = (i.get('funcional_basico_ok') is False)
    pp_func = 0.15 if aplica_pp_func else 0.0
    V2 = round(V1*(1-pp_func)) if aplica_pp_func else V1

    redondeo5 = round(V2/5)*5
    oferta = max(redondeo5, params.V_suelo, 0)

    return {
        "oferta": oferta,
        "gate": gate,
        "grado_estetico": g,
        "V_Aplus": params.V_Aplus, "V_A": A, "V_B": B, "V_C": C, "V_tope": V_tope,
        "deducciones": {"pr_bat": pr_bat, "pr_pant": pr_pant, "pr_chas": pr_chas, "pp_func": pp_func},
        "calculo": {"V1": V1, "aplica_pp_func": aplica_pp_func, "V2": V2, "redondeo5": redondeo5, "suelo": params.V_suelo, "oferta_final": oferta},
    }
