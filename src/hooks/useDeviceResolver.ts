import { useState, useEffect } from 'react';
import { resolveCurrentDeviceId } from '../services/currentDeviceService';

export function useDeviceResolver(uid: string | undefined) {
  const [deviceId, setDeviceId] = useState<string>('');
  const [isResolving, setIsResolving] = useState(false);

  useEffect(() => {
    if (!uid) return;

    let cancelled = false;
    setIsResolving(true);

    resolveCurrentDeviceId(uid).then(resolvedId => {
      if (cancelled) return;
      if (resolvedId) {
        setDeviceId(resolvedId);
      }
      setIsResolving(false);
    });

    return () => {
      cancelled = true;
    };
  }, [uid]);

  return { deviceId, isResolving };
}
