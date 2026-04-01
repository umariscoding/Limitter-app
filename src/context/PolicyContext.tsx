import React, { createContext, useState, useCallback, useContext, ReactNode } from 'react';
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

  return (
    <PolicyContext.Provider
      value={{
        policies,
        isLoading,
        lastFetchedAt,
        setPolicies,
        setIsLoading,
        setLastFetchedAt,
      }}
    >
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
