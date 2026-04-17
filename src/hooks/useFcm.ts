import { useEffect, useRef } from "react";
import { endFcm, initFcm, FcmOnRefresh } from "../services/fcmService";

export function useFcm(deviceId: string | null, onRefresh?: FcmOnRefresh): void {
  const onRefreshRef = useRef<FcmOnRefresh>(() => {});
  onRefreshRef.current = onRefresh || (() => {});

  useEffect(() => {
    if (!deviceId) return;

    let cancelled = false;
    (async () => {
      try {
        await initFcm(deviceId, (type) => onRefreshRef.current?.(type));
      } catch (err: any) {
        if (cancelled) return;
        console.warn(`[useFcm] init failed: ${err?.message || err}`);
      }
    })();

    return () => {
      cancelled = true;
      endFcm();
    };
  }, [deviceId]);
}
