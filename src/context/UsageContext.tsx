import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

export interface WeeklyUsagePoint {
  dateKey: string;
  label: string;
  totalMinutes: number;
}

interface UsageContextType {
  weeklyUsage: WeeklyUsagePoint[];
  isLoadingWeekly: boolean;
  weeklyError: string | null;
  setWeeklyUsage: (data: WeeklyUsagePoint[]) => void;
  setIsLoadingWeekly: (loading: boolean) => void;
  setWeeklyError: (error: string | null) => void;
}

const UsageContext = createContext<UsageContextType | undefined>(undefined);

export const UsageContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [weeklyUsage, setWeeklyUsage] = useState<WeeklyUsagePoint[]>([]);
  const [isLoadingWeekly, setIsLoadingWeekly] = useState(false);
  const [weeklyError, setWeeklyError] = useState<string | null>(null);

  return (
    <UsageContext.Provider
      value={{
        weeklyUsage,
        isLoadingWeekly,
        weeklyError,
        setWeeklyUsage,
        setIsLoadingWeekly,
        setWeeklyError,
      }}
    >
      {children}
    </UsageContext.Provider>
  );
};

export const useUsageContext = () => {
  const context = useContext(UsageContext);
  if (!context) {
    throw new Error("useUsageContext must be used within UsageContextProvider");
  }
  return context;
};
