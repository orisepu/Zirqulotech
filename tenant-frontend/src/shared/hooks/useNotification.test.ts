/**
 * useNotification Hook Tests
 *
 * Tests for notification management hook.
 */

import { renderHook, act } from '@testing-library/react';
import { useNotification } from './useNotification';

describe('useNotification', () => {
  it('should initialize with closed notification', () => {
    const { result } = renderHook(() => useNotification());

    expect(result.current.notification.open).toBe(false);
    expect(result.current.notification.message).toBe('');
    expect(result.current.notification.severity).toBe('info');
  });

  it('should show notification with custom message and severity', () => {
    const { result } = renderHook(() => useNotification());

    act(() => {
      result.current.showNotification('Test message', 'success');
    });

    expect(result.current.notification.open).toBe(true);
    expect(result.current.notification.message).toBe('Test message');
    expect(result.current.notification.severity).toBe('success');
  });

  it('should default to info severity if not provided', () => {
    const { result } = renderHook(() => useNotification());

    act(() => {
      result.current.showNotification('Info message');
    });

    expect(result.current.notification.severity).toBe('info');
  });

  it('should hide notification', () => {
    const { result } = renderHook(() => useNotification());

    act(() => {
      result.current.showNotification('Test', 'success');
    });

    expect(result.current.notification.open).toBe(true);

    act(() => {
      result.current.hideNotification();
    });

    expect(result.current.notification.open).toBe(false);
    expect(result.current.notification.message).toBe('Test'); // Message persists
    expect(result.current.notification.severity).toBe('success'); // Severity persists
  });

  it('should show success notification', () => {
    const { result } = renderHook(() => useNotification());

    act(() => {
      result.current.showSuccess('Success message');
    });

    expect(result.current.notification.open).toBe(true);
    expect(result.current.notification.message).toBe('Success message');
    expect(result.current.notification.severity).toBe('success');
  });

  it('should show error notification', () => {
    const { result } = renderHook(() => useNotification());

    act(() => {
      result.current.showError('Error message');
    });

    expect(result.current.notification.open).toBe(true);
    expect(result.current.notification.message).toBe('Error message');
    expect(result.current.notification.severity).toBe('error');
  });

  it('should show warning notification', () => {
    const { result } = renderHook(() => useNotification());

    act(() => {
      result.current.showWarning('Warning message');
    });

    expect(result.current.notification.open).toBe(true);
    expect(result.current.notification.message).toBe('Warning message');
    expect(result.current.notification.severity).toBe('warning');
  });

  it('should show info notification', () => {
    const { result } = renderHook(() => useNotification());

    act(() => {
      result.current.showInfo('Info message');
    });

    expect(result.current.notification.open).toBe(true);
    expect(result.current.notification.message).toBe('Info message');
    expect(result.current.notification.severity).toBe('info');
  });

  it('should replace previous notification when showing new one', () => {
    const { result } = renderHook(() => useNotification());

    act(() => {
      result.current.showSuccess('First message');
    });

    expect(result.current.notification.message).toBe('First message');
    expect(result.current.notification.severity).toBe('success');

    act(() => {
      result.current.showError('Second message');
    });

    expect(result.current.notification.message).toBe('Second message');
    expect(result.current.notification.severity).toBe('error');
  });

  it('should maintain stable function references', () => {
    const { result, rerender } = renderHook(() => useNotification());

    const initialShowNotification = result.current.showNotification;
    const initialHideNotification = result.current.hideNotification;
    const initialShowSuccess = result.current.showSuccess;
    const initialShowError = result.current.showError;
    const initialShowWarning = result.current.showWarning;
    const initialShowInfo = result.current.showInfo;

    // Trigger a rerender
    rerender();

    // Function references should remain stable (useCallback)
    expect(result.current.showNotification).toBe(initialShowNotification);
    expect(result.current.hideNotification).toBe(initialHideNotification);
    expect(result.current.showSuccess).toBe(initialShowSuccess);
    expect(result.current.showError).toBe(initialShowError);
    expect(result.current.showWarning).toBe(initialShowWarning);
    expect(result.current.showInfo).toBe(initialShowInfo);
  });
});
