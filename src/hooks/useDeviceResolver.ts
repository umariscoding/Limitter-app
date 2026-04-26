import { useState, useEffect, useRef } from 'react';
import { resolveCurrentDeviceId } from '../services/currentDeviceService';
import { showAlert } from '../components/AppAlert';
import { signOut } from '../auth/firebaseAuthService';

export function useDeviceResolver(uid: string | undefined, clearUser?: () => void) {
  const [deviceId, setDeviceId] = useState<string>('');
  const [isResolving, setIsResolving] = useState(false);
  const [deviceLimitError, setDeviceLimitError] = useState<string | null>(null);
  const clearUserRef = useRef(clearUser);
  clearUserRef.current = clearUser;

  useEffect(() => {
    if (!uid) return;

    let cancelled = false;
    setIsResolving(true);
    setDeviceLimitError(null);

    resolveCurrentDeviceId(uid)
      .then(resolvedId => {
        if (cancelled) return;
        if (resolvedId) setDeviceId(resolvedId);
        setIsResolving(false);
      })
      .catch(async (err) => {
        if (cancelled) return;
        const code = err?.code || '';
        const msg = err?.message || 'Failed to register device';
        if (code === 'device/revoked') {
          showAlert('Device Replaced', 'This device has been replaced by another device. You will be signed out.');
          try { await signOut(); } catch {}
          clearUserRef.current?.();
          return;
        }
        if (msg.includes('plan') || msg.includes('device limit') || msg.includes('Device limit')) {
          setDeviceLimitError(msg);
          showAlert('Device Limit Reached', msg);
        }
        setIsResolving(false);
      });

    return () => { cancelled = true; };
  }, [uid]);

  return { deviceId, isResolving, deviceLimitError };
}
