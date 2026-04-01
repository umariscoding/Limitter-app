import { useState, useEffect } from 'react';
import { resolveCurrentDeviceId } from '../native/currentDeviceService';

/**
 * Resolves the current device ID for the given user.
 * Caches the result in state so subsequent renders don't re-resolve.
 */
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
