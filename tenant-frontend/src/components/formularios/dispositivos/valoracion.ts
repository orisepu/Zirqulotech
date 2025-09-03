// /workspace/circular/tenants-frontend/src/utils/valoracion.ts
export type NivelDesgaste = 'ninguno' | 'leve' | 'medio' | 'alto';
export type EstadoFisico = 'perfecto' | 'bueno' | 'aceptable' | 'dañado' | string;
export type EstadoFuncional = 'funciona' | 'no_enciende' | 'pantalla_rota' | 'otros' | string;

export interface BaseValoracionInput {
  estado_fisico?: EstadoFisico;
  estado_funcional?: EstadoFuncional;
  salud_bateria_pct?: number | null;
  ciclos_bateria?: number | null;

  // Pantalla
  pantalla_funcional_puntos_bril?: boolean;
  pantalla_funcional_pixeles_muertos?: boolean;
  pantalla_funcional_lineas_quemaduras?: boolean;

  // Exterior
  desgaste_lateral?: NivelDesgaste;
  desgaste_trasero?: NivelDesgaste;
}

/**
 * Devuelve: 'excelente' | 'muy_bueno' | 'bueno' | 'a_revision'
 */
export function calcularEstadoDetallado(input: BaseValoracionInput):
  'excelente' | 'muy_bueno' | 'bueno' | 'a_revision' {

  const { estado_fisico, estado_funcional } = input;

  // Críticos directos
  if (estado_fisico === 'dañado') return 'a_revision';
  if (estado_funcional === 'no_enciende' || estado_funcional === 'pantalla_rota') return 'a_revision';
  if (input.pantalla_funcional_lineas_quemaduras) return 'a_revision';

  let score = 100;

  // Batería
  const bat = Number.isFinite(input.salud_bateria_pct ?? NaN) ? (input.salud_bateria_pct as number) : null;
  if (bat !== null) {
    if (bat < 70) return 'a_revision';
    else if (bat < 75) score -= 25;
    else if (bat < 80) score -= 10;
    else if (bat < 85) score -= 5;
  }

  // Desgastes
  const penaliza = (n?: NivelDesgaste) => (n === 'alto' ? 15 : n === 'medio' ? 8 : n === 'leve' ? 3 : 0);
  score -= penaliza(input.desgaste_lateral);
  score -= penaliza(input.desgaste_trasero);

  // Pantalla no críticos
  if (input.pantalla_funcional_puntos_bril) score -= 5;
  if (input.pantalla_funcional_pixeles_muertos) score -= 5;

  // Bonus por perfecto/funciona
  if (estado_fisico === 'perfecto' && estado_funcional === 'funciona') score += 3;

  if (score >= 90) return 'excelente';
  if (score >= 80) return 'muy_bueno';
  if (score >= 65) return 'bueno';
  return 'a_revision';
}
