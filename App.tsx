import React from "react";
import { Linking, View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import {
  NavigationContainer,
  createNavigationContainerRef,
} from "@react-navigation/native";
import MainNavigator from "./src/navigation/MainNavigator";
import { UserContextProvider, useUser } from "./src/context/UserContext";
import { UsageContextProvider } from "./src/context/UsageContext";
import { PolicyContextProvider, usePolicyContext } from "./src/context/PolicyContext";
import { onAuthStateChanged } from "./src/auth/firebaseAuthService";
import { refreshBootstrap } from "./src/services/bootstrapService";
import { startTimerRealtimeTracking, stopTimerRealtimeTracking } from "./src/services/timerRealtimeService";
import { getOverrideBalanceAPI, useOverrideAPI } from "./src/services/overrideService";
import { grantTemporaryOverrideAccess, grantTemporaryWebsiteOverride } from "./src/services/appBlockerService";
import { resolveCurrentDeviceId } from "./src/services/currentDeviceService";
import { getPolicyPackageKey } from "./src/utils/policyMapper";
import { useFcm } from "./src/hooks/useFcm";
import { AppAlertProvider } from "./src/components/AppAlert";
import TermsAndConditionsScreen, { isTermsAcceptedForAccount } from "./src/screens/TermsAndConditionsScreen";

const navigationRef = createNavigationContainerRef<any>();

type OverrideLinkPayload = {
  packageName: string;
  appName: string;
};

function AppInner(): React.JSX.Element {
  const { user, updateUser, setFirebaseUser, setAccountData, setIsLoading, clearUser } = useUser();
  const { policies } = usePolicyContext();
  const [bootstrapError, setBootstrapError] = React.useState<string | null>(null);
  const [retrying, setRetrying] = React.useState(false);
  const pendingOverrideRef = React.useRef<OverrideLinkPayload | null>(null);

  const depsRef = React.useRef({ policies, user, updateUser, setAccountData, setFirebaseUser, setIsLoading, clearUser });
  depsRef.current = { policies, user, updateUser, setAccountData, setFirebaseUser, setIsLoading, clearUser };

  // const parseOverrideLink = React.useRef(
  //   (url: string): OverrideLinkPayload | null => {
  //     try {
  //       const parsed = new URL(url);
  //       const packageName = parsed.searchParams.get("package") || "";
  //       const appName = parsed.searchParams.get("appName") || packageName;
  //       if (parsed.hostname?.toLowerCase() === "override" && packageName) {
  //         return { packageName, appName };
  //       }
  //     } catch (_) { }

  //     const overrideMatch = url.match(/limitter:\/\/override\?(.*)$/i);
  //     if (!overrideMatch) return null;
  //     const params = new URLSearchParams(overrideMatch[1] || "");
  //     const packageName = params.get("package") || "";
  //     const appName = params.get("appName") || packageName;
  //     if (!packageName) return null;
  //     return { packageName, appName };
  //   },
  // ).current;
  const parseOverrideLink = React.useRef(
    (url: string): OverrideLinkPayload | null => {
      // Small helper: parses "?package=foo&appName=bar" into an object.
      // We avoid URLSearchParams/URL because they have weak TypeScript types in React Native.
      const parseQuery = (query: string): Record<string, string> => {
        const result: Record<string, string> = {};
        for (const pair of query.split('&')) {
          if (!pair) continue;
          const [rawKey, rawValue = ''] = pair.split('=');
          try {
            result[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue);
          } catch {
            result[rawKey] = rawValue;
          }
        }
        return result;
      };

      // Match both forms: "limitter://override?..." and anything ending in "/override?..."
      const overrideMatch = url.match(/(?:^|\/\/)override\?(.*)$/i)
        || url.match(/limitter:\/\/override\?(.*)$/i);
      if (!overrideMatch) return null;

      const params = parseQuery(overrideMatch[1] || '');
      const packageName = params.package || '';
      const appName = params.appName || packageName;
      if (!packageName) return null;
      return { packageName, appName };
    },
  ).current;

  const openOverrideFlow = React.useRef(async (payload: OverrideLinkPayload) => {
    if (!navigationRef.isReady()) {
      pendingOverrideRef.current = payload;
      return;
    }

    const { policies, user, updateUser } = depsRef.current;

    // CHANGED: was navigating to SubscriptionPlansScreen; now goes straight to the new Buy Overrides page.
    const goToPlans = () =>
      navigationRef.navigate("BuyOverrides");

    const goToConfirm = (targetType: string) =>
      navigationRef.navigate("ConfirmOverrideScreen", {
        packageName: payload.packageName,
        appName: payload.appName,
        targetType,
      });

    let available = 0;
    try {
      const balance = await getOverrideBalanceAPI();
      available = balance?.totalAvailable ?? 0;
    } catch {
      goToPlans();
      return;
    }

    if (available <= 0) {
      goToPlans();
      return;
    }

    const normalizedPkg = String(payload.packageName).trim().toLowerCase();
    const matching = (Array.isArray(policies) ? policies : [])
      .filter((p: any) => {
        const k = getPolicyPackageKey(p);
        return k === normalizedPkg || k === `website:${normalizedPkg}`;
      })
      .sort((a: any, b: any) => (b.created_at || 0) - (a.created_at || 0))[0];

    const limitId = matching?.id as string | undefined;
    const targetType = (matching?.target_type as string) || "app";

    let deviceId: string | null = null;
    try {
      deviceId = await resolveCurrentDeviceId(user?.uid);
    } catch { }

    if (!limitId || !deviceId) {
      goToConfirm(targetType);
      return;
    }

    try {
      await useOverrideAPI(limitId, deviceId);
      updateUser({ overrides_left: Math.max(0, available - 1) });
      if (targetType === "website") {
        await grantTemporaryWebsiteOverride(payload.packageName, 5);
      } else {
        await grantTemporaryOverrideAccess(payload.packageName, payload.appName, 5);
      }
      const overriddenKey = targetType === "website"
        ? `website:${normalizedPkg}`
        : normalizedPkg;
      navigationRef.navigate("DashboardScreen", {
        refreshAt: Date.now(),
        justOverriddenPackage: overriddenKey,
      });
    } catch {
      goToConfirm(targetType);
    }
  }).current;

  const loadAccountRef = React.useRef(async () => {
    try {
      setBootstrapError(null);
      const accountData = await refreshBootstrap();
      depsRef.current.setAccountData(accountData);
    } catch (err: any) {
      setBootstrapError(err?.message || "Failed to load account. Check your connection.");
    }
  });

  const fcmRefreshRef = React.useRef(async () => {
    try {
      const accountData = await refreshBootstrap();
      depsRef.current.setAccountData(accountData);
    } catch (err: any) {
      console.warn(`[App] FCM-triggered refresh failed: ${err?.message || err}`);
    }
  });

  const fcmHandlerRef = React.useRef(async (type: string) => {
    if (type === "force_logout") {
      const { clearUser } = depsRef.current;
      try {
        const { signOut: doSignOut } = await import("./src/auth/firebaseAuthService");
        await doSignOut();
      } catch {}
      clearUser();
      return;
    }
    await fcmRefreshRef.current();
  });

  useFcm(user?.device?.deviceId || null, (type) => fcmHandlerRef.current(type));

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(async (fbUser) => {
      const { setFirebaseUser, clearUser, setIsLoading } = depsRef.current;
      if (fbUser && !fbUser.emailVerified) {
        setFirebaseUser(null);
        clearUser();
        setIsLoading(false);
        return;
      }
      setFirebaseUser(fbUser);
      if (fbUser) {
        await loadAccountRef.current();
      } else {
        clearUser();
        setBootstrapError(null);
      }
      setIsLoading(false);
    });
    return unsubscribe;
  }, []);

  React.useEffect(() => {
    startTimerRealtimeTracking();
    return () => {
      stopTimerRealtimeTracking();
    };
  }, []);

  React.useEffect(() => {
    const onDeepLink = ({ url }: { url: string }) => {
      try {
        const payload = parseOverrideLink(url);
        if (payload) openOverrideFlow(payload);
      } catch { }
    };

    const sub = Linking.addEventListener("url", onDeepLink);
    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl) onDeepLink({ url: initialUrl });
    });

    return () => sub.remove();
  }, []);

  // Account-scoped Terms & Conditions gate. Runs only AFTER the user is
  // authenticated and an accountId is available (signup/login complete + bootstrap
  // returned). Each accountId stores its own acceptance flag in AsyncStorage, so
  // a different account on the same device sees the screen again, and the same
  // account on a new device also sees it once. Once accepted, in-memory state
  // skips the gate for the rest of this session; on next launch the persisted
  // flag is read and the gate is bypassed.
  const accountId = user?.accountId || '';
  const [termsAccountId, setTermsAccountId] = React.useState<string | null>(null);
  const [termsAccepted, setTermsAccepted] = React.useState<boolean>(false);
  const [termsChecking, setTermsChecking] = React.useState<boolean>(false);

  React.useEffect(() => {
    if (!accountId) {
      setTermsAccountId(null);
      setTermsAccepted(false);
      setTermsChecking(false);
      return;
    }
    if (termsAccountId === accountId) return;
    let cancelled = false;
    setTermsChecking(true);
    (async () => {
      const accepted = await isTermsAcceptedForAccount(accountId);
      if (cancelled) return;
      setTermsAccountId(accountId);
      setTermsAccepted(accepted);
      setTermsChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId, termsAccountId]);

  if (bootstrapError) {
    return (
      <View style={errorStyles.container}>
        <Text style={errorStyles.title}>Connection Error</Text>
        <Text style={errorStyles.message}>{bootstrapError}</Text>
        <TouchableOpacity
          style={[errorStyles.retryBtn, retrying && { opacity: 0.6 }]}
          disabled={retrying}
          onPress={async () => {
            setRetrying(true);
            await loadAccountRef.current();
            setRetrying(false);
          }}
        >
          {retrying ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={errorStyles.retryText}>Retry</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  }

  if (accountId && (termsChecking || termsAccountId !== accountId)) {
    return (
      <View style={gateStyles.loading}>
        <ActivityIndicator size="large" color="#10B981" />
      </View>
    );
  }

  if (accountId && !termsAccepted) {
    return (
      <TermsAndConditionsScreen
        accountId={accountId}
        onAccept={() => setTermsAccepted(true)}
      />
    );
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        if (pendingOverrideRef.current) {
          const payload = pendingOverrideRef.current;
          pendingOverrideRef.current = null;
          openOverrideFlow(payload);
        }
      }}
    >
      <MainNavigator />
    </NavigationContainer>
  );
}

function App(): React.JSX.Element {
  return (
    <AppAlertProvider>
      <UserContextProvider>
        <UsageContextProvider>
          <PolicyContextProvider>
            <AppInner />
          </PolicyContextProvider>
        </UsageContextProvider>
      </UserContextProvider>
    </AppAlertProvider>
  );
}

const errorStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#FFFFFF' },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginBottom: 12 },
  message: { fontSize: 15, color: '#64748B', textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  retryBtn: { backgroundColor: '#4F46E5', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});

const gateStyles = StyleSheet.create({
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },
});

export default App;
