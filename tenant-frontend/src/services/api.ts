import axios from "axios";
import { navigateToLogin } from "@/shared/utils/navigation";
import { API_BASE_URL } from "@/shared/config/env";
import { getSecureItem, setSecureItem, removeSecureItem, secureTokens } from "@/shared/lib/secureStorage";
import { logger } from "@/shared/lib/logger";

export const BASE_URL = API_BASE_URL;

// Crea instancia base
const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Añade token y schema antes de cada request (ahora asíncrono)
api.interceptors.request.use(async (config) => {
  if (typeof window === "undefined") return config;

  try {
    // Leer tokens del secure storage (encriptado)
    const token = await getSecureItem("access");
    const schema = await getSecureItem("schema");
    const currentTenant = await getSecureItem("currentTenant");

    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Solo establecer X-Tenant del storage si NO viene ya en los headers de la petición
    // Esto permite que las peticiones específicas sobrescriban el tenant (ej: modo global)
    const tenantHeader = schema || currentTenant;
    if (tenantHeader && config.headers && !config.headers["X-Tenant"]) {
      config.headers["X-Tenant"] = tenantHeader;
    }

    return config;
  } catch (error) {
    logger.error("⚠️ Error leyendo tokens del secure storage:", error);
    return config;
  }
});

// Función para refrescar token (ahora con secure storage)
async function refreshToken() {
  const refresh = await getSecureItem("refresh");
  if (!refresh) throw new Error("No hay token refresh");

  const res = await axios.post(`${BASE_URL}/api/token/refresh/`, {
    refresh,
  });

  const { access } = res.data;
  await setSecureItem("access", access);
  return access;
}

// Interceptor de respuesta para capturar errores 401
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // No intentar refrescar token si la petición tiene la flag skipAuthRefresh
    // (usado para login y otras peticiones de autenticación)
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.skipAuthRefresh &&
      typeof window !== "undefined"
    ) {
      originalRequest._retry = true;

      try {
        const newAccess = await refreshToken();
        originalRequest.headers["Authorization"] = `Bearer ${newAccess}`;
        return api(originalRequest); // Reintenta con nuevo token
      } catch (refreshError) {
        // Limpiar tokens del secure storage
        secureTokens.removeAllTokens();
        removeSecureItem('chat_id');
        navigateToLogin();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;

export function login(empresa: string, email: string, password: string) {
  // Usar la instancia 'api' configurada con baseURL en lugar de axios directo
  return api.post(
    '/api/login/',
    { empresa, email, password },
    {
      headers: {
        "Content-Type": "application/json",
        "X-Tenant": empresa,
      },
      // Evitar que el interceptor intente refrescar el token en caso de 401
      // (credenciales incorrectas no deberían causar recarga de página)
      skipAuthRefresh: true,
    } as any  // TypeScript no reconoce propiedades custom en AxiosRequestConfig
  );
}

/**
 * Obtiene el access token del secure storage
 * @deprecated Prefer using getSecureItem('access') directly for better async handling
 */
export async function getAccessToken(): Promise<string | null> {
  return getSecureItem("access");
}


export async function fetchTotalPagado(params: {
  usuario_id?: number;
  tienda_id?: number;
  fecha_inicio?: string;
  fecha_fin?: string;
  schema?: string;  // 👈 añade esto
}) {
  const response = await api.get("/api/dashboard/total-pagado/", { params });
  return response.data;
}


export async function enviarOtpOportunidad(id: string|number){ return (await api.post(`/api/oportunidades/${id}/enviar-otp/`)).data }
export async function verificarOtpOportunidad(id: string|number, otp:string){ return (await api.post(`/api/oportunidades/${id}/verificar-otp/`,{otp})).data }
export async function generarContratoOportunidad(id: string|number){ return (await api.post(`/api/oportunidades/${id}/generar-contrato/`)).data as {ok:boolean;pdf_url?:string} }

// Tipos mínimos para el dashboard manager (extiende cuando añadas campos)
export type DashboardManagerResponse = {
  resumen: {
    valor_total: number
    ticket_medio: number
    comision_total: number
    comision_media: number
    margen_medio: number | null
    objetivo_total?: number | null
  }
  evolucion: { periodo: string; valor: number }[]
  comparativa?: { actual: number; anterior: number | null; variacion_pct: number | null }
  rankings: {
    productos: { nombre: string; valor: number }[]
    tiendas_por_valor: { tienda_id: number; tienda?: string | null; nombre?: string | null; valor: number }[]
    usuarios_por_valor: { usuario_id: number; usuario?: string | null; nombre?: string | null; valor: number }[]
    tiendas_por_operaciones: { tienda_id: number; tienda?: string | null; nombre?: string | null; ops: number }[]
    usuarios_por_operaciones: { usuario_id: number; usuario?: string | null; nombre?: string | null; ops: number }[]
  }
  pipeline: {
    abiertas: number
    valor_estimado: number
    por_estado: { estado: string; count: number; valor: number }[]
  }
  operativa: {
    recibidas: number
    completadas: number
    conversion_pct: number
    tmed_respuesta_h: number | null
    tmed_recogida_h: number | null
    tmed_cierre_h: number | null
    rechazos: { total: number; motivos: { motivo: string; count: number }[] }
    abandono_pct: number
  }
}

export async function fetchDashboardManager(params: {
  fecha_inicio: string
  fecha_fin: string
  granularidad?: 'dia' | 'semana' | 'mes'
  tienda_id?: number | string
  usuario_id?: number | string
  comparar?: boolean
  tenant?: string
}): Promise<DashboardManagerResponse> {
  const { data } = await api.get('api/dashboard/manager/', { params })
  return data
}

// Variante para Admin: mismo shape pero endpoint dedicado
export async function fetchDashboardAdmin(params: {
  fecha_inicio: string
  fecha_fin: string
  granularidad?: 'dia' | 'semana' | 'mes'
  tienda_id?: number | string
  usuario_id?: number | string
  comparar?: boolean
  tenant?: string
}): Promise<DashboardManagerResponse> {
  const { data } = await api.get('api/dashboard/admin/', { params })
  return data
}

export type PeriodoTipo = 'mes' | 'trimestre'
export type ObjetivoScope = 'tienda' | 'usuario'

export type ObjetivoResumenItem = {
  objetivo_id: number | null
  target_id: number
  target_name: string
  email?: string
  tipo: ObjetivoScope
  periodo_tipo: PeriodoTipo
  periodo: string
  objetivo_valor: number
  objetivo_operaciones: number
  progreso_valor: number
  progreso_operaciones: number
  usuarios?: {
    usuario_id: number
    nombre: string
    objetivo_valor: number
    objetivo_operaciones: number
    progreso_valor: number
    progreso_operaciones: number
  }[]
}

export async function fetchObjetivosResumen(params: {
  scope: ObjetivoScope
  periodo_tipo: PeriodoTipo
  periodo: string
}) {
  const { data } = await api.get<ObjetivoResumenItem[]>("/api/objetivos/resumen/", { params })
  return data
}

export async function guardarObjetivo(payload: {
  tipo: ObjetivoScope
  periodo_tipo: PeriodoTipo
  periodo_input: string
  objetivo_valor: number
  objetivo_operaciones: number
  tienda_id?: number
  usuario_id?: number
}) {
  await api.post("/api/objetivos/", payload)
}
