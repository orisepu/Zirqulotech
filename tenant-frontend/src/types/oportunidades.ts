export interface Cliente {
  id?: number
  tipo_cliente?: 'empresa' | 'autonomo' | 'particular'
  canal?: 'b2b' | 'b2c'
  razon_social?: string
  cif?: string
  contacto?: string
  posicion?: string
  nombre?: string
  apellidos?: string
  dni_nie?: string
  nif?: string
  nombre_comercial?: string
  telefono?: string
  correo?: string
  tienda_nombre?: string
  display_name?: string
  identificador_fiscal?: string
}

export interface ClienteOption {
  id: number
  display_name?: string
  razon_social?: string
  nombre?: string
  apellidos?: string
  nif?: string
  dni_nie?: string
  nombre_comercial?: string
  identificador_fiscal?: string
  tipo_cliente?: 'empresa' | 'autonomo' | 'particular'
}

export interface OportunidadFilters {
  cliente: string
  fechaInicio: string
  fechaFin: string
  estado: string[]
  finalizadas: 'todas' | 'finalizadas' | 'no_finalizadas'
}