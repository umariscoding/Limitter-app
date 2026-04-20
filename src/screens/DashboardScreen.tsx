import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  Plus as PlusIcon,
  AlertCircle,
  Shield,
  BarChart2,
  Clock,
  Smartphone,
  Zap,
  ChevronRight,
  RefreshCcw,
} from 'lucide-react-native';
import { preloadInstalledApps } from '../services/appListService';
import NoOverridesModal from '../components/NoOverridesModal';
import { useUser } from '../context/UserContext';
import { refreshBootstrap } from '../services/bootstrapService';
import { usePolicyContext } from '../context/PolicyContext';
import { usePolicyFetcher } from '../hooks/usePolicyFetcher';
import { useNativeTimerSync } from '../hooks/useNativeTimerSync';
import { useDeviceResolver } from '../hooks/useDeviceResolver';
import { useCreateLimit } from '../hooks/useCreateLimit';
import { useUsageReporter } from '../hooks/useUsageReporter';
import { updateBlockedApps } from '../services/appBlockerService';
import { formatTotalUsageFromLimits } from '../helpers/helper';
import { getPlanLimits, canCreatePolicy, invalidatePlanCache, type PlanLimits } from '../services/planGuardService';
import { useLockStateSync } from '../hooks/useLockStateSync';
import { requestRequiredPermissions } from '../services/permissionsService';
import { getPolicyPackageKey } from '../utils/policyMapper';
import { Toast } from '../../components';
import CreateLimitModal from '../components/CreateLimitModal';
import PolicyCard from '../components/PolicyCard';
import BottomNav from '../components/BottomNav';
import type { CreateLimitState } from '../hooks/useCreateLimit';
import { showAlert } from '../components/AppAlert';

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user, setAccountData } = useUser();
  const { policies: limits, isLoading: loading, setPolicies: setLimits, setIsLoading: setLoading } = usePolicyContext();
  const { fetchPolicies } = usePolicyFetcher();
  const { deviceId } = useDeviceResolver(user?.uid);

  const [refreshing, setRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [planLimits, setPlanLimits] = useState<PlanLimits | null>(null);
  const [visibleCount, setVisibleCount] = useState(10);
  const justOverriddenPackageRef = React.useRef<string | null>(null);
  const fetchInProgressRef = React.useRef(false);
  //new 
  const [noOverridesModal, setNoOverridesModal] = useState<{
    visible: boolean;
    appName: string;
  }>({ visible: false, appName: '' });
  //new 
  const matchesLimitPackage = React.useRef(
    (item: any, packageName?: string) => {
      if (!packageName) return false;
      return getPolicyPackageKey(item) === String(packageName).trim().toLowerCase();
    },
  ).current;

  const { createLimit } = useCreateLimit(
    user?.uid,
    deviceId,
    (label) => {
      setToastMessage(`Limit created for ${label}`);
      setShowToast(true);
      setShowCreateModal(false);
    },
    setLoading,
  );

  useEffect(() => { requestRequiredPermissions(); }, []);

  useNativeTimerSync(setLimits);
  useUsageReporter(limits, deviceId, user?.accountId);
  useLockStateSync(user?.accountId);
  const fetchLimits = async () => {
    if (!user?.uid || !deviceId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    if (fetchInProgressRef.current) return;
    fetchInProgressRef.current = true;

    try {
      const overriddenPkg = justOverriddenPackageRef.current;
      if (overriddenPkg) justOverriddenPackageRef.current = null;

      await fetchPolicies(
        overriddenPkg ? { overriddenPackage: overriddenPkg, matchesLimitPackage } : undefined,
      );

      getPlanLimits(true).then(data => setPlanLimits(data)).catch(() => { });
    } finally {
      fetchInProgressRef.current = false;
      setRefreshing(false);
    }
  };

  const totalUsageText = React.useMemo(() => formatTotalUsageFromLimits(limits), [limits]);

  const existingTargetKeys = React.useMemo(() => {
    const keys = new Set<string>();
    for (const l of limits) {
      const key = getPolicyPackageKey(l);
      if (key) keys.add(key);
    }
    return keys;
  }, [limits]);

  const blockedCount = limits.filter(l => l.is_blocked).length;

  const focusHandlerRef = React.useRef(() => { });
  focusHandlerRef.current = () => {
    if (!deviceId) return;
    const overriddenPackage = route?.params?.justOverriddenPackage as string | undefined;
    if (overriddenPackage) justOverriddenPackageRef.current = overriddenPackage;
    fetchLimits();
  };
  useEffect(() => {
    preloadInstalledApps();
  }, []);
  const lastFetchRef = useRef(0);

  useEffect(() => {
    if (!deviceId) return;

    const now = Date.now();
    if (now - lastFetchRef.current < 2000) return;

    lastFetchRef.current = now;
    focusHandlerRef.current();
    // No onReconnect auto-refresh and no network-triggered refetch — the user wants
    // the dashboard to only refresh via explicit actions (manual button, pull-to-refresh,
    // override completion, limit creation). Spontaneous refreshes were flipping the
    // blocked/active state unpredictably when stale backend data arrived.
  }, [deviceId, route?.params?.refreshAt]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const data = await refreshBootstrap();
      setAccountData(data);
    } catch {}
    fetchLimits();
  };

  const handleOpenCreateModal = () => {
    setShowCreateModal(true); // 🚀 instant open

    canCreatePolicy().then(check => {
      setPlanLimits(check.limits);

      if (!check.allowed) {
        setShowCreateModal(false);
        showAlert('Plan Limit Reached', check.reason || 'Upgrade required', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Upgrade', onPress: () => navigation.navigate('SubscriptionPlansScreen') },
        ]);
      }
    });
  };

  const handleCreateSubmit = async (state: CreateLimitState) => {
    const success = await createLimit(state);
    if (success) {
      invalidatePlanCache();
      await fetchLimits();
    }
  };

  const handleOverride = (limit: any) => {
    const pkg = limit.app_name || limit.package_name || limit.packageName;
    const appName = limit.target_label || pkg;
    const targetType = limit.target_type || 'app';

    if ((user?.overrides_left ?? 0) <= 0) {
      // Show the popup asking "Buy Override or Buy Plan?"
      setNoOverridesModal({ visible: true, appName });
      return;
    }

    navigation.navigate('ConfirmOverrideScreen', {
      limitId: limit.id,
      packageName: pkg,
      appName,
      targetType,
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#059669" />
      <Toast visible={showToast} message={toastMessage} onHide={() => setShowToast(false)} type="success" />
      <NoOverridesModal
        visible={noOverridesModal.visible}
        appName={noOverridesModal.appName}
        onBuyOverride={() => {
          setNoOverridesModal({ visible: false, appName: '' });
          navigation.navigate('BuyOverrides');
        }}
        onBuyPlan={() => {
          setNoOverridesModal({ visible: false, appName: '' });
          navigation.navigate('SubscriptionPlansScreen');
        }}
        onCancel={() => setNoOverridesModal({ visible: false, appName: '' })}
      />
      <CreateLimitModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateSubmit}
        existingTargetKeys={existingTargetKeys}
        planLimits={planLimits}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FFFFFF" />}
      >
        <LinearGradient colors={['#10B981', '#059669', '#0F172A']} style={styles.headerGradient}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.greeting}>Welcome back,</Text>
              <Text style={styles.userName}>{user?.name || 'User'}</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <TouchableOpacity style={styles.statCard} activeOpacity={0.85} onPress={() => navigation.navigate('SubscriptionPlansScreen')}>
              <View style={styles.statIconWrap}>
                <Zap size={16} color="#F59E0B" />
              </View>
              <Text style={styles.statValue}>{user?.plan?.toUpperCase() || 'FREE'}</Text>
              <Text style={styles.statLabel}>Plan</Text>
            </TouchableOpacity>

            <View style={styles.statCard}>
              <View style={styles.statIconWrap}>
                <Shield size={16} color="#10B981" />
              </View>
              <Text style={styles.statValue}>{limits.length}</Text>
              <Text style={styles.statLabel}>Limits</Text>
            </View>

            <View style={styles.statCard}>
              <View style={styles.statIconWrap}>
                <Clock size={16} color="#10B981" />
              </View>
              <Text style={styles.statValue}>{totalUsageText}</Text>
              <Text style={styles.statLabel}>Usage</Text>
            </View>
          </View>

          {blockedCount > 0 && (
            <View style={styles.alertBanner}>
              <AlertCircle size={16} color="#FEF2F2" />
              <Text style={styles.alertText}>{blockedCount} app{blockedCount > 1 ? 's' : ''} blocked</Text>
            </View>
          )}
        </LinearGradient>

        <View style={styles.body}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Limits</Text>
            <View style={styles.sectionActions}>
              <TouchableOpacity
                style={styles.refreshBtn}
                onPress={onRefresh}
                activeOpacity={0.8}
                disabled={refreshing}
              >
                {refreshing ? (
                  <ActivityIndicator size={16} color="#FFFFFF" />
                ) : (
                  <RefreshCcw size={16} color="#FFFFFF" />
                )}
              </TouchableOpacity>
              <TouchableOpacity style={styles.addBtn} onPress={handleOpenCreateModal} activeOpacity={0.8}>
                <PlusIcon size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>

          {loading && !refreshing ? (
            <View style={styles.inlineLoader}>
              <ActivityIndicator size="small" color="#10B981" />
              <Text style={styles.inlineLoaderText}>Loading limits...</Text>
            </View>
          ) : limits.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIconWrap}>
                <Shield size={40} color="#CBD5E1" />
              </View>
              <Text style={styles.emptyTitle}>No limits yet</Text>
              <Text style={styles.emptyDesc}>Create your first limit to start tracking app usage</Text>
              <TouchableOpacity onPress={handleOpenCreateModal} activeOpacity={0.8}>
                <LinearGradient colors={['#10B981', '#059669']} style={styles.emptyBtn}>
                  <PlusIcon size={16} color="#FFFFFF" />
                  <Text style={styles.emptyBtnText}>Create First Limit</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              style={limits.length > 2 ? styles.limitsScroll : undefined}
              nestedScrollEnabled
              showsVerticalScrollIndicator={limits.length > 2}
            >
              {limits.slice(0, visibleCount).map((limit: any) => (
                <PolicyCard key={limit.id} limit={limit} onOverride={handleOverride} />
              ))}
              {limits.length > visibleCount && (
                <TouchableOpacity
                  style={styles.loadMoreBtn}
                  onPress={() => setVisibleCount(prev => prev + 10)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.loadMoreText}>
                    Load More ({limits.length - visibleCount} remaining)
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          )}

          <Text style={[styles.sectionTitle, { marginTop: 28, marginBottom: 12 }]}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            {[
              { icon: <Shield size={22} color="#10B981" />, title: 'My Limits', bg: '#F0FDF4', screen: 'PoliciesScreen' },
              { icon: <BarChart2 size={22} color="#6366F1" />, title: 'Analytics', bg: '#EEF2FF', screen: 'AnalyticsScreen' },
              { icon: <Smartphone size={22} color="#059669" />, title: 'Devices', bg: '#F0F9FF', screen: 'ControlPlansScreen' },
              { icon: <Zap size={22} color="#F59E0B" />, title: 'Upgrade', bg: '#FFFBEB', screen: 'SubscriptionPlansScreen' },
            ].map(action => (
              <TouchableOpacity key={action.screen} style={[styles.actionTile, { backgroundColor: action.bg }]} onPress={() => navigation.navigate(action.screen)} activeOpacity={0.8}>
                {action.icon}
                <Text style={styles.actionTileText}>{action.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>

      <BottomNav active="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  inlineLoader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 32, backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E8ECF4' },
  inlineLoaderText: { color: '#64748B', fontSize: 14, fontWeight: '500' },
  scrollContent: { paddingBottom: 100 },

  headerGradient: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 24 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  greeting: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  userName: { fontSize: 24, fontWeight: '800', color: '#FFFFFF', marginTop: 2 },

  statsRow: { flexDirection: 'row', gap: 10 },
  statCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  statIconWrap: { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  statValue: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  statLabel: { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '600', marginTop: 2 },

  alertBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(239,68,68,0.2)', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginTop: 16 },
  alertText: { fontSize: 13, color: '#FEF2F2', fontWeight: '600' },

  body: { padding: 20, marginTop: -12, borderTopLeftRadius: 20, borderTopRightRadius: 20, backgroundColor: '#F1F5F9' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  sectionActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  refreshBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8, elevation: 4 },
  addBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center', shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },

  emptyState: { alignItems: 'center', paddingVertical: 40, backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#E8ECF4' },
  emptyIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#334155', marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: '#94A3B8', textAlign: 'center', paddingHorizontal: 40, marginBottom: 20 },
  emptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  emptyBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  limitsScroll: { maxHeight: 380 },
  loadMoreBtn: { alignItems: 'center', backgroundColor: '#F0FDF4', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#BBF7D0', marginTop: 8 },
  loadMoreText: { color: '#059669', fontSize: 13, fontWeight: '700' },

  actionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  actionTile: { width: '48%' as any, padding: 16, borderRadius: 16, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: 'rgba(0,0,0,0.04)' },
  actionTileText: { fontSize: 13, fontWeight: '700', color: '#334155' },
});
