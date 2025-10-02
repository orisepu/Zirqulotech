# Google Analytics 4 - Documentación

Implementación de Google Analytics 4 para Checkouters Partners Platform con soporte multi-tenant.

## Configuración

### 1. Obtener Measurement ID

1. Ve a [Google Analytics](https://analytics.google.com/)
2. Admin → Data Streams
3. Selecciona tu stream o crea uno nuevo
4. Copia el **Measurement ID** (formato: `G-XXXXXXXXXX`)

### 2. Configurar Variables de Entorno

Agrega en tu archivo `.env.local`:

```env
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
```

⚠️ **Importante**: El tracking solo funciona en producción (`NODE_ENV=production`)

## Arquitectura

### Componentes

#### `<GoogleAnalytics />`
Carga los scripts de GA4. Ya está integrado en `src/app/layout.tsx`.

#### `<PageViewTracker />`
Detecta cambios de ruta y envía pageviews automáticamente. Ya está integrado en `src/app/layout.tsx`.

### Utilidades de Tracking

Importa desde `@/shared/lib/analytics`:

```typescript
import { pageview, event, analytics } from '@/shared/lib/analytics';
```

## Uso

### Tracking Manual de Pageviews

```typescript
import { pageview } from '@/shared/lib/analytics';

// Track pageview (el tenant se obtiene automáticamente)
pageview('/dashboard');

// Track con tenant específico
pageview('/oportunidades/123', 'progeek');
```

### Eventos Personalizados

```typescript
import { event } from '@/shared/lib/analytics';

// Evento básico
event('button_click', {
  event_category: 'engagement',
  event_label: 'download_report',
});

// Evento con valor
event('create_opportunity', {
  event_category: 'crm',
  value: 500,
});
```

### Eventos de Negocio (Helpers)

```typescript
import { analytics } from '@/shared/lib/analytics';

// Autenticación
analytics.login('manager');
analytics.logout();

// CRM
analytics.createClient('empresa');
analytics.createOpportunity(1500);
analytics.changeOpportunityStatus('nuevo', 'tasacion');

// Dispositivos
analytics.gradeDevice('A+', 'iPhone 15 Pro');

// Chat
analytics.openChat();
analytics.sendMessage();

// Búsqueda
analytics.search('iPhone 15', 12);

// Documentos
analytics.downloadPDF('oferta_comercial');
analytics.exportData('oportunidades_csv');
```

## Multi-Tenant

Todos los eventos incluyen automáticamente el `tenant_schema` como custom dimension:

- Se obtiene de `localStorage.getItem('schema')` o `localStorage.getItem('currentTenant')`
- Permite segmentar datos por tenant en Google Analytics
- No requiere configuración adicional

## Custom Dimensions en GA4

Para analizar por tenant, configura en Google Analytics:

1. Admin → Data Display → Custom Definitions
2. Create Custom Dimension:
   - Name: `Tenant Schema`
   - Scope: Event
   - Event parameter: `tenant_schema`

## Privacidad y GDPR

- `anonymize_ip: true` activado por defecto
- Cookies con flags `SameSite=None;Secure`
- Solo tracking en producción (no en desarrollo/testing)

## Testing

Los mocks de `window.gtag` están configurados en `src/setupTests.ts`:

```typescript
// Mock automático en todos los tests
expect(window.gtag).toBeDefined();
```

## Ejemplos de Integración

### En un componente React

```typescript
'use client';

import { analytics } from '@/shared/lib/analytics';

export function CreateClientButton() {
  const handleClick = () => {
    // Tu lógica de negocio
    createClient();

    // Track evento
    analytics.createClient('empresa');
  };

  return <button onClick={handleClick}>Crear Cliente</button>;
}
```

### En un hook de TanStack Query

```typescript
import { useMutation } from '@tanstack/react-query';
import { analytics } from '@/shared/lib/analytics';

export function useCreateOpportunity() {
  return useMutation({
    mutationFn: createOpportunityApi,
    onSuccess: (data) => {
      analytics.createOpportunity(data.valor_total);
    },
  });
}
```

## Verificación

### Development
En desarrollo, abre la consola y verifica que no haya errores relacionados con GA.

### Production
1. Despliega a producción con `NEXT_PUBLIC_GA_MEASUREMENT_ID` configurado
2. Abre Google Analytics → Reports → Realtime
3. Navega por tu app
4. Verifica que aparezcan los eventos en tiempo real

## Troubleshooting

### No aparecen eventos en GA4

- ✅ Verifica `NEXT_PUBLIC_GA_MEASUREMENT_ID` en `.env.local`
- ✅ Confirma que estás en producción (`NODE_ENV=production`)
- ✅ Revisa la consola del navegador por errores
- ✅ Verifica que el Measurement ID sea correcto

### Eventos se duplican

- El `<PageViewTracker />` solo debe estar una vez en el layout
- No llames manualmente a `pageview()` en componentes que usen `useRouter`

### Custom dimensions no aparecen

- Crea las custom dimensions en GA4 Admin
- Espera 24-48 horas para que aparezcan en los reportes estándar
- Mientras tanto, verifica en Realtime events → Event parameters

## Estructura de Archivos

```
src/shared/
├── components/analytics/
│   ├── GoogleAnalytics.tsx      # Componente de scripts GA4
│   ├── PageViewTracker.tsx      # Tracker automático de navegación
│   ├── index.ts                 # Exportaciones
│   └── README.md                # Esta documentación
└── lib/
    └── analytics.ts             # Utilidades de tracking
```

## Referencias

- [GA4 Documentation](https://developers.google.com/analytics/devguides/collection/ga4)
- [Next.js Analytics](https://nextjs.org/docs/app/building-your-application/optimizing/analytics)
- [Custom Dimensions Guide](https://support.google.com/analytics/answer/10075209)
