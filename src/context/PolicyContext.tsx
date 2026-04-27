import React, { createContext, useState, useContext, useRef, useMemo, useEffect, ReactNode } from 'react';
import { AppState } from 'react-native';
import type { UIPolicy } from '../utils/policyMapper';
import { selectPolicyState } from '../utils/policyMapper';
import type { LiveLockEvent } from '../services/timerRealtimeService';
import { getAllManualLockMarkers, type ManualLockMarker } from '../services/lockPolicyNow';

interface PolicyContextType {
  policies: UIPolicy[];
  isLoading: boolean;
  lastFetchedAt: number;
  setPolicies: React.Dispatch<React.SetStateAction<UIPolicy[]>>;
  setRtdbLocks: React.Dispatch<React.SetStateAction<Record<string, LiveLockEvent>>>;
  setIsLoading: (loading: boolean) => void;
  setLastFetchedAt: (ts: number) => void;
  refreshManualLocks: () => Promise<void>;
}

const PolicyContext = createContext<PolicyContextType | undefined>(undefined);

export const PolicyContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [httpPolicies, setHttpPolicies] = useState<UIPolicy[]>([]);
  const [rtdbLocks, setRtdbLocks] = useState<Record<string, LiveLockEvent>>({});
  const [manualLocks, setManualLocks] = useState<Record<string, ManualLockMarker>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [lastFetchedAt, setLastFetchedAt] = useState(0);

  const policies = useMemo(() => {
    return httpPolicies.map(policy => selectPolicyState(rtdbLocks, manualLocks, policy));
  }, [httpPolicies, rtdbLocks, manualLocks]);

  const setIsLoadingRef = useRef(setIsLoading);
  setIsLoadingRef.current = setIsLoading;
  const stableSetIsLoading = useRef((v: boolean) => setIsLoadingRef.current(v)).current;

  const setLastFetchedAtRef = useRef(setLastFetchedAt);
  setLastFetchedAtRef.current = setLastFetchedAt;
  const stableSetLastFetchedAt = useRef((v: number) => setLastFetchedAtRef.current(v)).current;

  // Stable refresh function — safe to call from any closure without staleness.
  const refreshManualLocks = useRef(async () => {
    try {
      const markers = await getAllManualLockMarkers();
      setManualLocks(markers);
    } catch (err) {
      console.error('[PolicyContext] refreshManualLocks failed:', err);
    }
  }).current;

  // Initial load + foreground refresh. Markers live in AsyncStorage, so a cold
  // mount or returning-from-background must re-read them to catch any state the
  // app missed (e.g., another component mutated them while we were paused).
  useEffect(() => {
    void refreshManualLocks();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') void refreshManualLocks();
    });
    return () => sub.remove();
  }, [refreshManualLocks]);

  const value = useMemo(() => ({
    policies,
    isLoading,
    lastFetchedAt,
    setPolicies: setHttpPolicies,
    setRtdbLocks,
    setIsLoading: stableSetIsLoading,
    setLastFetchedAt: stableSetLastFetchedAt,
    refreshManualLocks,
  }), [policies, isLoading, lastFetchedAt, stableSetIsLoading, stableSetLastFetchedAt, refreshManualLocks]);

  return (
    <PolicyContext.Provider value={value}>
      {children}
    </PolicyContext.Provider>
  );
};

export const usePolicyContext = () => {
  const context = useContext(PolicyContext);
  if (!context) {
    throw new Error('usePolicyContext must be used within PolicyContextProvider');
  }
  return context;
};
