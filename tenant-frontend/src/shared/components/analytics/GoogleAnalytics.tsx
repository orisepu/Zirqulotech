import Script from 'next/script';

/**
 * Componente de Google Analytics 4
 *
 * Carga los scripts de GA4 solo en producción.
 * Incluye configuración GDPR-compliant (anonymize_ip).
 *
 * @usage
 * Incluir en el root layout después del <body>:
 * ```tsx
 * <GoogleAnalytics />
 * ```
 */
export function GoogleAnalytics() {
  const measurementId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

  // SECURITY FIX (HIGH-06): Validar formato de GA Measurement ID
  // Formato esperado: G-XXXXXXXXXX (G- seguido de exactamente 10 caracteres alfanuméricos)
  const GA_MEASUREMENT_ID_REGEX = /^G-[A-Z0-9]{10}$/;

  // No cargar en desarrollo o testing
  if (process.env.NODE_ENV !== 'production') {
    return null;
  }

  // Validación estricta del measurement ID
  if (!measurementId || !GA_MEASUREMENT_ID_REGEX.test(measurementId)) {
    // En producción, logear warning pero no exponer el ID inválido
    if (measurementId) {
      console.warn('[GoogleAnalytics] Invalid measurement ID format. Expected: G-XXXXXXXXXX');
    }
    return null;
  }

  return (
    <>
      {/* Google Analytics Script */}
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
      />

      {/* GA4 Configuration */}
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());

            gtag('config', '${measurementId}', {
              page_path: window.location.pathname,
              anonymize_ip: true,
              cookie_flags: 'SameSite=None;Secure'
            });
          `,
        }}
      />
    </>
  );
}
