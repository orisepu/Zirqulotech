// Mock data for testing APIs

export const mockUser = {
  id: 1,
  email: 'test@example.com',
  tipo_usuario: 'empleado' as const,
  name: 'Test User',
  global_role: {
    es_superadmin: false,
    es_empleado_interno: true,
    roles_por_tenant: {
      'test-tenant': {
        rol: 'empleado',
        tienda_id: 1
      }
    }
  }
}

export const mockAdminUser = {
  ...mockUser,
  id: 2,
  email: 'admin@example.com',
  name: 'Admin User',
  global_role: {
    es_superadmin: true,
    es_empleado_interno: true,
    roles_por_tenant: {}
  }
}

export const mockTenant = {
  id: 1,
  schema: 'test-tenant',
  nombre: 'Test Tenant',
  name: 'Test Tenant Company',
  slug: 'test-tenant',
  cif: 'B12345678',
  contacto_comercial: 'Juan Pérez',
  correo_comercial: 'comercial@test.com'
}

export const mockCliente = {
  id: 1,
  nombre: 'Cliente Test',
  apellidos: 'Apellidos Test',
  email: 'cliente@test.com',
  telefono: '600123456',
  dni: '12345678Z',
  tipo_cliente: 'particular' as const,
  created_at: '2024-01-01T00:00:00Z'
}

export const mockOportunidad = {
  id: 1,
  uuid: '123e4567-e89b-12d3-a456-426614174000',
  cliente: mockCliente,
  estado: 'presupuestado' as const,
  valor_total: 500,
  numero_dispositivos: 2,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z'
}

export const mockDispositivo = {
  id: 1,
  marca: 'Apple',
  modelo: 'iPhone 13',
  capacidad: '128GB',
  color: 'Azul',
  precio_comercial: 450,
  precio_auditoria: 350,
  activo: true
}

export const mockDispositivoReal = {
  id: 1,
  dispositivo: mockDispositivo,
  oportunidad_id: 1,
  imei: '123456789012345',
  estado_general: 'A' as const,
  estado_pantalla: 'OK' as const,
  estado_cristal: 'NONE' as const,
  valor_final: 450,
  observaciones: 'Dispositivo en buen estado'
}

export const mockDashboardData = {
  resumen: {
    valor_total: 15000,
    ticket_medio: 150,
    margen_medio: 75,
    comision_total: 1500
  },
  evolucion: [
    { periodo: '2024-01', valor: 5000 },
    { periodo: '2024-02', valor: 7500 },
    { periodo: '2024-03', valor: 2500 }
  ],
  rankings: {
    productos: [
      { producto: 'iPhone 13', valor: 8000, ops: 20 },
      { producto: 'iPhone 12', valor: 4500, ops: 15 },
      { producto: 'Samsung S22', valor: 2000, ops: 8 }
    ],
    usuarios_por_operaciones: [
      { usuario: 'Juan Pérez', ops: 25 },
      { usuario: 'María García', ops: 18 },
      { usuario: 'Carlos López', ops: 12 }
    ],
    usuarios_por_valor: [
      { usuario: 'Juan Pérez', valor: 9500 },
      { usuario: 'María García', valor: 5500 },
      { usuario: 'Carlos López', valor: 3000 }
    ],
    tiendas_por_operaciones: [
      { tienda: 'Tienda Centro', ops: 35 },
      { tienda: 'Tienda Norte', ops: 20 }
    ],
    tiendas_por_valor: [
      { tienda: 'Tienda Centro', valor: 12000 },
      { tienda: 'Tienda Norte', valor: 8000 }
    ]
  },
  pipeline: {
    por_estado: [
      { estado: 'Presupuestado', count: 10, valor: 5000 },
      { estado: 'Aceptado', count: 8, valor: 4000 },
      { estado: 'Vendido', count: 5, valor: 3000 },
      { estado: 'Rechazado', count: 2, valor: 1000 }
    ]
  }
}

export const mockChat = {
  id: 1,
  titulo: 'Soporte - Cliente Test',
  estado: 'abierto' as const,
  created_at: '2024-01-01T00:00:00Z',
  mensajes: [
    {
      id: 1,
      contenido: 'Hola, necesito ayuda con mi oportunidad',
      autor: 'Cliente',
      timestamp: '2024-01-01T00:00:00Z'
    },
    {
      id: 2,
      contenido: 'Hola, ¿en qué puedo ayudarte?',
      autor: 'Soporte',
      timestamp: '2024-01-01T00:05:00Z'
    }
  ]
}

export const mockB2CContrato = {
  id: 1,
  cliente: mockCliente,
  oportunidad: mockOportunidad,
  estado: 'borrador' as const,
  kyc_token: '123e4567-e89b-12d3-a456-426614174001',
  kyc_expires_at: '2024-01-08T00:00:00Z',
  created_at: '2024-01-01T00:00:00Z'
}

export const mockObjectivo = {
  id: 1,
  tipo_objetivo: 'valor' as const,
  valor_objetivo: 10000,
  periodo_inicio: '2024-01-01',
  periodo_fin: '2024-01-31',
  tienda_id: 1,
  usuario_id: null,
  activo: true
}

export const mockTienda = {
  id: 1,
  nombre: 'Tienda Centro',
  direccion: 'Calle Mayor 123',
  telefono: '912345678',
  email: 'centro@test.com',
  activa: true
}

export const mockLoginResponse = {
  refresh: 'mock-refresh-token-very-long-string',
  access: 'mock-access-token-very-long-string',
  schema: 'test-tenant',
  tenantAccess: ['test-tenant', 'other-tenant'],
  user: mockUser
}

export const mockValoracionIphone = {
  modelo: 'iPhone 13',
  capacidad: '128GB',
  estado_general: 'A',
  estado_pantalla: 'OK',
  estado_cristal: 'NONE',
  valor_comercial: 450,
  valor_auditoria: 350,
  factores_descuento: {
    estado_general: 0,
    estado_pantalla: 0,
    estado_cristal: 0
  }
}

// Error responses
export const mockApiErrors = {
  unauthorized: {
    detail: 'Token no válido',
    code: 'token_not_valid'
  },
  forbidden: {
    detail: 'No tienes permisos para realizar esta acción',
    code: 'permission_denied'
  },
  notFound: {
    detail: 'No encontrado',
    code: 'not_found'
  },
  validationError: {
    detail: 'Error de validación',
    field_errors: {
      email: ['Este campo es obligatorio'],
      telefono: ['Formato de teléfono no válido']
    }
  }
}