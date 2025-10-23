/**
 * useNotification Hook
 *
 * Centralized notification/snackbar management hook.
 * Provides a clean API for showing success, error, warning, and info notifications.
 *
 * This is a shared hook because notifications are used across multiple features.
 */

import { useState, useCallback } from 'react';

export interface NotificationState {
  open: boolean;
  message: string;
  severity: 'success' | 'error' | 'warning' | 'info';
}

export interface UseNotificationReturn {
  notification: NotificationState;
  showNotification: (
    message: string,
    severity?: 'success' | 'error' | 'warning' | 'info'
  ) => void;
  hideNotification: () => void;
  showSuccess: (message: string) => void;
  showError: (message: string) => void;
  showWarning: (message: string) => void;
  showInfo: (message: string) => void;
}

const initialState: NotificationState = {
  open: false,
  message: '',
  severity: 'info',
};

/**
 * Hook for managing application notifications
 *
 * @returns Object with notification state and control functions
 *
 * @example
 * const { notification, showSuccess, showError, hideNotification } = useNotification();
 *
 * // Show success notification
 * showSuccess('Datos guardados correctamente');
 *
 * // Show error notification
 * showError('Error al guardar los datos');
 *
 * // Show custom notification
 * showNotification('Procesando...', 'info');
 *
 * // Use in Snackbar
 * <Snackbar open={notification.open} onClose={hideNotification}>
 *   <Alert severity={notification.severity}>
 *     {notification.message}
 *   </Alert>
 * </Snackbar>
 */
export function useNotification(): UseNotificationReturn {
  const [notification, setNotification] = useState<NotificationState>(initialState);

  const showNotification = useCallback(
    (message: string, severity: 'success' | 'error' | 'warning' | 'info' = 'info') => {
      setNotification({ open: true, message, severity });
    },
    []
  );

  const hideNotification = useCallback(() => {
    setNotification((prev) => ({ ...prev, open: false }));
  }, []);

  const showSuccess = useCallback(
    (message: string) => showNotification(message, 'success'),
    [showNotification]
  );

  const showError = useCallback(
    (message: string) => showNotification(message, 'error'),
    [showNotification]
  );

  const showWarning = useCallback(
    (message: string) => showNotification(message, 'warning'),
    [showNotification]
  );

  const showInfo = useCallback(
    (message: string) => showNotification(message, 'info'),
    [showNotification]
  );

  return {
    notification,
    showNotification,
    hideNotification,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };
}
