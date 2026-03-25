import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

export interface WeeklyUsagePoint {
  dateKey: string;
  label: string;
  totalMinutes: number;
}

export interface DailyUsageData {
  dateKey: string;
  targets: any[];
}

interface UsageContextType {
  // Weekly usage data (last 7 days)
  weeklyUsage: WeeklyUsagePoint[];
  isLoadingWeekly: boolean;
  weeklyError: string | null;
  setWeeklyUsage: (data: WeeklyUsagePoint[]) => void;
  setIsLoadingWeekly: (loading: boolean) => void;
  setWeeklyError: (error: string | null) => void;

  // Daily usage data
  dailyUsage: DailyUsageData | null;
  isLoadingDaily: boolean;
  setDailyUsage: (data: DailyUsageData | null) => void;
  setIsLoadingDaily: (loading: boolean) => void;

  // Current device ID
  currentDeviceId: string | null;
  setCurrentDeviceId: (id: string | null) => void;

  // Refresh tracking
  lastRefreshTime: number | null;
  setLastRefreshTime: (time: number | null) => void;

  // Reset all usage state
  clearUsageData: () => void;
}

const UsageContext = createContext<UsageContextType | undefined>(undefined);

export const UsageContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [weeklyUsage, setWeeklyUsage] = useState<WeeklyUsagePoint[]>([]);
  const [isLoadingWeekly, setIsLoadingWeekly] = useState(false);
  const [weeklyError, setWeeklyError] = useState<string | null>(null);
  const [dailyUsage, setDailyUsage] = useState<DailyUsageData | null>(null);
  const [isLoadingDaily, setIsLoadingDaily] = useState(false);
  const [currentDeviceId, setCurrentDeviceId] = useState<string | null>(null);
  const [lastRefreshTime, setLastRefreshTime] = useState<number | null>(null);

  const clearUsageData = useCallback(() => {
    setWeeklyUsage([]);
    setDailyUsage(null);
    setWeeklyError(null);
    setLastRefreshTime(null);
  }, []);

  return (
    <UsageContext.Provider
      value={{
        weeklyUsage,
        isLoadingWeekly,
        weeklyError,
        setWeeklyUsage,
        setIsLoadingWeekly,
        setWeeklyError,
        dailyUsage,
        isLoadingDaily,
        setDailyUsage,
        setIsLoadingDaily,
        currentDeviceId,
        setCurrentDeviceId,
        lastRefreshTime,
        setLastRefreshTime,
        clearUsageData,
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
