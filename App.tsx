import React from 'react';
import { Linking } from 'react-native';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import MainNavigator from './src/navigation/MainNavigator';
import { UserContextProvider } from './src/context/UserContext';
import { UsageContextProvider } from './src/context/UsageContext';
import { startTimerRealtimeTracking } from './src/services/timerRealtimeService';
import { startUsageSync, stopUsageSync } from './src/services/usageTrackingService';

const navigationRef = createNavigationContainerRef<any>();

type OverrideLinkPayload = {
  packageName: string;
  appName: string;
};

function App(): React.JSX.Element {
  const pendingOverrideRef = React.useRef<OverrideLinkPayload | null>(null);

  const parseOverrideLink = React.useCallback((url: string): OverrideLinkPayload | null => {
    try {
      const parsed = new URL(url);
      const packageName = parsed.searchParams.get('package') || '';
      const appName = parsed.searchParams.get('appName') || packageName;

      if (parsed.hostname === 'override' && packageName) {
        return { packageName, appName };
      }
    } catch (_) {
      // Fallback for environments where URL parsing can fail intermittently.
    }

    const overrideMatch = url.match(/appguard2:\/\/override\?(.*)$/i);
    if (!overrideMatch) return null;

    const query = overrideMatch[1] || '';
    const params = new URLSearchParams(query);
    const packageName = params.get('package') || '';
    const appName = params.get('appName') || packageName;
    if (!packageName) return null;

    return { packageName, appName };
  }, []);

  const openOverrideFlow = React.useCallback((payload: OverrideLinkPayload) => {
    if (!navigationRef.isReady()) {
      pendingOverrideRef.current = payload;
      return;
    }

    navigationRef.navigate('SubscriptionPlansScreen', {
      fromBlockingOverride: true,
      packageName: payload.packageName,
      appName: payload.appName,
    });
  }, []);

  React.useEffect(() => {
    startTimerRealtimeTracking();
    startUsageSync();

    const onDeepLink = ({ url }: { url: string }) => {
      try {
        const payload = parseOverrideLink(url);
        if (payload) {
          openOverrideFlow(payload);
        }
      } catch (error) {
        console.error('Deep link parse failed:', error);
      }
    };

    const sub = Linking.addEventListener('url', onDeepLink);

    Linking.getInitialURL().then(initialUrl => {
      if (initialUrl) {
        onDeepLink({ url: initialUrl });
      }
    });

    return () => {
      sub.remove();
      stopUsageSync();
    };
  }, [openOverrideFlow, parseOverrideLink]);

  return (
    <UserContextProvider>
      <UsageContextProvider>
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
      </UsageContextProvider>
    </UserContextProvider>
  );
}

export default App;
