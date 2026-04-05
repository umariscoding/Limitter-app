import React from "react";
import { Linking, View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from "react-native";
import {
  NavigationContainer,
  createNavigationContainerRef,
} from "@react-navigation/native";
import MainNavigator from "./src/navigation/MainNavigator";
import { UserContextProvider, useUser } from "./src/context/UserContext";
import { UsageContextProvider } from "./src/context/UsageContext";
import { PolicyContextProvider } from "./src/context/PolicyContext";
import { onAuthStateChanged, bootstrap } from "./src/auth/firebaseAuthService";
import { startTimerRealtimeTracking, stopTimerRealtimeTracking } from "./src/services/timerRealtimeService";

const navigationRef = createNavigationContainerRef<any>();

type OverrideLinkPayload = {
  packageName: string;
  appName: string;
};

function AppInner(): React.JSX.Element {
  const { setFirebaseUser, setAccountData, setIsLoading, clearUser } = useUser();
  const [bootstrapError, setBootstrapError] = React.useState<string | null>(null);
  const [retrying, setRetrying] = React.useState(false);
  const pendingOverrideRef = React.useRef<OverrideLinkPayload | null>(null);

  const parseOverrideLink = React.useCallback(
    (url: string): OverrideLinkPayload | null => {
      try {
        const parsed = new URL(url);
        const packageName = parsed.searchParams.get("package") || "";
        const appName = parsed.searchParams.get("appName") || packageName;
        if (parsed.hostname?.toLowerCase() === "override" && packageName) {
          return { packageName, appName };
        }
      } catch (_) { /* silenced */ }

      const overrideMatch = url.match(/limitter:\/\/override\?(.*)$/i);
      if (!overrideMatch) return null;
      const params = new URLSearchParams(overrideMatch[1] || "");
      const packageName = params.get("package") || "";
      const appName = params.get("appName") || packageName;
      if (!packageName) return null;
      return { packageName, appName };
    },
    [],
  );

  const openOverrideFlow = React.useCallback((payload: OverrideLinkPayload) => {
    if (!navigationRef.isReady()) {
      pendingOverrideRef.current = payload;
      return;
    }
    navigationRef.navigate("SubscriptionPlansScreen", {
      fromBlockingOverride: true,
      packageName: payload.packageName,
      appName: payload.appName,
    });
  }, []);

  const loadAccount = React.useCallback(async () => {
    try {
      setBootstrapError(null);
      const accountData = await bootstrap();
      setAccountData(accountData);
    } catch (err: any) {
      setBootstrapError(err?.message || "Failed to load account. Check your connection.");
    }
  }, [setAccountData]);

  React.useEffect(() => {
    const unsubscribe = onAuthStateChanged(async (fbUser) => {
      if (fbUser && !fbUser.emailVerified) {
        setFirebaseUser(null);
        clearUser();
        setIsLoading(false);
        return;
      }
      setFirebaseUser(fbUser);
      if (fbUser) {
        await loadAccount();
      } else {
        clearUser();
        setBootstrapError(null);
      }
      setIsLoading(false);
    });
    return unsubscribe;
  }, [loadAccount]);

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
      } catch { /* silenced */ }
    };

    const sub = Linking.addEventListener("url", onDeepLink);
    Linking.getInitialURL().then((initialUrl) => {
      if (initialUrl) onDeepLink({ url: initialUrl });
    });

    return () => sub.remove();
  }, [openOverrideFlow, parseOverrideLink]);

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
            await loadAccount();
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
    <UserContextProvider>
      <UsageContextProvider>
        <PolicyContextProvider>
          <AppInner />
        </PolicyContextProvider>
      </UsageContextProvider>
    </UserContextProvider>
  );
}

const errorStyles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32, backgroundColor: '#FFFFFF' },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginBottom: 12 },
  message: { fontSize: 15, color: '#64748B', textAlign: 'center', marginBottom: 32, lineHeight: 22 },
  retryBtn: { backgroundColor: '#4F46E5', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  retryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16 },
});

export default App;
