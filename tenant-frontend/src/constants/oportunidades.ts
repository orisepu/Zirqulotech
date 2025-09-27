import { ESTADOS_OPERACIONESADMIN } from '@/context/estados'

export const ESTADOS_FINALIZADOS = ['Oferta confirmada']

export const ESTADOS_OPERACIONES_SET = new Set(
  ESTADOS_OPERACIONESADMIN.map((estado) => estado.toLowerCase())
)

export const CONTROL_H = (theme: any) => theme.spacing(6.2)