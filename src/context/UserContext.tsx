import React, {
  createContext,
  useState,
  useContext,
  useRef,
  useMemo,
  useEffect,
  ReactNode,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { type User as FirebaseUser } from "firebase/auth";
import { getPlanOverrideLimit } from "../utils/planRules";

const SUBSCRIPTION_CACHE_KEY = "@limitter/subscription";
const OFFLINE_GRACE_MS = 24 * 60 * 60 * 1000;

type PlanCode = "free" | "pro" | "elite";

export interface AccountContext {
  uid: string;
  email: string;
  displayName: string | null;
  accountId: string;
  planCode: PlanCode;
  device: {
    deviceId: string;
    installationId: string;
  } | null;
  name: string;
  plan: PlanCode;
  overrides_left: number;
  idToken: string;
  subscriptionValidUntilMs: number | null;
  grantedCredits: number;
  freeCreditsRemaining: number;
  lastBootstrapAtMs: number;
}

interface CachedSubscriptionSnapshot {
  planCode: PlanCode;
  subscriptionValidUntilMs: number | null;
  grantedCredits: number;
  freeCreditsRemaining: number;
  lastBootstrapAtMs: number;
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
  getEffectivePlan: () => PlanCode;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

function normalizePlanCode(value: any): PlanCode {
  if (value === "pro" || value === "elite" || value === "free") return value;
  return "free";
}

function parseAccountData(data: any, existing?: AccountContext | null): AccountContext | null {
  if (!data) return null;

  const planCode = normalizePlanCode(
    data.subscription?.planCode ||
      data.account?.currentPlanCode ||
      data.planCode ||
      "free",
  );
  const displayName = data.user?.displayName || data.displayName || null;

  const expiryMs =
    data.subscription?.expiryTimeMillis ??
    existing?.subscriptionValidUntilMs ??
    null;

  const overridesBlock = data.overrides || data.account?.overrides || null;
  const freeRemaining =
    overridesBlock?.freeRemaining ??
    existing?.freeCreditsRemaining ??
    getPlanOverrideLimit(planCode);
  const grantedRemaining =
    overridesBlock?.grantedRemaining ??
    existing?.grantedCredits ??
    0;
  const totalAvailable =
    overridesBlock?.totalAvailable ??
    (freeRemaining + grantedRemaining);

  return {
    uid: data.user?.uid || data.uid || existing?.uid || "",
    email: data.user?.email || data.email || existing?.email || "",
    displayName,
    accountId:
      data.account?.accountId ||
      data.user?.primaryAccountId ||
      existing?.accountId ||
      data.uid ||
      "",
    planCode,
    device: data.device
      ? { deviceId: data.device.deviceId, installationId: data.device.installationId }
      : existing?.device ?? null,
    name: displayName || data.user?.email?.split("@")[0] || existing?.name || "",
    plan: planCode,
    overrides_left: data.overrides_left ?? totalAvailable,
    idToken: existing?.idToken || "",
    subscriptionValidUntilMs: expiryMs,
    grantedCredits: grantedRemaining,
    freeCreditsRemaining: freeRemaining,
    lastBootstrapAtMs: Date.now(),
  };
}

async function persistSubscriptionSnapshot(user: AccountContext | null) {
  if (!user) {
    try {
      await AsyncStorage.removeItem(SUBSCRIPTION_CACHE_KEY);
    } catch {}
    return;
  }
  const snapshot: CachedSubscriptionSnapshot = {
    planCode: user.planCode,
    subscriptionValidUntilMs: user.subscriptionValidUntilMs,
    grantedCredits: user.grantedCredits,
    freeCreditsRemaining: user.freeCreditsRemaining,
    lastBootstrapAtMs: user.lastBootstrapAtMs,
  };
  try {
    await AsyncStorage.setItem(SUBSCRIPTION_CACHE_KEY, JSON.stringify(snapshot));
  } catch {}
}

async function hydrateSubscriptionSnapshot(): Promise<CachedSubscriptionSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(SUBSCRIPTION_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedSubscriptionSnapshot;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

function computeEffectivePlan(user: AccountContext | null): PlanCode {
  if (!user) return "free";
  if (user.planCode === "free") return "free";
  const now = Date.now();
  const expiry = user.subscriptionValidUntilMs;
  if (expiry == null) return user.planCode;
  if (now < expiry) return user.planCode;
  if (now < expiry + OFFLINE_GRACE_MS) return user.planCode;
  return "free";
}

export const UserContextProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AccountContext | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const userRef = useRef<AccountContext | null>(null);
  userRef.current = user;

  useEffect(() => {
    (async () => {
      const snapshot = await hydrateSubscriptionSnapshot();
      if (!snapshot) return;
      setUser((prev) => {
        if (prev) return prev;
        return {
          uid: "",
          email: "",
          displayName: null,
          accountId: "",
          planCode: snapshot.planCode,
          device: null,
          name: "",
          plan: snapshot.planCode,
          overrides_left:
            snapshot.grantedCredits + snapshot.freeCreditsRemaining,
          idToken: "",
          subscriptionValidUntilMs: snapshot.subscriptionValidUntilMs,
          grantedCredits: snapshot.grantedCredits,
          freeCreditsRemaining: snapshot.freeCreditsRemaining,
          lastBootstrapAtMs: snapshot.lastBootstrapAtMs,
        };
      });
    })();
  }, []);

  const setAccountData = useRef((data: any) => {
    setUser((prev) => {
      const next = parseAccountData(data, prev);
      persistSubscriptionSnapshot(next);
      return next;
    });
  }).current;

  const clearUser = useRef(() => {
    setUser(null);
    setFirebaseUser(null);
    persistSubscriptionSnapshot(null);
  }).current;

  const login = useRef((userData: any) => {
    setUser((prev) => {
      const next = parseAccountData(userData, prev);
      persistSubscriptionSnapshot(next);
      return next;
    });
  }).current;

  const logout = useRef(() => {
    setUser(null);
    setFirebaseUser(null);
    persistSubscriptionSnapshot(null);
  }).current;

  const updateUser = useRef((partial: Partial<AccountContext>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...partial };
      persistSubscriptionSnapshot(next);
      return next;
    });
  }).current;

  const getEffectivePlan = useRef(() => computeEffectivePlan(userRef.current)).current;

  const value = useMemo(
    () => ({
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
      getEffectivePlan,
    }),
    [
      user,
      firebaseUser,
      isLoading,
      setAccountData,
      setFirebaseUser,
      setIsLoading,
      clearUser,
      login,
      logout,
      updateUser,
      getEffectivePlan,
    ],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
};

export const useUser = () => {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within UserContextProvider");
  }
  return context;
};
