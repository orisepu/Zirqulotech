/**
 * Google Analytics 4 - Utilidades de Tracking
 *
 * Funciones type-safe para enviar eventos a GA4.
 * Automáticamente incluye el contexto de tenant en todos los eventos.
 */

// Declaración de tipos para gtag
declare global {
  interface Window {
    gtag?: (
      command: 'config' | 'event' | 'js' | 'set',
      targetId: string | Date,
      config?: Record<string, unknown>
    ) => void;
    dataLayer?: unknown[];
  }
}

/**
 * Parámetros comunes de eventos GA4
 */
export interface GAEventParams {
  event_category?: string;
  event_label?: string;
  value?: number;
  tenant_schema?: string;
  tenant_name?: string;
  user_id?: number;
  user_role?: string;
  is_demo?: boolean;
  [key: string]: unknown;
}

/**
 * Obtiene el schema del tenant actual desde localStorage
 */
function getCurrentTenant(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    // Intenta obtener de diferentes keys usadas en el proyecto
    return (
      localStorage.getItem('schema') ||
      localStorage.getItem('currentTenant') ||
      null
    );
  } catch {
    return null;
  }
}

/**
 * Verifica si GA4 está disponible y habilitado
 */
function isGAEnabled(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.gtag === 'function' &&
    process.env.NODE_ENV === 'production'
  );
}

/**
 * Wrapper type-safe para gtag
 */
export function gtag(
  command: 'config' | 'event' | 'js' | 'set',
  targetId: string | Date,
  config?: Record<string, unknown>
): void {
  if (!isGAEnabled()) return;

  try {
    window.gtag?.(command, targetId, config);
  } catch (error) {
    console.error('[GA4] Error sending event:', error);
  }
}

/**
 * Track page views
 *
 * @param url - URL de la página (ej: '/dashboard')
 * @param params - Parámetros adicionales (user_id, user_role, tenant_name, etc.)
 *
 * @example
 * pageview('/dashboard');
 * pageview('/oportunidades/123', { user_id: 42, user_role: 'manager', tenant_name: 'ProGeek' });
 */
export function pageview(url: string, params?: GAEventParams): void {
  if (!isGAEnabled()) return;

  const tenantSchema = params?.tenant_schema || getCurrentTenant();

  gtag('event', 'page_view', {
    page_path: url,
    page_location: window.location.href,
    page_title: document.title,
    tenant_schema: tenantSchema || 'unknown',
    tenant_name: params?.tenant_name,
    user_id: params?.user_id,
    user_role: params?.user_role,
    is_demo: params?.is_demo,
  });
}

/**
 * Track eventos personalizados
 *
 * @param action - Nombre del evento (ej: 'login', 'create_opportunity')
 * @param params - Parámetros adicionales del evento
 *
 * @example
 * event('login', { event_category: 'authentication', user_role: 'manager' });
 * event('create_opportunity', { event_category: 'crm', value: 500 });
 */
export function event(action: string, params?: GAEventParams): void {
  if (!isGAEnabled()) return;

  const tenantSchema = params?.tenant_schema || getCurrentTenant();

  gtag('event', action, {
    ...params,
    tenant_schema: tenantSchema || 'unknown',
  });
}

/**
 * Configura propiedades persistentes del usuario en GA4
 *
 * @param userId - ID del usuario
 * @param userRole - Rol del usuario (manager/empleado/admin)
 * @param tenantSchema - Schema del tenant
 * @param tenantName - Nombre del tenant
 * @param isDemo - Si es cuenta demo
 *
 * @example
 * setUserProperties(42, 'manager', 'progeek', 'ProGeek', false);
 */
export function setUserProperties(
  userId?: number,
  userRole?: string,
  tenantSchema?: string,
  tenantName?: string,
  isDemo?: boolean
): void {
  if (!isGAEnabled()) return;

  gtag('set', 'user_properties', {
    user_id: userId,
    user_role: userRole,
    tenant_schema: tenantSchema,
    tenant_name: tenantName,
    account_type: isDemo ? 'demo' : 'production',
  });
}

/**
 * Eventos de negocio comunes (helpers)
 */
export const analytics = {
  // Autenticación
  login: (role?: string) =>
    event('login', { event_category: 'authentication', user_role: role }),

  logout: () => event('logout', { event_category: 'authentication' }),

  // CRM
  createClient: (clientType?: string) =>
    event('create_client', {
      event_category: 'crm',
      event_label: clientType,
    }),

  createOpportunity: (value?: number) =>
    event('create_opportunity', {
      event_category: 'crm',
      value,
    }),

  changeOpportunityStatus: (fromStatus: string, toStatus: string) =>
    event('change_opportunity_status', {
      event_category: 'crm',
      event_label: `${fromStatus} → ${toStatus}`,
    }),

  // Dispositivos
  gradeDevice: (grade: string, deviceType?: string) =>
    event('grade_device', {
      event_category: 'devices',
      event_label: `${deviceType || 'unknown'} - ${grade}`,
    }),

  // Chat
  openChat: () => event('open_chat', { event_category: 'engagement' }),

  sendMessage: () => event('send_message', { event_category: 'engagement' }),

  // Búsqueda
  search: (query: string, resultsCount?: number) =>
    event('search', {
      event_category: 'engagement',
      search_term: query,
      value: resultsCount,
    }),

  // Exportaciones/Descargas
  downloadPDF: (documentType?: string) =>
    event('download_pdf', {
      event_category: 'documents',
      event_label: documentType,
    }),

  exportData: (exportType?: string) =>
    event('export_data', {
      event_category: 'data',
      event_label: exportType,
    }),
};
