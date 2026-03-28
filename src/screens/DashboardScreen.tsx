import React, { useState, useEffect } from 'react';
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
import {
  useNavigation,
  useFocusEffect,
  useRoute,
} from '@react-navigation/native';
import {
  Home,
  BarChart2,
  Settings as SettingsIcon,
  Smartphone,
  Plus as PlusIcon,
  AlertCircle,
  Clock,
  RefreshCw,
  Shield,
  Trash2,
} from 'lucide-react-native';
import { useUser } from '../context/UserContext';
import { createPolicyAPI, getPoliciesAPI, archivePolicyAPI } from '../services/policyService';
import { Toast } from '../../components';
import { getInstalledApps, InstalledApp } from '../native/appListService';
import {
  getWebsiteBlockerStatus,
  getNativeTimerStates,
  startAppBlockerService,
  startAppClockTimer,
  startAppUsageTimer,
  startWebsiteTimer,
  updateBlockedApps,
} from '../native/appBlockerService';
import { LimitterModule } from '../native/limitterNativeModules';
import { subscribeTimerTicks, subscribeTimerBlocked } from '../native/timerRealtimeService';
import { resolveCurrentDeviceId } from '../native/currentDeviceService';
import { requestRequiredPermissions } from '../native/permissionsService';
import {
  getPolicyPackageKey,
  formatUsageTime,
  formatLimitTime,
} from '../utils/policyMapper';
import {
  calculateTotalSecondsFromInputs,
  clockTargetTimestampMs,
  filterInstalledApps,
  formatTotalUsageFromLimits,
  hydratePoliciesForUi,
  toHour24,
} from '../helpers/helper';

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useUser();

  const [limits, setLimits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [deviceId, setDeviceId] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createAppName, setCreateAppName] = useState('');
  const [selectedInstalledApp, setSelectedInstalledApp] =
    useState<InstalledApp | null>(null);
  const [appSearch, setAppSearch] = useState('');
  const [createCategory, setCreateCategory] = useState('');
  const [createWebsiteUrl, setCreateWebsiteUrl] = useState('');
  const [installedAppsList, setInstalledAppsList] = useState<InstalledApp[]>(
    [],
  );
  const [loadingApps, setLoadingApps] = useState(false);
  const [targetType, setTargetType] = useState<'app' | 'category' | 'website'>(
    'app',
  );
  const [timerType, setTimerType] = useState<'combined' | 'single' | 'clock'>(
    'combined',
  );
  const [hours, setHours] = useState('');
  const [minutes, setMinutes] = useState('');
  const [seconds, setSeconds] = useState('');
  const [singleTimerValue, setSingleTimerValue] = useState('');
  const [singleTimerUnit, setSingleTimerUnit] = useState<
    'seconds' | 'minutes' | 'hours'
  >('minutes');
  const [clockHour, setClockHour] = useState('12');
  const [clockMinute, setClockMinute] = useState('00');
  const [clockPeriod, setClockPeriod] = useState<'AM' | 'PM'>('PM');
  const [websiteStatusLoading, setWebsiteStatusLoading] = useState(false);
  const [websiteStatus, setWebsiteStatus] = useState<{
    overlayEnabled: boolean;
    accessibilityEnabled: boolean;
    ready: boolean;
  } | null>(null);

  const matchesLimitPackage = React.useCallback(
    (item: any, packageName?: string) => {
      if (!packageName) return false;
      return (
        getPolicyPackageKey(item) === String(packageName).trim().toLowerCase()
      );
    },
    [],
  );

  // Request Android permissions on first mount
  useEffect(() => {
    requestRequiredPermissions().then((status) => {
      console.log('=== PERMISSION STATUS ===');
      console.log('Usage Access:', status.usage ? 'GRANTED' : 'DENIED');
      console.log('Overlay:', status.overlay ? 'GRANTED' : 'DENIED');
      console.log('Battery:', status.battery ? 'GRANTED' : 'DENIED');
      console.log('Accessibility:', status.accessibility ? 'GRANTED' : 'DENIED');
      console.log('=========================');
    });
  }, []);

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

  React.useEffect(() => {
    if (showCreateModal && installedAppsList.length === 0) {
      loadInstalledApps();
    }
  }, [showCreateModal]);

  const refreshWebsiteStatus = async () => {
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
  };

  React.useEffect(() => {
    if (showCreateModal && targetType === 'website') {
      void refreshWebsiteStatus();
    }
  }, [showCreateModal, targetType]);

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
  const filteredApps = React.useMemo(
    () => filterInstalledApps(installedAppsList, appSearch),
    [appSearch, installedAppsList],
  );

  const categories = [
    'Social Media',
    'Video Streaming',
    'Gaming',
    'Productivity',
    'Education',
  ];

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

    let policiesResult: any;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        policiesResult = await getPoliciesAPI();
        break;
      } catch (error: any) {
        const status = error?.response?.status;
        if (attempt === 0 && (status === 503 || status === 502)) {
          console.warn('⚠️ API returned', status, '— retrying in 2s...');
          await new Promise<void>(r => setTimeout(r, 2000));
          continue;
        }
        console.error('❌ Failed to fetch limits:', error);
        // Keep existing limits on transient errors instead of wiping them
        setLoading(false);
        setRefreshing(false);
        return;
      }
    }

    try {
      const reconciledLimits = await hydratePoliciesForUi(policiesResult);
      setLimits(reconciledLimits);
      console.log('✅ Fetched limits (sorted):', reconciledLimits);

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

      // Get currently running native timers so we don't restart them
      const activeTimers = await getNativeTimerStates();
      const activePackages = new Set(
        activeTimers
          .filter(t => (t.remainingSeconds || 0) > 0)
          .map(t => String(t.package || '').trim().toLowerCase()),
      );

      for (const limit of reconciledLimits) {
        if (limit.is_blocked) continue;
        if (limit.target_type !== 'app') continue;
        const pkg = limit.app_name || limit.package_name || limit.packageName;
        if (!pkg) continue;

        // Skip if native timer is already running for this package
        if (activePackages.has(String(pkg).trim().toLowerCase())) continue;

        const remainingSeconds = Math.max(
          0,
          (limit.max_time_minutes - (limit.time_used_minutes || 0)) * 60,
        );
        if (remainingSeconds <= 0) continue;
        try {
          await startAppUsageTimer(
            pkg,
            limit.target_label || pkg,
            remainingSeconds,
          );
        } catch (err) {
          console.warn(`Failed to start timer for ${pkg}:`, err);
        }
      }
    } catch (error) {
      console.error('❌ Failed to process limits:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const totalUsageText = React.useMemo(
    () => formatTotalUsageFromLimits(limits),
    [limits],
  );

  useFocusEffect(
    React.useCallback(() => {
      if (!deviceId) return;

      const overriddenPackage = route?.params?.justOverriddenPackage as
        | string
        | undefined;
      if (overriddenPackage) {
        setLimits(prev =>
          prev.map((item: any) =>
            matchesLimitPackage(item, overriddenPackage)
              ? { ...item, is_blocked: false }
              : item,
          ),
        );
      }

      setLoading(true);
      fetchLimits();
    }, [user?.uid, deviceId, route?.params?.refreshAt, matchesLimitPackage]),
  );

  // Real-time timer updates so the displayed time flows smoothly
  React.useEffect(() => {
    const unsubTick = subscribeTimerTicks(event => {
      if (!event?.package) return;

      setLimits(prev =>
        prev.map((item: any) => {
          if (!matchesLimitPackage(item, event.package)) return item;

          // Use native budget if available, otherwise fall back to API max
          const budgetSeconds = item._nativeBudgetSeconds || Number(item.max_time_minutes || 0) * 60;
          const remaining = Math.max(0, Number(event.remaining || 0));
          const consumedSeconds = Math.max(0, budgetSeconds - remaining);
          const eventBlocked =
            typeof event.isBlocked === 'boolean'
              ? event.isBlocked
              : String(event.status || '').toLowerCase() === 'blocked';

          return {
            ...item,
            time_used_minutes: consumedSeconds / 60,
            is_blocked: eventBlocked,
          };
        }),
      );
    });

    const unsubBlocked = subscribeTimerBlocked(event => {
      if (!event?.package) return;
      setLimits(prev =>
        prev.map((item: any) =>
          matchesLimitPackage(item, event.package)
            ? { ...item, is_blocked: true }
            : item,
        ),
      );
    });

    return () => {
      unsubTick();
      unsubBlocked();
    };
  }, [user?.uid, matchesLimitPackage]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLimits();
  };

  const calculateTotalSeconds = () =>
    calculateTotalSecondsFromInputs({
      timerType,
      hours,
      minutes,
      seconds,
      singleTimerValue,
      singleTimerUnit,
      clockHour,
      clockMinute,
      clockPeriod,
    });

  const handleCreateLimit = async () => {
    if (!user?.uid) {
      Alert.alert('Error', 'User not logged in');
      return;
    }

    if (!deviceId) {
      Alert.alert(
        'Error',
        'Device not ready yet. Please try again in a moment.',
      );
      return;
    }

    Alert.alert('DEBUG', 'handleCreateLimit called - code is updated!');

    const appName = createAppName.trim();
    const category = createCategory.trim();
    const websiteUrl = createWebsiteUrl.trim();
    const totalSeconds = calculateTotalSeconds();
    const parsedMinutes = Math.round(totalSeconds / 60) || 1;
    console.log('🕐 Create limit:', { totalSeconds, parsedMinutes, timerType, hours, minutes, seconds, singleTimerValue, singleTimerUnit });

    if (targetType === 'app') {
      if (!selectedInstalledApp || !appName) {
        Alert.alert(
          'Validation',
          'Please select an app from your installed apps list',
        );
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

    if (!Number.isFinite(totalSeconds) || totalSeconds < 60) {
      Alert.alert('Validation', 'Minimum limit is 1 minute (60 seconds)');
      return;
    }

    setLoading(true);
    try {
      const targetKey =
        targetType === 'app'
          ? appName
          : targetType === 'website'
          ? websiteUrl
          : category;
      const targetLabel =
        targetType === 'app'
          ? selectedInstalledApp?.appName || appName
          : targetType === 'website'
          ? websiteUrl
          : category;

      const response = await createPolicyAPI({
        type: targetType,
        targetKey,
        targetLabel,
        dailyLimitMinutes: parsedMinutes,
        scope: 'account',
      });
      console.log('Create policy result:', response);

      if (response) {
        if (targetType === 'app' && selectedInstalledApp) {
          console.log('DEBUG: Starting timer for', selectedInstalledApp.packageName, 'duration:', totalSeconds);
          const timerStartResult =
            timerType === 'clock'
              ? await startAppClockTimer(
                  selectedInstalledApp.packageName,
                  selectedInstalledApp.appName,
                  toHour24(clockHour, clockPeriod),
                  Math.max(0, Math.min(59, Number(clockMinute || '0'))),
                )
              : await startAppUsageTimer(
                  selectedInstalledApp.packageName,
                  selectedInstalledApp.appName,
                  totalSeconds,
                );

          Alert.alert('DEBUG Timer Result', JSON.stringify(timerStartResult));

          if (!timerStartResult.success) {
            Alert.alert(
              'Permission Required',
              'Enable Display over other apps and Usage access for Limitter. Open Settings → Apps → Special app access → Usage access, then turn on Limitter (package com.appguard2)—not under Accessibility.',
            );
          }
        }

        if (targetType === 'website') {
          const timerStartResult = await startWebsiteTimer({
            websiteUrl,
            durationSeconds: timerType === 'clock' ? undefined : totalSeconds,
            blockAtTimestampMs:
              timerType === 'clock'
                ? clockTargetTimestampMs(clockHour, clockMinute, clockPeriod)
                : undefined,
          });

          if (!timerStartResult.success) {
            Alert.alert(
              'Permission Required',
              'Enable Display over other apps and Limitter’s accessibility service (Settings → Accessibility → Downloaded apps) for website blocking.',
            );
          }
        }

        const label =
          targetType === 'app'
            ? appName
            : targetType === 'category'
            ? category
            : websiteUrl;
        setToastMessage(`Limit created for ${label}`);
        setShowToast(true);
        setShowCreateModal(false);
        setCreateAppName('');
        setSelectedInstalledApp(null);
        setCreateCategory('');
        setCreateWebsiteUrl('');
        setAppSearch('');
        setHours('');
        setMinutes('');
        setSeconds('');
        setSingleTimerValue('');
        setSingleTimerUnit('minutes');
        setClockHour('12');
        setClockMinute('00');
        setClockPeriod('PM');
        // Small delay to let the native service register the timer
        // before fetchLimits checks activeTimers
        await new Promise<void>(r => setTimeout(r, 1500));
        await fetchLimits();
      } else {
        Alert.alert('Error', 'Failed to create limit');
      }
    } catch (error: any) {
      console.error('Create policy error:', error);
      const msg = error?.message || 'Failed to create limit';
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleResetAll = () => {
    if (limits.length === 0) {
      Alert.alert('Nothing to reset', 'No limits found.');
      return;
    }
    Alert.alert(
      'Reset All Limits',
      'This will delete all limits and stop all timers. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset All',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              // Archive all policies on backend (skip any without a valid id)
              const archivePromises = limits
                .filter((l: any) => l.id)
                .map((l: any) => archivePolicyAPI(l.id).catch((e: any) =>
                  console.warn('Failed to archive policy', l.id, e?.message),
                ));
              await Promise.all(archivePromises);

              // Stop native tracking service & clear blocked apps
              try {
                if (LimitterModule?.sendCommand) {
                  await LimitterModule.sendCommand('STOP', {});
                }
              } catch (nativeErr) {
                console.warn('Native STOP command failed:', nativeErr);
              }
              updateBlockedApps([]);
              setLimits([]);
              setToastMessage('All limits removed');
              setShowToast(true);
            } catch (error: any) {
              Alert.alert('Error', error?.message || 'Failed to reset limits');
            } finally {
              setLoading(false);
            }
          },
        },
      ],
    );
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
                style={[
                  styles.selectorBtn,
                  targetType === 'app' && styles.selectorBtnActive,
                ]}
                onPress={() => setTargetType('app')}
              >
                <Text
                  style={[
                    styles.selectorBtnText,
                    targetType === 'app' && styles.selectorBtnTextActive,
                  ]}
                >
                  App
                </Text>
              </TouchableOpacity>
              {/* Category hidden for v1 — will be enabled later */}
              <TouchableOpacity
                style={[
                  styles.selectorBtn,
                  targetType === 'website' && styles.selectorBtnActive,
                ]}
                onPress={() => setTargetType('website')}
              >
                <Text
                  style={[
                    styles.selectorBtnText,
                    targetType === 'website' && styles.selectorBtnTextActive,
                  ]}
                >
                  Website
                </Text>
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
                <Text style={styles.availableAppsText}>
                  Showing {filteredApps.length} of {installedAppsList.length}{' '}
                  installed apps
                </Text>
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
                      <Text style={styles.suggestionSubtext}>
                        {app.packageName}
                      </Text>
                    </TouchableOpacity>
                  )}
                  ListHeaderComponent={
                    loadingApps ? (
                      <Text style={styles.loadingAppsText}>
                        Loading apps...
                      </Text>
                    ) : null
                  }
                  ListEmptyComponent={
                    !loadingApps ? (
                      <Text style={styles.emptyAppsText}>No apps found</Text>
                    ) : null
                  }
                />
              </>
            ) : targetType === 'category' ? (
              <View style={styles.categoryWrap}>
                {categories.map(cat => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryChip,
                      createCategory === cat && styles.categoryChipActive,
                    ]}
                    onPress={() => setCreateCategory(cat)}
                  >
                    <Text
                      style={[
                        styles.categoryChipText,
                        createCategory === cat && styles.categoryChipTextActive,
                      ]}
                    >
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
                    <Text style={styles.websiteStatusTitle}>
                      Website Service Status
                    </Text>
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
                        websiteStatus?.overlayEnabled
                          ? styles.websiteStatusOk
                          : styles.websiteStatusError,
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
                        websiteStatus?.accessibilityEnabled
                          ? styles.websiteStatusOk
                          : styles.websiteStatusError,
                      ]}
                    >
                      {websiteStatus?.accessibilityEnabled
                        ? 'Enabled'
                        : 'Missing'}
                    </Text>
                  </View>

                  <Text
                    style={[
                      styles.websiteReadyText,
                      websiteStatus?.ready
                        ? styles.websiteStatusOk
                        : styles.websiteStatusError,
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
                style={[
                  styles.selectorBtn,
                  timerType === 'combined' && styles.selectorBtnActive,
                ]}
                onPress={() => setTimerType('combined')}
              >
                <Text
                  style={[
                    styles.selectorBtnText,
                    timerType === 'combined' && styles.selectorBtnTextActive,
                  ]}
                >
                  H:M:S
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.selectorBtn,
                  timerType === 'single' && styles.selectorBtnActive,
                ]}
                onPress={() => setTimerType('single')}
              >
                <Text
                  style={[
                    styles.selectorBtnText,
                    timerType === 'single' && styles.selectorBtnTextActive,
                  ]}
                >
                  Single Unit
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.selectorBtn,
                  timerType === 'clock' && styles.selectorBtnActive,
                ]}
                onPress={() => setTimerType('clock')}
              >
                <Text
                  style={[
                    styles.selectorBtnText,
                    timerType === 'clock' && styles.selectorBtnTextActive,
                  ]}
                >
                  Exact Time
                </Text>
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
                      style={[
                        styles.selectorBtn,
                        singleTimerUnit === unit && styles.selectorBtnActive,
                      ]}
                      onPress={() => setSingleTimerUnit(unit)}
                    >
                      <Text
                        style={[
                          styles.selectorBtnText,
                          singleTimerUnit === unit &&
                            styles.selectorBtnTextActive,
                        ]}
                      >
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
                      style={[
                        styles.selectorBtn,
                        clockPeriod === period && styles.selectorBtnActive,
                      ]}
                      onPress={() => setClockPeriod(period)}
                    >
                      <Text
                        style={[
                          styles.selectorBtnText,
                          clockPeriod === period &&
                            styles.selectorBtnTextActive,
                        ]}
                      >
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
                  ? createAppName || 'No app selected'
                  : targetType === 'category'
                  ? createCategory || 'No category selected'
                  : createWebsiteUrl || 'No website selected'}
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
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* ===== HEADER ===== */}
        <View style={styles.header}>
          <View>
            <Text style={styles.logoText}>Limitter</Text>
            <Text style={styles.subtitle}>Welcome, {user?.name || 'User'}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TouchableOpacity
              style={styles.settingsBtn}
              onPress={handleResetAll}
            >
              <Trash2 size={22} color="#EF4444" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.settingsBtn}
              onPress={() => fetchLimits()}
            >
              <RefreshCw size={22} color="#4F46E5" />
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
            <Text style={styles.statValue}>
              {user?.plan?.toUpperCase() || 'FREE'}
            </Text>
          </TouchableOpacity>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Overrides</Text>
            <Text style={styles.statValue}>{user?.overrides_left || 0}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Usage</Text>
            <Text style={styles.statValue}>
              {loading ? 'Loading...' : totalUsageText}
            </Text>
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
              <TouchableOpacity
                style={styles.createBtn}
                onPress={() => setShowCreateModal(true)}
              >
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
                    <Text style={styles.limitName}>
                      {limit.target_label ||
                        limit.app_name ||
                        limit.category ||
                        'App'}
                    </Text>
                    <View style={styles.limitStats}>
                      <Text style={styles.limitStat}>
                        {formatUsageTime(limit.time_used_minutes || 0)} /{' '}
                        {formatLimitTime(limit.max_time_minutes)}
                      </Text>
                      <View
                        style={[
                          styles.statusBadge,
                          limit.is_blocked
                            ? styles.statusBlocked
                            : (limit.time_used_minutes || 0) > 0
                            ? styles.statusActive
                            : styles.statusTracking,
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusText,
                            limit.is_blocked
                              ? styles.statusBlockedText
                              : (limit.time_used_minutes || 0) > 0
                              ? styles.statusActiveText
                              : styles.statusTrackingText,
                          ]}
                        >
                          {limit.is_blocked
                            ? 'BLOCKED'
                            : (limit.time_used_minutes || 0) > 0
                            ? 'ACTIVE'
                            : 'TRACKING'}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.progressContainer}>
                    <View
                      style={[
                        styles.progressBar,
                        {
                          width: `${Math.min(
                            (limit.time_used_minutes / limit.max_time_minutes) *
                              100,
                            100,
                          )}%`,
                        },
                        limit.is_blocked && styles.progressBarBlocked,
                      ]}
                    />
                  </View>

                  <TouchableOpacity
                    onPress={() => {
                      if ((user?.overrides_left ?? 0) <= 0) {
                        navigation.navigate('SubscriptionPlansScreen', {
                          fromBlockingOverride: true,
                          packageName:
                            limit.app_name ||
                            limit.package_name ||
                            limit.packageName,
                          appName:
                            limit.app_name ||
                            limit.package_name ||
                            limit.packageName,
                        });
                        return;
                      }

                      navigation.navigate('ConfirmOverrideScreen', {
                        limitId: limit.id,
                        packageName:
                          limit.app_name ||
                          limit.package_name ||
                          limit.packageName,
                        appName:
                          limit.app_name ||
                          limit.package_name ||
                          limit.packageName,
                      });
                    }}
                    style={styles.overrideBtn}
                  >
                    <Text style={styles.overrideBtnText}>Use Override</Text>
                  </TouchableOpacity>
                </View>
              ))}
              {limits.length > 5 && (
                <TouchableOpacity
                  style={styles.moreItemsNote}
                  onPress={() => navigation.navigate('PoliciesScreen')}
                >
                  <Text style={styles.moreItemsText}>
                    +{limits.length - 5} more limit
                    {limits.length - 5 > 1 ? 's' : ''} • Tap to manage all
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          )}
        </View>

        {/* ===== QUICK ACTIONS ===== */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('PoliciesScreen')}
          >
            <Shield size={24} color="#10B981" />
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>My Limits</Text>
              <Text style={styles.actionDesc}>Edit or delete your limits</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('ActivityScreen')}
          >
            <BarChart2 size={24} color="#4F46E5" />
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>View Activity</Text>
              <Text style={styles.actionDesc}>See usage breakdown</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => navigation.navigate('AnalyticsScreen')}
          >
            <Clock size={24} color="#4F46E5" />
            <View style={styles.actionContent}>
              <Text style={styles.actionTitle}>7-Day Analytics</Text>
              <Text style={styles.actionDesc}>
                View Monday-Sunday usage graph
              </Text>
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
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('PoliciesScreen')}
        >
          <Shield size={22} color="#94A3B8" />
          <Text style={[styles.navLabel, styles.inactiveLabel]}>Limits</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('AnalyticsScreen')}
        >
          <BarChart2 size={22} color="#94A3B8" />
          <Text style={[styles.navLabel, styles.inactiveLabel]}>Analytics</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.navItem}
          onPress={() => navigation.navigate('SettingsScreen')}
        >
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
  header: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  logoText: { fontSize: 28, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
  settingsBtn: { padding: 8 },
  statsContainer: { flexDirection: 'row', padding: 20, gap: 12 },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
  },
  statLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 4,
  },
  section: { padding: 20 },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
  },
  emptyText: {
    marginTop: 12,
    color: '#64748B',
    fontSize: 14,
    fontWeight: '500',
  },
  createBtn: {
    marginTop: 16,
    backgroundColor: '#4F46E5',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  createBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  limitCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  limitInfo: { marginBottom: 12 },
  limitName: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  limitStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  limitStat: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  statusActive: { backgroundColor: '#DCFCE7' },
  statusTracking: { backgroundColor: '#F1F5F9' },
  statusBlocked: { backgroundColor: '#FEE2E2' },
  statusText: { fontSize: 11, fontWeight: '700' },
  statusActiveText: { color: '#166534' },
  statusTrackingText: { color: '#64748B' },
  statusBlockedText: { color: '#991B1B' },
  progressContainer: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBar: { height: '100%', backgroundColor: '#10B981', borderRadius: 4 },
  progressBarBlocked: { backgroundColor: '#EF4444' },
  overrideBtn: {
    backgroundColor: '#F59E0B',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  overrideBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  actionCard: {
    backgroundColor: '#FFFFFF',
    padding: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  actionContent: { marginLeft: 12, flex: 1 },
  actionTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  actionDesc: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    justifyContent: 'space-around',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  navItem: { alignItems: 'center', justifyContent: 'center' },
  navLabel: { fontSize: 11, fontWeight: '600', color: '#4F46E5', marginTop: 4 },
  inactiveLabel: { color: '#94A3B8' },
});

const Plus = PlusIcon;
