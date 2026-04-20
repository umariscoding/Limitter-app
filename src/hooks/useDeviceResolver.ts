import { useState, useEffect } from 'react';
import { resolveCurrentDeviceId } from '../services/currentDeviceService';
import { showAlert } from '../components/AppAlert';

export function useDeviceResolver(uid: string | undefined) {
  const [deviceId, setDeviceId] = useState<string>('');
  const [isResolving, setIsResolving] = useState(false);
  const [deviceLimitError, setDeviceLimitError] = useState<string | null>(null);

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
      .catch(err => {
        if (cancelled) return;
        const msg = err?.message || 'Failed to register device';
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
