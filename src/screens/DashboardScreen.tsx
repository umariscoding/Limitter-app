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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import {
  Home,
  BarChart2,
  Settings as SettingsIcon,
  Smartphone,
  Plus as PlusIcon,
  AlertCircle,
} from 'lucide-react-native';
import { useUser } from '../context/UserContext';
import { getLimitsAPI, createLimitAPI, updateUsageAPI } from '../services/limitService';
import { Toast } from '../../components';
import { getInstalledApps, searchApps, InstalledApp } from '../services/appListService';
import { startAppBlockerService, updateBlockedApps } from '../services/appBlockerService';

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const { user } = useUser();

  const [limits, setLimits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [totalUsageToday, setTotalUsageToday] = useState('0h 0m');
  const [deviceId] = useState('device_001');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createAppName, setCreateAppName] = useState('');
  const [appSearch, setAppSearch] = useState('');
  const [createCategory, setCreateCategory] = useState('');
  const [installedAppsList, setInstalledAppsList] = useState<InstalledApp[]>([]);
  const [loadingApps, setLoadingApps] = useState(false);
  const [targetType, setTargetType] = useState<'app' | 'category'>('app');
  const [timerType, setTimerType] = useState<'combined' | 'single'>('combined');
  const [hours, setHours] = useState('0');
  const [minutes, setMinutes] = useState('30');
  const [seconds, setSeconds] = useState('0');
  const [singleTimerValue, setSingleTimerValue] = useState('30');
  const [singleTimerUnit, setSingleTimerUnit] = useState<'seconds' | 'minutes' | 'hours'>('minutes');

  // ✅ Load installed apps when modal opens
  React.useEffect(() => {
    if (showCreateModal && installedAppsList.length === 0) {
      loadInstalledApps();
    }
  }, [showCreateModal]);

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
    if (!appSearch) return installedAppsList.slice(0, 8);
    return installedAppsList
      .filter(
        app =>
          app.appName.toLowerCase().includes(appSearch.toLowerCase()) ||
          app.packageName.toLowerCase().includes(appSearch.toLowerCase())
      )
      .slice(0, 8);
  }, [appSearch, installedAppsList]);

  const categories = ['Social Media', 'Video Streaming', 'Gaming', 'Productivity', 'Education'];

  // ✅ Fetch limits from backend
  const fetchLimits = async () => {
    if (!user?.uid) {
      console.log('⚠️ No user UID available');
      setLoading(false);
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

        setLimits(sortedLimits);
        console.log('✅ Fetched limits (sorted):', sortedLimits);

        // ✅ Start AppBlocker with current blocked apps
        const blockedAppsList = sortedLimits
          .filter((l: any) => l.is_blocked && l.app_name)
          .map((l: any) => ({
            package_name: l.app_name, // backend returns app_name as package
            app_name: l.app_name,
            blocked_until_timestamp: l.blocked_until_timestamp,
          }));

        if (blockedAppsList.length > 0) {
          await startAppBlockerService(blockedAppsList);
        }
        updateBlockedApps(blockedAppsList);

        // Calculate total usage
        const totalUsed = sortedLimits.reduce((sum: number, l: any) => sum + (l.time_used_minutes || 0), 0);
        const hours = Math.floor(totalUsed / 60);
        const minutes = totalUsed % 60;
        setTotalUsageToday(`${hours}h ${minutes}m`);
      }
    } catch (error) {
      console.error('❌ Failed to fetch limits:', error);
      setLimits([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // ✅ Load data on screen focus
  useFocusEffect(
    React.useCallback(() => {
      setLoading(true);
      fetchLimits();
    }, [user?.uid])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchLimits();
  };

  const calculateTotalSeconds = () => {
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

    const appName = createAppName.trim();
    const category = createCategory.trim();
    const totalSeconds = calculateTotalSeconds();
    const parsedMinutes = Math.ceil(totalSeconds / 60);

    if (targetType === 'app') {
      if (!appName) {
        Alert.alert('Validation', 'App name is required');
        return;
      }
    } else {
      if (!category) {
        Alert.alert('Validation', 'Category is required');
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
        targetType === 'app' ? appName : null,
        targetType === 'category' ? category : null
      );
      console.log('Create limit result:', response);

      if (response?.success) {
        const label = targetType === 'app' ? appName : category;
        setToastMessage(`Limit created for ${label}`);
        setShowToast(true);
        setShowCreateModal(false);
        setCreateAppName('');
        setCreateCategory('');
        setAppSearch('');
        setHours('0');
        setMinutes('30');
        setSeconds('0');
        setSingleTimerValue('30');
        setSingleTimerUnit('minutes');
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
            </View>

            {targetType === 'app' ? (
              <>
                <TextInput
                  value={appSearch}
                  onChangeText={text => {
                    setAppSearch(text);
                    setCreateAppName(text);
                  }}
                  placeholder="Search app (e.g. instagram)"
                  style={styles.modalInput}
                  placeholderTextColor="#94A3B8"
                />
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
            ) : (
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
            ) : (
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
            )}

            <View style={styles.readonlyTargetBox}>
              <Text style={styles.readonlyTargetText}>
                {targetType === 'app'
                  ? (createAppName || 'No app selected')
                  : (createCategory || 'No category selected')}
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
          <TouchableOpacity
            style={styles.settingsBtn}
            onPress={() => navigation.navigate('SettingsScreen')}
          >
            <SettingsIcon size={24} color="#4F46E5" />
          </TouchableOpacity>
        </View>

        {/* ===== USER STATS ===== */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Plan</Text>
            <Text style={styles.statValue}>{user?.plan?.toUpperCase() || 'FREE'}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Overrides</Text>
            <Text style={styles.statValue}>{user?.overrides_left || 0}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Usage</Text>
            <Text style={styles.statValue}>{totalUsageToday}</Text>
          </View>
        </View>

        {/* ===== LIMITS SECTION ===== */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Limits</Text>
            <TouchableOpacity onPress={() => setShowCreateModal(true)}>
              <Plus size={20} color="#4F46E5" />
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
                    onPress={() =>
                      navigation.navigate('ConfirmOverrideScreen', { limitId: limit.id })
                    }
                    style={styles.overrideBtn}
                  >
                    <Text style={styles.overrideBtnText}>Use Override</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => handleSimulateUsage(limit.id)}
                    style={styles.simulateBtn}
                  >
                    <Text style={styles.simulateBtnText}>Simulate +5 min</Text>
                  </TouchableOpacity>
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
    maxHeight: 140,
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
