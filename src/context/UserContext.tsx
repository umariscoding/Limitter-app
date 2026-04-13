import React, {
  createContext,
  useState,
  useContext,
  useRef,
  useMemo,
  ReactNode,
} from "react";
import { type User as FirebaseUser } from "firebase/auth";
import { getPlanOverrideLimit } from "../utils/planRules";

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
    name: displayName || data.user?.email?.split("@")[0] || "",
    plan: planCode,
    overrides_left:
      data.overrides_left ??
      data.account?.overrides_left ??
      getPlanOverrideLimit(planCode),
    idToken: "",
  };
}

export const UserContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AccountContext | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const setAccountData = useRef((data: any) => {
    setUser(parseAccountData(data));
  }).current;

  const clearUser = useRef(() => {
    setUser(null);
    setFirebaseUser(null);
  }).current;

  const login = useRef((userData: any) => {
    setUser(parseAccountData(userData));
  }).current;

  const logout = useRef(() => {
    setUser(null);
    setFirebaseUser(null);
  }).current;

  const updateUser = useRef((partial: Partial<AccountContext>) => {
    setUser((prev) => prev ? { ...prev, ...partial } : prev);
  }).current;

  const value = useMemo(() => ({
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
  }), [user, firebaseUser, isLoading, setAccountData, setFirebaseUser, setIsLoading, clearUser, login, logout, updateUser]);

  return (
    <UserContext.Provider value={value}>
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
