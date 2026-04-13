import React, { createContext, useState, useContext, useRef, useMemo, ReactNode } from 'react';
import type { UIPolicy } from '../utils/policyMapper';

interface PolicyContextType {
  policies: UIPolicy[];
  isLoading: boolean;
  lastFetchedAt: number;
  setPolicies: React.Dispatch<React.SetStateAction<UIPolicy[]>>;
  setIsLoading: (loading: boolean) => void;
  setLastFetchedAt: (ts: number) => void;
}

const PolicyContext = createContext<PolicyContextType | undefined>(undefined);

export const PolicyContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [policies, setPolicies] = useState<UIPolicy[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastFetchedAt, setLastFetchedAt] = useState(0);

  const setIsLoadingRef = useRef(setIsLoading);
  setIsLoadingRef.current = setIsLoading;
  const stableSetIsLoading = useRef((v: boolean) => setIsLoadingRef.current(v)).current;

  const setLastFetchedAtRef = useRef(setLastFetchedAt);
  setLastFetchedAtRef.current = setLastFetchedAt;
  const stableSetLastFetchedAt = useRef((v: number) => setLastFetchedAtRef.current(v)).current;

  const value = useMemo(() => ({
    policies,
    isLoading,
    lastFetchedAt,
    setPolicies,
    setIsLoading: stableSetIsLoading,
    setLastFetchedAt: stableSetLastFetchedAt,
  }), [policies, isLoading, lastFetchedAt, setPolicies, stableSetIsLoading, stableSetLastFetchedAt]);

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
