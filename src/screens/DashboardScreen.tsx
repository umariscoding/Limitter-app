import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
  StatusBar,
  ActivityIndicator,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import {
  Home,
  BarChart2,
  Settings as SettingsIcon,
  Smartphone,
  Plus as PlusIcon,
  AlertCircle,
  Clock,
  RefreshCw,
} from 'lucide-react-native';
import { useUser } from '../context/UserContext';
import { getLimitsAPI, createLimitAPI, updateUsageAPI } from '../services/limitService';
import { Toast } from '../../components';
import { getInstalledApps, InstalledApp } from '../services/appListService';
import {
  getNativeBlockedPackages,
  getWebsiteBlockerStatus,
  startAppBlockerService,
  startAppClockTimer,
  startAppUsageTimer,
  startWebsiteTimer,
  updateBlockedApps,
} from '../services/appBlockerService';
import {
  startTimerRealtimeTracking,
  subscribeTimerBlocked,
  subscribeTimerTicks,
} from '../services/timerRealtimeService';
import { resolveCurrentDeviceId } from '../services/currentDeviceService';
import { getLimitHistory, subscribeLimitHistory } from '../services/limitHistoryService';
import { addUsageToBuffer } from '../services/usageTrackingService';
import { useUsageContext } from '../context/UsageContext';

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useUser();
  const { totalUsage, isLoadingTotal, isRefreshing: isRefreshingUsage, refetchTotalUsage, refetchAllUsageData } = useUsageContext();

  const [limits, setLimits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [deviceId, setDeviceId] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createAppName, setCreateAppName] = useState('');
  const [selectedInstalledApp, setSelectedInstalledApp] = useState<InstalledApp | null>(null);
  const [appSearch, setAppSearch] = useState('');
  const [createCategory, setCreateCategory] = useState('');
  const [createWebsiteUrl, setCreateWebsiteUrl] = useState('');
  const [installedAppsList, setInstalledAppsList] = useState<InstalledApp[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [targetType, setTargetType] = useState<'app' | 'category' | 'website'>('app');
  const [timerType, setTimerType] = useState<'combined' | 'single' | 'clock'>('combined');
  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('30');
  const [seconds, setSeconds] = useState('0');
  const [singleTimerValue, setSingleTimerValue] = useState('30');
  const [singleTimerUnit, setSingleTimerUnit] = useState<'seconds' | 'minutes' | 'hours'>('minutes');
  const [clockHour, setClockHour] = useState('12');
  const [clockMinute, setClockMinute] = useState('00');
  const [clockPeriod, setClockPeriod] = useState<'AM' | 'PM'>('PM');
  const [websiteStatusLoading, setWebsiteStatusLoading] = useState(false);
  const [websiteStatus, setWebsiteStatus] = useState<{
    overlayEnabled: boolean;
    accessibilityEnabled: boolean;
    ready: boolean;
  } | null>(null);

  const getLimitPackageKey = React.useCallback((item: any) => {
    return String(item?.app_name || item?.package_name || item?.packageName || '')
      .trim()
      .toLowerCase();
  }, []);

  const matchesLimitPackage = React.useCallback(
    (item: any, packageName?: string) => {
      if (!packageName) return false;
      return getLimitPackageKey(item) === String(packageName).trim().toLowerCase();
    },
    [getLimitPackageKey]
  );

  const resolveBlockedState = React.useCallback((item: any) => {
    if (typeof item?.is_blocked === 'boolean') return item.is_blocked;

    const rawStatus = String(item?.status_text || item?.status || '')
      .trim()
      .toLowerCase();
    if (rawStatus.includes('block')) return true;
    if (rawStatus.includes('active') || rawStatus.includes('running') || rawStatus.includes('unblocked')) {
      return false;
    }

    const blockedUntil = Number(item?.blocked_until_timestamp || 0);
    if (blockedUntil > Date.now()) return true;

    const maxMinutes = Number(item?.max_time_minutes || 0);
    const usedMinutes = Number(item?.time_used_minutes || 0);
    return maxMinutes > 0 && usedMinutes >= maxMinutes;
  }, []);

  const normalizeLimit = React.useCallback(
    (item: any) => ({
      ...item,
      is_blocked: resolveBlockedState(item),
    }),
    [resolveBlockedState]
  );

  React.useEffect(() => {
    startTimerRealtimeTracking();

    // Track last recorded usage minutes per app to avoid duplicate recording
    const lastRecordedMinutes = new Map<string, number>();

    const unsubscribeTick = subscribeTimerTicks(event => {
      if (!event?.package) return;

      setLimits(prev =>
        prev.map((item: any) => {
          if (!matchesLimitPackage(item, event.package)) return item;

          const maxMinutes = Number(item.max_time_minutes || 0);
          const consumedSeconds = Math.max(0, maxMinutes * 60 - Number(event.remaining || 0));
          const newUsedMinutes = Math.floor(consumedSeconds / 60);
          const eventBlocked =
            typeof event.isBlocked === 'boolean'
              ? event.isBlocked
              : String(event.status || '').toLowerCase() === 'blocked';

          // Record usage to backend buffer if minutes changed
          const appKey = String(event.package).trim().toLowerCase();
          const lastRecorded = lastRecordedMinutes.get(appKey) || 0;
          if (newUsedMinutes > lastRecorded && user?.uid && deviceId) {
            const minutesToAdd = newUsedMinutes - lastRecorded;
            // Extract category from limit item or use default
            const categoryId = item.category_id || 'general';
            const appName = item.app_name || String(event.package);
            console.log(`[UsageTracking] Recording ${minutesToAdd}min for ${appName}`);
            addUsageToBuffer(user.uid, deviceId, appName, categoryId, minutesToAdd).catch(err =>
              console.error('[UsageTracking] Buffer error:', err)
            );
            lastRecordedMinutes.set(appKey, newUsedMinutes);
          }

          return {
            ...item,
            time_used_minutes: newUsedMinutes,
            is_blocked: eventBlocked,
          };
        })
      );
    });

    const unsubscribeBlocked = subscribeTimerBlocked(event => {
      if (!event?.package) return;
      setLimits(prev =>
        prev.map((item: any) =>
          matchesLimitPackage(item, event.package) ? { ...item, is_blocked: true } : item
        )
      );
    });

    return () => {
      unsubscribeTick();
      unsubscribeBlocked();
    };
  }, [matchesLimitPackage, user?.uid, deviceId]);

  React.useEffect(() => {
    const unsubscribe = subscribeLimitHistory(() => {
      if (!user?.uid || !deviceId) return;

      // Pull latest state from backend and optimistically reflect override state immediately.
      fetchLimits();

      getLimitHistory().then(history => {
        const latest = history[0];
        if (!latest?.packageName) return;

        if (latest.type === 'override') {
          setLimits(prev =>
            prev.map((item: any) =>
              matchesLimitPackage(item, latest.packageName) ? { ...item, is_blocked: false } : item
            )
          );
          return;
        }

        if (latest.type === 'blocked') {
          setLimits(prev =>
            prev.map((item: any) =>
              matchesLimitPackage(item, latest.packageName) ? { ...item, is_blocked: true } : item
            )
          );
        }
      });
    });

    return () => unsubscribe();
  }, [user?.uid, deviceId, matchesLimitPackage]);

  React.useEffect(() => {
    const loadCurrentDevice = async () => {
      if (!user?.uid) return;

      const resolvedId = await resolveCurrentDeviceId(user.uid);
      if (resolvedId) {
        setDeviceId(resolvedId);
      }
    };

    loadCurrentDevice();
  }, [user?.uid]);

  // ✅ Load installed apps when modal opens
  React.useEffect(() => {
    if (showCreateModal && installedAppsList.length === 0) {
      loadInstalledApps();
    }
  }, [showCreateModal]);

  const refreshWebsiteStatus = React.useCallback(async () => {
    setWebsiteStatusLoading(true);
    try {
      const status = await getWebsiteBlockerStatus();
      setWebsiteStatus({
        overlayEnabled: status.overlayEnabled,
        accessibilityEnabled: status.accessibilityEnabled,
        ready: status.ready,
      });
    } finally {
      setWebsiteStatusLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (showCreateModal && targetType === 'website') {
      void refreshWebsiteStatus();
    }
  }, [showCreateModal, targetType, refreshWebsiteStatus]);

  const loadInstalledApps = async () => {
    setLoadingApps(true);
    try {
      const apps = await getInstalledApps();
      setInstalledAppsList(apps);
      console.log('✅ Loaded', apps.length, 'installed apps');
    } catch (error) {
      console.error('❌ Failed to load apps:', error);
      setInstalledAppsList([]);
    } finally {
      setLoadingApps(false);
    }
  };

  // ✅ Search apps as user types
  const filteredApps = React.useMemo(() => {
    if (!appSearch) return installedAppsList.slice(0, 30);
    return installedAppsList
      .filter(
        app =>
          app.appName.toLowerCase().includes(appSearch.toLowerCase()) ||
          app.packageName.toLowerCase().includes(appSearch.toLowerCase())
      )
      .slice(0, 30);
  }, [appSearch, installedAppsList]);

  const categories = ['Social Media', 'Video Streaming', 'Gaming', 'Productivity', 'Education'];

  // ✅ Fetch limits from backend
  const fetchLimits = async () => {
    if (!user?.uid) {
      console.log('⚠️ No user UID available');
      setLoading(false);
      return;
    }

    if (!deviceId) {
      console.log('⚠️ No resolved device id available yet');
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const response = await getLimitsAPI(user.uid, deviceId);

      if (response.success || response.data) {
        const limitsData = Array.isArray(response.data) ? response.data : [response.data];

        // ✅ Sort limits - latest first (by creation date)
        const sortedLimits = limitsData
          .filter((l: any) => l && l.id)
          .sort(
            (a: any, b: any) =>
              new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
          );

        const normalizedLimits = sortedLimits.map(normalizeLimit);
        const history = await getLimitHistory();

        const latestHistoryByPackage = new Map<string, { type: 'blocked' | 'override'; timestamp: number }>();
        history.forEach(entry => {
          const key = String(entry.packageName || '').trim().toLowerCase();
          if (!key) return;

          const current = latestHistoryByPackage.get(key);
          if (!current || Number(entry.timestamp || 0) > current.timestamp) {
            latestHistoryByPackage.set(key, {
              type: entry.type,
              timestamp: Number(entry.timestamp || 0),
            });
          }
        });

        const nativeBlockedPackages = await getNativeBlockedPackages();

        const reconciledLimits = normalizedLimits.map((item: any) => {
          const key = getLimitPackageKey(item);
          const latest = latestHistoryByPackage.get(key);

          if (nativeBlockedPackages.has(key)) {
            return { ...item, is_blocked: true };
          }

          if (!latest) return item;

          if (latest.type === 'blocked') {
            return { ...item, is_blocked: true };
          }
          if (latest.type === 'override') {
            return { ...item, is_blocked: false };
          }
          return item;
        });
        setLimits(reconciledLimits);
        console.log('✅ Fetched limits (sorted):', sortedLimits);

        // ✅ Start AppBlocker with current blocked apps
        const blockedAppsList = reconciledLimits
          .filter((l: any) => l.is_blocked && l.app_name)
          .map((l: any) => ({
            package_name: l.app_name || l.package_name || l.packageName,
            app_name: l.app_name || l.package_name || l.packageName,
            blocked_until_timestamp: l.blocked_until_timestamp,
          }));

        if (blockedAppsList.length > 0) {
          await startAppBlockerService(blockedAppsList);
        }
        updateBlockedApps(blockedAppsList);

        // ✅ Refetch usage data from centralized context
        await refetchAllUsageData();
      }
    } catch (error) {
      console.error('❌ Failed to fetch limits:', error);
      setLimits([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ✅ Total usage from View Activity data (sum of all apps)
  const formatTotalUsageFromActivity = React.useCallback(() => {
    const totalMinutes = limits.reduce((sum: number, item: any) => {
      return sum + Math.max(0, Number(item?.time_used_minutes ?? item?.used_minutes ?? 0));
    }, 0);

    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    const formatted = `${hours}h ${mins}m`;

    console.log('📊 [Dashboard] Total usage from activity limits:', {
      totalMinutes,
      appsCount: limits.length,
      formatted,
    });

    return formatted;
  }, [limits]);

  // ✅ Load data on screen focus
  useFocusEffect(
    React.useCallback(() => {
      if (!deviceId) return;

      const overriddenPackage = route?.params?.justOverriddenPackage as string | undefined;
      if (overriddenPackage) {
        setLimits(prev =>
          prev.map((item: any) =>
            matchesLimitPackage(item, overriddenPackage) ? { ...item, is_blocked: false } : item
          )
        );
      }

      setLoading(true);
      fetchLimits();
    }, [user?.uid, deviceId, route?.params?.refreshAt, matchesLimitPackage])
  );

  // Note: Total usage is now managed by UsageContext with automatic polling

  const onRefresh = () => {
    setRefreshing(true);
    fetchLimits();
  };

  const calculateTotalSeconds = () => {
    if (timerType === 'clock') {
      const hour12 = Math.max(1, Math.min(12, Number(clockHour || '12')));
      const minute = Math.max(0, Math.min(59, Number(clockMinute || '0')));
      let hour24 = hour12 % 12;
      if (clockPeriod === 'PM') {
        hour24 += 12;
      }

      const now = new Date();
      const target = new Date(now);
      target.setHours(hour24, minute, 0, 0);
      if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 1);
      }

      return Math.ceil((target.getTime() - now.getTime()) / 1000);
    }

    if (timerType === 'combined') {
      const h = Number(hours || '0');
      const m = Number(minutes || '0');
      const s = Number(seconds || '0');
      return h * 3600 + m * 60 + s;
    }

    const val = Number(singleTimerValue || '0');
    if (singleTimerUnit === 'hours') {
      return val * 3600;
    }
    if (singleTimerUnit === 'minutes') {
      return val * 60;
    }
    return val;
  };

  const handleCreateLimit = async () => {
    if (!user?.uid) {
      Alert.alert('Error', 'User not logged in');
      return;
    }

    if (!deviceId) {
      Alert.alert('Error', 'Device not ready yet. Please try again in a moment.');
      return;
    }

    const appName = createAppName.trim();
    const category = createCategory.trim();
    const websiteUrl = createWebsiteUrl.trim();
    const totalSeconds = calculateTotalSeconds();
    const parsedMinutes = Math.ceil(totalSeconds / 60);

    if (targetType === 'app') {
      if (!selectedInstalledApp || !appName) {
        Alert.alert('Validation', 'Please select an app from your installed apps list');
        return;
      }
    } else if (targetType === 'category') {
      if (!category) {
        Alert.alert('Validation', 'Category is required');
        return;
      }
    } else {
      if (!websiteUrl) {
        Alert.alert('Validation', 'Website URL is required');
        return;
      }
    }

    if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
      Alert.alert('Validation', 'Timer must be greater than 0 seconds');
      return;
    }

    setLoading(true);
    try {
      const response = await createLimitAPI(
        user.uid,
        deviceId,
        parsedMinutes,
        targetType === 'app' ? appName : targetType === 'website' ? websiteUrl : null,
        targetType === 'category' ? category : targetType === 'website' ? 'Website' : null
      );
      console.log('Create limit result:', response);

      if (response?.success) {
        if (targetType === 'app' && selectedInstalledApp) {
          const timerStartResult = timerType === 'clock'
            ? await startAppClockTimer(
                selectedInstalledApp.packageName,
                selectedInstalledApp.appName,
                (() => {
                  const hour12 = Math.max(1, Math.min(12, Number(clockHour || '12')));
                  let hour24 = hour12 % 12;
                  if (clockPeriod === 'PM') {
                    hour24 += 12;
                  }
                  return hour24;
                })(),
                Math.max(0, Math.min(59, Number(clockMinute || '0')))
              )
            : await startAppUsageTimer(
                selectedInstalledApp.packageName,
                selectedInstalledApp.appName,
                totalSeconds
              );

          if (!timerStartResult.success) {
            Alert.alert(
              'Permission Required',
              'Please grant Overlay and Usage Access permissions for app blocking to work.'
            );
          }
        }

        if (targetType === 'website') {
          const timerStartResult = await startWebsiteTimer({
            websiteUrl,
            durationSeconds: timerType === 'clock' ? undefined : totalSeconds,
            blockAtTimestampMs:
              timerType === 'clock'
                ? (() => {
                    const hour12 = Math.max(1, Math.min(12, Number(clockHour || '12')));
                    const minute = Math.max(0, Math.min(59, Number(clockMinute || '0')));
                    let hour24 = hour12 % 12;
                    if (clockPeriod === 'PM') {
                      hour24 += 12;
                    }

                    const now = new Date();
                    const target = new Date(now);
                    target.setHours(hour24, minute, 0, 0);
                    if (target.getTime() <= now.getTime()) {
                      target.setDate(target.getDate() + 1);
                    }
                    return target.getTime();
                  })()
                : undefined,
          });

          if (!timerStartResult.success) {
            Alert.alert(
              'Permission Required',
              'Please grant Overlay and Accessibility permissions for website blocking to work.'
            );
          }
        }

        const label = targetType === 'app' ? appName : targetType === 'category' ? category : websiteUrl;
        setToastMessage(`Limit created for ${label}`);
        setShowToast(true);
        setShowCreateModal(false);
        setCreateAppName('');
        setSelectedInstalledApp(null);
        setCreateCategory('');
        setCreateWebsiteUrl('');
        setAppSearch('');
        setHours('0');
        setMinutes('30');
        setSeconds('0');
        setSingleTimerValue('30');
        setSingleTimerUnit('minutes');
        setClockHour('12');
        setClockMinute('00');
        setClockPeriod('PM');
        await fetchLimits();
      } else {
        Alert.alert('Error', response?.message || 'Failed to create limit');
      }
    } catch (error) {
      console.error('Create limit error:', error);
      Alert.alert('Error', 'Failed to create limit');
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateUsage = async (limitId: string) => {
    setLoading(true);
    try {
      const response = await updateUsageAPI(limitId, 5);
      console.log('Update usage result:', response);

      if (response?.success) {
        setToastMessage('Added 5 minutes usage');
        setShowToast(true);
        await fetchLimits();
      } else {
        Alert.alert('Error', response?.message || 'Failed to update usage');
      }
    } catch (error) {
      console.error('Update usage error:', error);
      Alert.alert('Error', 'Failed to update usage');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Loading your limits...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Toast
        visible={showToast}
        message={toastMessage}
        onHide={() => setShowToast(false)}
        type="success"
      />

      <Modal
        visible={showCreateModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Create Limit</Text>
            <Text style={styles.modalSubTitle}>Target Type</Text>
            <View style={styles.selectorRow}>
              <TouchableOpacity
                style={[styles.selectorBtn, targetType === 'app' && styles.selectorBtnActive]}
                onPress={() => setTargetType('app')}
              >
                <Text style={[styles.selectorBtnText, targetType === 'app' && styles.selectorBtnTextActive]}>App</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.selectorBtn, targetType === 'category' && styles.selectorBtnActive]}
                onPress={() => setTargetType('category')}
              >
                <Text style={[styles.selectorBtnText, targetType === 'category' && styles.selectorBtnTextActive]}>Category</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.selectorBtn, targetType === 'website' && styles.selectorBtnActive]}
                onPress={() => setTargetType('website')}
              >
                <Text style={[styles.selectorBtnText, targetType === 'website' && styles.selectorBtnTextActive]}>Website</Text>
              </TouchableOpacity>
            </View>

            {targetType === 'app' ? (
              <>
                <TextInput
                  value={appSearch}
                  onChangeText={text => {
                    setAppSearch(text);
                    setCreateAppName('');
                    setSelectedInstalledApp(null);
                  }}
                  placeholder="Search app (e.g. instagram)"
                  style={styles.modalInput}
                  placeholderTextColor="#94A3B8"
                />
                <Text style={styles.availableAppsText}>Showing {filteredApps.length} of {installedAppsList.length} installed apps</Text>
                <FlatList
                  data={filteredApps}
                  keyExtractor={item => item.packageName}
                  style={styles.suggestionList}
                  nestedScrollEnabled
                  renderItem={({ item: app }) => (
                    <TouchableOpacity
                      style={styles.suggestionItem}
                      onPress={() => {
                        setCreateAppName(app.packageName);
                        setAppSearch(app.appName);
                        setSelectedInstalledApp(app);
                      }}
                    >
                      <Text style={styles.suggestionText}>{app.appName}</Text>
                      <Text style={styles.suggestionSubtext}>{app.packageName}</Text>
                    </TouchableOpacity>
                  )}
                  ListHeaderComponent={loadingApps ? <Text style={styles.loadingAppsText}>Loading apps...</Text> : null}
                  ListEmptyComponent={
                    !loadingApps ? <Text style={styles.emptyAppsText}>No apps found</Text> : null
                  }
                />
              </>
            ) : targetType === 'category' ? (
              <View style={styles.categoryWrap}>
                {categories.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryChip, createCategory === cat && styles.categoryChipActive]}
                    onPress={() => setCreateCategory(cat)}
                  >
                    <Text style={[styles.categoryChipText, createCategory === cat && styles.categoryChipTextActive]}>
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <>
                <TextInput
                  value={createWebsiteUrl}
                  onChangeText={setCreateWebsiteUrl}
                  placeholder="Website URL (e.g. youtube.com)"
                  style={styles.modalInput}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholderTextColor="#94A3B8"
                />

                <View style={styles.websiteStatusCard}>
                  <View style={styles.websiteStatusHeader}>
                    <Text style={styles.websiteStatusTitle}>Website Service Status</Text>
                    <TouchableOpacity
                      style={styles.websiteStatusRefreshBtn}
                      onPress={() => {
                        void refreshWebsiteStatus();
                      }}
                      disabled={websiteStatusLoading}
                    >
                      <Text style={styles.websiteStatusRefreshText}>
                        {websiteStatusLoading ? 'Checking...' : 'Refresh'}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.websiteStatusRow}>
                    <Text style={styles.websiteStatusLabel}>Overlay</Text>
                    <Text
                      style={[
                        styles.websiteStatusValue,
                        websiteStatus?.overlayEnabled ? styles.websiteStatusOk : styles.websiteStatusError,
                      ]}
                    >
                      {websiteStatus?.overlayEnabled ? 'Enabled' : 'Missing'}
                    </Text>
                  </View>

                  <View style={styles.websiteStatusRow}>
                    <Text style={styles.websiteStatusLabel}>Accessibility</Text>
                    <Text
                      style={[
                        styles.websiteStatusValue,
                        websiteStatus?.accessibilityEnabled ? styles.websiteStatusOk : styles.websiteStatusError,
                      ]}
                    >
                      {websiteStatus?.accessibilityEnabled ? 'Enabled' : 'Missing'}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.websiteReadyText,
                      websiteStatus?.ready ? styles.websiteStatusOk : styles.websiteStatusError,
                    ]}
                  >
                    {websiteStatus?.ready
                      ? 'Website tracking is ready.'
                      : 'Enable missing permissions before creating website limits.'}
                  </Text>
                </View>
              </>
            )}

            <Text style={styles.modalSubTitle}>Timer Type</Text>
            <View style={styles.selectorRow}>
              <TouchableOpacity
                style={[styles.selectorBtn, timerType === 'combined' && styles.selectorBtnActive]}
                onPress={() => setTimerType('combined')}
              >
                <Text style={[styles.selectorBtnText, timerType === 'combined' && styles.selectorBtnTextActive]}>H:M:S</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.selectorBtn, timerType === 'single' && styles.selectorBtnActive]}
                onPress={() => setTimerType('single')}
              >
                <Text style={[styles.selectorBtnText, timerType === 'single' && styles.selectorBtnTextActive]}>Single Unit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.selectorBtn, timerType === 'clock' && styles.selectorBtnActive]}
                onPress={() => setTimerType('clock')}
              >
                <Text style={[styles.selectorBtnText, timerType === 'clock' && styles.selectorBtnTextActive]}>Exact Time</Text>
              </TouchableOpacity>
            </View>

            {timerType === 'combined' ? (
              <View style={styles.timeRow}>
                <View style={styles.timeBox}>
                  <Text style={styles.timeLabel}>H</Text>
                  <TextInput
                    value={hours}
                    onChangeText={setHours}
                    keyboardType="number-pad"
                    style={styles.timeInput}
                  />
                </View>
                <View style={styles.timeBox}>
                  <Text style={styles.timeLabel}>M</Text>
                  <TextInput
                    value={minutes}
                    onChangeText={setMinutes}
                    keyboardType="number-pad"
                    style={styles.timeInput}
                  />
                </View>
                <View style={styles.timeBox}>
                  <Text style={styles.timeLabel}>S</Text>
                  <TextInput
                    value={seconds}
                    onChangeText={setSeconds}
                    keyboardType="number-pad"
                    style={styles.timeInput}
                  />
                </View>
              </View>
            ) : timerType === 'single' ? (
              <>
                <TextInput
                  value={singleTimerValue}
                  onChangeText={setSingleTimerValue}
                  placeholder="Enter timer value"
                  keyboardType="number-pad"
                  style={styles.modalInput}
                  placeholderTextColor="#94A3B8"
                />
                <View style={styles.selectorRow}>
                  {(['seconds', 'minutes', 'hours'] as const).map(unit => (
                    <TouchableOpacity
                      key={unit}
                      style={[styles.selectorBtn, singleTimerUnit === unit && styles.selectorBtnActive]}
                      onPress={() => setSingleTimerUnit(unit)}
                    >
                      <Text style={[styles.selectorBtnText, singleTimerUnit === unit && styles.selectorBtnTextActive]}>
                        {unit}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : (
              <>
                <View style={styles.timeRow}>
                  <View style={styles.timeBox}>
                    <Text style={styles.timeLabel}>HH</Text>
                    <TextInput
                      value={clockHour}
                      onChangeText={setClockHour}
                      keyboardType="number-pad"
                      style={styles.timeInput}
                    />
                  </View>
                  <View style={styles.timeBox}>
                    <Text style={styles.timeLabel}>MM</Text>
                    <TextInput
                      value={clockMinute}
                      onChangeText={setClockMinute}
                      keyboardType="number-pad"
                      style={styles.timeInput}
                    />
                  </View>
                </View>
                <View style={styles.selectorRow}>
                  {(['AM', 'PM'] as const).map(period => (
                    <TouchableOpacity
                      key={period}
                      style={[styles.selectorBtn, clockPeriod === period && styles.selectorBtnActive]}
                      onPress={() => setClockPeriod(period)}
                    >
                      <Text style={[styles.selectorBtnText, clockPeriod === period && styles.selectorBtnTextActive]}>
                        {period}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            <View style={styles.readonlyTargetBox}>
              <Text style={styles.readonlyTargetText}>
                {targetType === 'app'
                  ? (createAppName || 'No app selected')
                  : targetType === 'category'
                    ? (createCategory || 'No category selected')
                    : (createWebsiteUrl || 'No website selected')}
              </Text>
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancel]}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCreate]}
                onPress={handleCreateLimit}
              >
                <Text style={styles.modalCreateText}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* ===== HEADER ===== */}
        <View style={styles.header}>
          <View>
            <Text style={styles.logoText}>Limitter</Text>
            <Text style={styles.subtitle}>Welcome, {user?.name || 'User'}</Text>
          </View>
           <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
             <TouchableOpacity
               style={[styles.settingsBtn, isRefreshingUsage && { opacity: 0.6 }]}
               onPress={async () => {
                 await refetchAllUsageData(true);
               }}
               disabled={isRefreshingUsage}
             >
               <RefreshCw
                 size={22}
                 color="#4F46E5"
                 style={isRefreshingUsage ? { transform: [{ rotate: '180deg' }] } : undefined}
               />
             </TouchableOpacity>
             <TouchableOpacity
               style={styles.settingsBtn}
               onPress={() => navigation.navigate('SettingsScreen')}
             >
               <SettingsIcon size={24} color="#4F46E5" />
             </TouchableOpacity>
           </View>
        </View>

        {/* ===== USER STATS ===== */}
        <View style={styles.statsContainer}>
          <TouchableOpacity
            style={styles.statCard}
            activeOpacity={0.8}
            onPress={() => navigation.navigate('SubscriptionPlansScreen')}
          >
            <Text style={styles.statLabel}>Plan</Text>
            <Text style={styles.statValue}>{user?.plan?.toUpperCase() || 'FREE'}</Text>
          </TouchableOpacity>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Overrides</Text>
            <Text style={styles.statValue}>{user?.overrides_left || 0}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Usage</Text>
            <Text style={styles.statValue}>{loading ? 'Loading...' : formatTotalUsageFromActivity()}</Text>
          </View>
        </View>

        {/* ===== LIMITS SECTION ===== */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Limits</Text>
            <TouchableOpacity onPress={() => setShowCreateModal(true)}>
              <PlusIcon size={20} color="#4F46E5" />
            </TouchableOpacity>
          </View>

          {limits.length === 0 ? (
            <View style={styles.emptyState}>
              <AlertCircle size={48} color="#94A3B8" />
              <Text style={styles.emptyText}>No limits yet</Text>
              <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreateModal(true)}>
                <Text style={styles.createBtnText}>Create First Limit</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              style={styles.limitsScrollWrap}
              contentContainerStyle={styles.limitsScrollContent}
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
              {limits.slice(0, 5).map((limit: any) => (
                <View key={limit.id} style={styles.limitCard}>
                  <View style={styles.limitInfo}>
                    <Text style={styles.limitName}>{limit.app_name || limit.category || 'App'}</Text>
                    <View style={styles.limitStats}>
                      <Text style={styles.limitStat}>
                        {limit.time_used_minutes || 0} / {limit.max_time_minutes} min
                      </Text>
                      <View
                        style={[
                          styles.statusBadge,
                          limit.is_blocked ? styles.statusBlocked : styles.statusActive,
                        ]}
                      >
                        <Text style={[styles.statusText, limit.is_blocked ? styles.statusBlockedText : styles.statusActiveText]}>
                          {limit.is_blocked ? 'BLOCKED' : 'ACTIVE'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.progressContainer}>
                    <View
                      style={[
                        styles.progressBar,
                        { width: `${Math.min((limit.time_used_minutes / limit.max_time_minutes) * 100, 100)}%` },
                        limit.is_blocked && styles.progressBarBlocked,
                      ]}
                    />
                  </View>

                  <TouchableOpacity
                    onPress={() => {
                      if ((user?.overrides_left ?? 0) <= 0) {
                        navigation.navigate('SubscriptionPlansScreen', {
                          fromBlockingOverride: true,
                          packageName: limit.app_name || limit.package_name || limit.packageName,
                          appName: limit.app_name || limit.package_name || limit.packageName,
                        });
                        return;
                      }

                      navigation.navigate('ConfirmOverrideScreen', {
                        limitId: limit.id,
                        packageName: limit.app_name || limit.package_name || limit.packageName,
                        appName: limit.app_name || limit.package_name || limit.packageName,
                      });
                    }}
                    style={styles.overrideBtn}
                  >
                    <Text style={styles.overrideBtnText}>Use Override</Text>
                  </TouchableOpacity>

                  {__DEV__ && (
                    <TouchableOpacity
                      onPress={() => handleSimulateUsage(limit.id)}
                      style={styles.simulateBtn}
                    >
                      <Text style={styles.simulateBtnText}>Simulate +5 min</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              {limits.length > 5 && (
                <View style={styles.moreItemsNote}>
                  <Text style={styles.moreItemsText}>
                    +{limits.length - 5} more limit{limits.length - 5 > 1 ? 's' : ''} • View Activity to see all
                  </Text>
                </View>
              )}
            </ScrollView>
          )}
        </View>

        {/* ===== QUICK ACTIONS ===== */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('ActivityScreen')}>
            <BarChart2 size={24} color="#4F46E5" />
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>View Activity</Text>
              <Text style={styles.actionDesc}>See usage breakdown</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => navigation.navigate('AnalyticsScreen')}>
            <Clock size={24} color="#4F46E5" />
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>7-Day Analytics</Text>
              <Text style={styles.actionDesc}>View Monday-Sunday usage graph</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('ControlPlansScreen')}
          >
            <Smartphone size={24} color="#4F46E5" />
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Manage Devices</Text>
              <Text style={styles.actionDesc}>Configure your devices</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('SubscriptionPlansScreen')}
          >
            <PlusIcon size={24} color="#4F46E5" />
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>Upgrade Plan</Text>
              <Text style={styles.actionDesc}>Get more overrides</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ===== BOTTOM NAV ===== */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Home size={22} color="#4F46E5" />
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('AnalyticsScreen')}>
          <BarChart2 size={22} color="#94A3B8" />
          <Text style={[styles.navLabel, styles.inactiveLabel]}>Analytics</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('SettingsScreen')}>
          <SettingsIcon size={22} color="#94A3B8" />
          <Text style={[styles.navLabel, styles.inactiveLabel]}>Settings</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 12,
  },
  modalSubTitle: {
    color: '#334155',
    fontWeight: '700',
    marginBottom: 8,
    marginTop: 4,
  },
  selectorRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  selectorBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingVertical: 9,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  selectorBtnActive: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  selectorBtnText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 12,
  },
  selectorBtnTextActive: {
    color: '#3730A3',
  },
  suggestionList: {
    maxHeight: 240,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  suggestionItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  suggestionText: {
    color: '#0F172A',
    fontSize: 12,
  },
  availableAppsText: {
    color: '#64748B',
    fontSize: 11,
    marginBottom: 6,
  },
  suggestionSubtext: {
    color: '#94A3B8',
    fontSize: 11,
    marginTop: 2,
  },
  loadingAppsText: {
    color: '#64748B',
    fontSize: 13,
    textAlign: 'center',
    padding: 12,
    fontWeight: '600',
  },
  emptyAppsText: {
    color: '#94A3B8',
    fontSize: 12,
    textAlign: 'center',
    paddingVertical: 12,
  },
  categoryWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  categoryChip: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#F8FAFC',
  },
  categoryChipActive: {
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
  },
  categoryChipText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: '#3730A3',
  },
  timeRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  timeBox: {
    flex: 1,
  },
  timeLabel: {
    color: '#64748B',
    fontSize: 11,
    marginBottom: 4,
    fontWeight: '700',
  },
  timeInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 14,
    color: '#0F172A',
    marginBottom: 10,
    backgroundColor: '#F8FAFC',
  },
  websiteStatusCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    backgroundColor: '#FFFFFF',
  },
  websiteStatusHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  websiteStatusTitle: {
    color: '#0F172A',
    fontSize: 12,
    fontWeight: '700',
  },
  websiteStatusRefreshBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
  },
  websiteStatusRefreshText: {
    color: '#3730A3',
    fontWeight: '700',
    fontSize: 11,
  },
  websiteStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  websiteStatusLabel: {
    color: '#64748B',
    fontSize: 12,
  },
  websiteStatusValue: {
    fontSize: 12,
    fontWeight: '700',
  },
  websiteStatusOk: {
    color: '#166534',
  },
  websiteStatusError: {
    color: '#B91C1C',
  },
  websiteReadyText: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '600',
  },
  readonlyTargetBox: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 10,
    backgroundColor: '#F1F5F9',
  },
  readonlyTargetText: {
    color: '#0F172A',
    fontSize: 13,
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  modalButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginLeft: 8,
  },
  modalCancel: {
    backgroundColor: '#E2E8F0',
  },
  modalCreate: {
    backgroundColor: '#4F46E5',
  },
  modalCancelText: {
    color: '#334155',
    fontWeight: '700',
  },
  modalCreateText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  centerContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 12, color: '#64748B', fontSize: 14 },
  scrollContent: { paddingBottom: 100 },
  header: { backgroundColor: '#FFFFFF', padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  logoText: { fontSize: 28, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
  settingsBtn: { padding: 8 },
  statsContainer: { flexDirection: 'row', padding: 20, gap: 12 },
  statCard: { flex: 1, backgroundColor: '#FFFFFF', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center' },
  statLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  statValue: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginTop: 4 },
  section: { padding: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  limitsScrollWrap: {
    maxHeight: 320,
  },
  limitsScrollContent: {
    paddingRight: 6,
  },
  moreItemsNote: {
    backgroundColor: '#EEF2FF',
    borderLeftWidth: 4,
    borderLeftColor: '#4F46E5',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  moreItemsText: {
    color: '#3730A3',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: { alignItems: 'center', paddingVertical: 40, backgroundColor: '#FFFFFF', borderRadius: 12 },
  emptyText: { marginTop: 12, color: '#64748B', fontSize: 14, fontWeight: '500' },
  createBtn: { marginTop: 16, backgroundColor: '#4F46E5', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  createBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  limitCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  limitInfo: { marginBottom: 12 },
  limitName: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  limitStats: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  limitStat: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusActive: { backgroundColor: '#DCFCE7' },
  statusBlocked: { backgroundColor: '#FEE2E2' },
  statusText: { fontSize: 11, fontWeight: '700' },
  statusActiveText: { color: '#166534' },
  statusBlockedText: { color: '#991B1B' },
  progressContainer: { height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden', marginBottom: 12 },
  progressBar: { height: '100%', backgroundColor: '#10B981', borderRadius: 4 },
  progressBarBlocked: { backgroundColor: '#EF4444' },
  overrideBtn: { backgroundColor: '#F59E0B', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  overrideBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  simulateBtn: { backgroundColor: '#0EA5E9', paddingVertical: 10, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  simulateBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  actionCard: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  actionContent: { marginLeft: 12, flex: 1 },
  actionTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  actionDesc: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  bottomNav: { flexDirection: 'row', backgroundColor: '#FFFFFF', paddingVertical: 12, paddingHorizontal: 24, borderTopWidth: 1, borderTopColor: '#E2E8F0', justifyContent: 'space-around', position: 'absolute', bottom: 0, left: 0, right: 0 },
  navItem: { alignItems: 'center', justifyContent: 'center' },
  navLabel: { fontSize: 11, fontWeight: '600', color: '#4F46E5', marginTop: 4 },
  inactiveLabel: { color: '#94A3B8' },
});

const Plus = PlusIcon;
