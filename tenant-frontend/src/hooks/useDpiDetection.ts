import { useEffect, useState } from 'react';

/**
 * Información detallada sobre el DPI y escalado del sistema
 */
export interface DpiInfo {
  /** Device pixel ratio actual (1 = 100%, 1.25 = 125%, 1.5 = 150%, 2 = 200%) */
  devicePixelRatio: number;
  /** Escalado del SO en porcentaje (100, 125, 150, 200) */
  scalingPercentage: number;
  /** Indica si el escalado es mayor a 100% */
  isHighDpi: boolean;
  /** Nivel de DPI: 'normal' | 'medium' | 'high' | 'very-high' */
  dpiLevel: 'normal' | 'medium' | 'high' | 'very-high';
  /** Ancho del viewport en píxeles CSS */
  viewportWidth: number;
  /** Alto del viewport en píxeles CSS */
  viewportHeight: number;
  /** Ancho del viewport en píxeles físicos */
  physicalWidth: number;
  /** Alto del viewport en píxeles físicos */
  physicalHeight: number;
  /** Información del navegador */
  browserInfo: {
    userAgent: string;
    vendor: string;
    platform: string;
  };
}

/**
 * Opciones para el hook useDpiDetection
 */
export interface UseDpiDetectionOptions {
  /** Si debe mostrar warnings en consola cuando detecta DPI alto (default: true en dev) */
  enableWarnings?: boolean;
  /** Si debe mostrar información detallada en consola (default: false) */
  enableDetailedLogging?: boolean;
  /** Callback cuando cambia el DPI */
  onDpiChange?: (info: DpiInfo) => void;
}

/**
 * Determina el nivel de DPI basado en el devicePixelRatio
 */
function getDpiLevel(dpr: number): DpiInfo['dpiLevel'] {
  if (dpr >= 2) return 'very-high';
  if (dpr >= 1.5) return 'high';
  if (dpr > 1) return 'medium';
  return 'normal';
}

/**
 * Obtiene información completa del DPI y escalado
 */
function getDpiInfo(): DpiInfo {
  if (typeof window === 'undefined') {
    // SSR fallback
    return {
      devicePixelRatio: 1,
      scalingPercentage: 100,
      isHighDpi: false,
      dpiLevel: 'normal',
      viewportWidth: 1920,
      viewportHeight: 1080,
      physicalWidth: 1920,
      physicalHeight: 1080,
      browserInfo: {
        userAgent: 'SSR',
        vendor: 'SSR',
        platform: 'SSR',
      },
    };
  }

  const dpr = window.devicePixelRatio || 1;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  return {
    devicePixelRatio: dpr,
    scalingPercentage: Math.round(dpr * 100),
    isHighDpi: dpr > 1,
    dpiLevel: getDpiLevel(dpr),
    viewportWidth,
    viewportHeight,
    physicalWidth: Math.round(viewportWidth * dpr),
    physicalHeight: Math.round(viewportHeight * dpr),
    browserInfo: {
      userAgent: navigator.userAgent,
      vendor: navigator.vendor,
      platform: navigator.platform,
    },
  };
}

/**
 * Hook para detectar y monitorear el DPI del sistema operativo
 *
 * @param options - Opciones de configuración
 * @returns Información del DPI y funciones helper
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { dpiInfo, isHighDpi, scalingPercentage } = useDpiDetection({
 *     enableWarnings: true,
 *     onDpiChange: (info) => console.log('DPI cambió:', info)
 *   });
 *
 *   if (isHighDpi) {
 *     return <div>Modo DPI alto detectado ({scalingPercentage}%)</div>
 *   }
 *
 *   return <div>DPI normal</div>
 * }
 * ```
 */
export function useDpiDetection(options: UseDpiDetectionOptions = {}) {
  const {
    enableWarnings = process.env.NODE_ENV === 'development',
    enableDetailedLogging = false,
    onDpiChange,
  } = options;

  const [dpiInfo, setDpiInfo] = useState<DpiInfo>(getDpiInfo);

  useEffect(() => {
    // Handler para cambios en el viewport o zoom
    const handleResize = () => {
      const newInfo = getDpiInfo();

      // Solo actualizar si cambió el DPI
      if (newInfo.devicePixelRatio !== dpiInfo.devicePixelRatio) {
        setDpiInfo(newInfo);
        onDpiChange?.(newInfo);

        if (enableDetailedLogging) {
          console.log('📊 DPI Info actualizado:', newInfo);
        }
      }
    };

    // Handler para media queries de resolución
    const mediaQueryLists: MediaQueryList[] = [];
    const resolutions = [1, 1.25, 1.5, 1.75, 2, 2.5, 3];

    resolutions.forEach((res) => {
      if (window.matchMedia) {
        const mql = window.matchMedia(`(resolution: ${res}dppx)`);
        const handler = () => {
          if (mql.matches) {
            handleResize();
          }
        };

        // Usar addEventListener si está disponible, sino addListener
        if (mql.addEventListener) {
          mql.addEventListener('change', handler);
        } else if (mql.addListener) {
          mql.addListener(handler);
        }

        mediaQueryLists.push(mql);
      }
    });

    // Listener para resize del window
    window.addEventListener('resize', handleResize);

    // Warning inicial si está en DPI alto
    if (enableWarnings && dpiInfo.isHighDpi) {
      console.warn(
        `⚠️ DPI alto detectado: ${dpiInfo.scalingPercentage}% (nivel: ${dpiInfo.dpiLevel})\n` +
        `   Viewport: ${dpiInfo.viewportWidth}x${dpiInfo.viewportHeight}px (CSS)\n` +
        `   Físico: ${dpiInfo.physicalWidth}x${dpiInfo.physicalHeight}px\n` +
        `   Si experimentas problemas de layout, verifica que los componentes usen valores rem responsivos.`
      );
    }

    if (enableDetailedLogging) {
      console.log('📊 DPI Detection inicializado:', dpiInfo);
    }

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);

      mediaQueryLists.forEach((mql) => {
        if (mql.removeEventListener) {
          mql.removeEventListener('change', handleResize);
        } else if (mql.removeListener) {
          mql.removeListener(handleResize);
        }
      });
    };
  }, [dpiInfo.devicePixelRatio, enableWarnings, enableDetailedLogging, onDpiChange]);

  /**
   * Formatea el DPI info para debugging
   */
  const getDebugString = (): string => {
    return [
      `DPI: ${dpiInfo.devicePixelRatio}x (${dpiInfo.scalingPercentage}%)`,
      `Nivel: ${dpiInfo.dpiLevel}`,
      `Viewport: ${dpiInfo.viewportWidth}x${dpiInfo.viewportHeight}px`,
      `Físico: ${dpiInfo.physicalWidth}x${dpiInfo.physicalHeight}px`,
      `Browser: ${dpiInfo.browserInfo.vendor}`,
    ].join(' | ');
  };

  /**
   * Retorna una recomendación de zoom para tablas basado en el DPI
   */
  const getRecommendedTableZoom = (): number => {
    // No aplicar zoom automático, dejar que las tablas usen rem
    return 1;
  };

  /**
   * Verifica si el componente podría tener problemas de layout
   */
  const shouldWarnAboutLayout = (): boolean => {
    return dpiInfo.isHighDpi && dpiInfo.dpiLevel !== 'medium';
  };

  return {
    dpiInfo,
    isHighDpi: dpiInfo.isHighDpi,
    scalingPercentage: dpiInfo.scalingPercentage,
    dpiLevel: dpiInfo.dpiLevel,
    devicePixelRatio: dpiInfo.devicePixelRatio,
    viewportWidth: dpiInfo.viewportWidth,
    viewportHeight: dpiInfo.viewportHeight,
    getDebugString,
    getRecommendedTableZoom,
    shouldWarnAboutLayout,
  };
}

/**
 * Hook simplificado que solo retorna si es DPI alto
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const isHighDpi = useIsHighDpi();
 *
 *   return (
 *     <div className={isHighDpi ? 'high-dpi-mode' : ''}>
 *       Content
 *     </div>
 *   );
 * }
 * ```
 */
export function useIsHighDpi(): boolean {
  const { isHighDpi } = useDpiDetection({ enableWarnings: false });
  return isHighDpi;
}

/**
 * Hook que retorna el scaling percentage actual
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const scaling = useScalingPercentage();
 *
 *   return <div>Sistema escalado al {scaling}%</div>;
 * }
 * ```
 */
export function useScalingPercentage(): number {
  const { scalingPercentage } = useDpiDetection({ enableWarnings: false });
  return scalingPercentage;
}
