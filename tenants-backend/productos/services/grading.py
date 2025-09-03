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
    # Gates
    gate = 'OK'
    if i.get('enciende') is False or i.get('carga') is False:
        gate = 'DEFECTUOSO'
    if i['display_image_status'] != 'OK':
        gate = 'DEFECTUOSO'
    if i['glass_status'] in ['DEEP','CHIP','CRACK']:
        gate = 'DEFECTUOSO'
    if i['housing_status'] == 'DOBLADO':
        gate = 'DEFECTUOSO'
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
        pantalla_ok = (i['display_image_status']=='OK' and i['glass_status'] in ['NONE','MICRO','VISIBLE'])
        chasis_ok = (i['housing_status']!='DOBLADO')
        if not pantalla_ok and chasis_ok: V_tope = params.V_Aplus
        elif pantalla_ok and not chasis_ok: V_tope = B
        else: V_tope = min(params.V_Aplus, A, B, C)
        g = 'C'

    # Deducciones (usamos tus costes DB ya calculados en la view)
    pr_bat  = params.pr_bateria if (i.get('battery_health_pct') is not None and i['battery_health_pct']<85) else 0
    pr_pant = params.pr_pantalla if (i['display_image_status']!='OK' or i['glass_status'] in ['DEEP','CHIP','CRACK']) else 0
    pr_chas = params.pr_chasis   if (i['housing_status'] in ['DESGASTE_VISIBLE','DOBLADO']) else 0

    V1 = V_tope - (pr_bat+pr_pant+pr_chas)
    if not isfinite(V1): V1 = 0

    aplica_pp_func = not (gate=='OK' and i.get('funcional_basico_ok') is True)
    pp_func = 0.15
    V2 = round(V1*(1-pp_func)) if aplica_pp_func else V1

    redondeo5 = round(V2/5)*5
    oferta = max(redondeo5, params.V_suelo, 0)

    return {
        "oferta": oferta,
        "gate": gate,
        "grado_estetico": g,
        "V_Aplus": params.V_Aplus, "V_A": A, "V_B": B, "V_C": C, "V_tope": V_tope,
        "deducciones": {"pr_bat": pr_bat, "pr_pant": pr_pant, "pr_chas": pr_chas, "pp_func": 0.15},
        "calculo": {"V1": V1, "aplica_pp_func": aplica_pp_func, "V2": V2, "redondeo5": redondeo5, "suelo": params.V_suelo, "oferta_final": oferta},
    }
