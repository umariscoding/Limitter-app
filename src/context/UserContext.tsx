import React, {
  createContext,
  useState,
  useCallback,
  useContext,
  ReactNode,
} from "react";
import { type User as FirebaseUser } from "firebase/auth";

export interface AccountContext {
  uid: string;
  email: string;
  displayName: string | null;
  accountId: string;
  planCode: "free" | "pro" | "elite";
  device: {
    deviceId: string;
    installationId: string;
  } | null;
  // Backward-compat aliases for screens not yet migrated (Phase 9)
  name: string;
  plan: "free" | "pro" | "elite";
  overrides_left: number;
  idToken: string;
}

interface UserContextType {
  user: AccountContext | null;
  firebaseUser: FirebaseUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setAccountData: (data: any) => void;
  setFirebaseUser: (fbUser: FirebaseUser | null) => void;
  setIsLoading: (loading: boolean) => void;
  clearUser: () => void;
  // Backward-compat for screens not yet migrated
  login: (userData: any) => void;
  logout: () => void;
  updateUser: (userData: Partial<AccountContext>) => void;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

function parseAccountData(data: any): AccountContext | null {
  if (!data) return null;

  const planCode =
    data.subscription?.planCode ||
    data.account?.currentPlanCode ||
    data.planCode ||
    "free";
  const displayName = data.user?.displayName || data.displayName || null;

  return {
    uid: data.user?.uid || data.uid || "",
    email: data.user?.email || data.email || "",
    displayName,
    accountId:
      data.account?.accountId || data.user?.primaryAccountId || data.uid || "",
    planCode,
    device: data.device
      ? { deviceId: data.device.deviceId, installationId: data.device.installationId }
      : null,
    // Compat aliases
    name: displayName || data.user?.email?.split("@")[0] || "",
    plan: planCode,
    overrides_left: 0,
    idToken: "",
  };
}

export const UserContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AccountContext | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const setAccountData = useCallback((data: any) => {
    setUser(parseAccountData(data));
  }, []);

  const clearUser = useCallback(() => {
    setUser(null);
    setFirebaseUser(null);
  }, []);

  const login = useCallback((userData: any) => {
    setUser(parseAccountData(userData));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setFirebaseUser(null);
  }, []);

  const updateUser = useCallback((partial: Partial<AccountContext>) => {
    setUser((prev) => prev ? { ...prev, ...partial } : prev);
  }, []);

  return (
    <UserContext.Provider
      value={{
        user,
        firebaseUser,
        isLoading,
        isAuthenticated: !!firebaseUser && !!user,
        setAccountData,
        setFirebaseUser,
        setIsLoading,
        clearUser,
        login,
        logout,
        updateUser,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within UserContextProvider");
  }
  return context;
};
