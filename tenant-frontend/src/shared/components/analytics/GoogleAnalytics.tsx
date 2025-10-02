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

  // No cargar en desarrollo o testing
  if (
    process.env.NODE_ENV !== 'production' ||
    !measurementId ||
    measurementId.trim() === ''
  ) {
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
