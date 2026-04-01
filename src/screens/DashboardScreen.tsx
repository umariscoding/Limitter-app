import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  StatusBar,
  ActivityIndicator,
  Alert,
  RefreshControl,
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
  Shield,
  Trash2,
} from 'lucide-react-native';
import { useUser } from '../context/UserContext';
import { usePolicyContext } from '../context/PolicyContext';
import { usePolicyFetcher } from '../hooks/usePolicyFetcher';
import { useNativeTimerSync } from '../hooks/useNativeTimerSync';
import { useDeviceResolver } from '../hooks/useDeviceResolver';
import { useCreateLimit } from '../hooks/useCreateLimit';
import { hardDeleteAllPoliciesAPI } from '../services/policyService';
import { updateBlockedApps } from '../native/appBlockerService';
import { LimitterModule } from '../native/limitterNativeModules';
import { requestRequiredPermissions } from '../native/permissionsService';
import { getPolicyPackageKey, formatUsageTime, formatLimitTime } from '../utils/policyMapper';
import { formatTotalUsageFromLimits } from '../helpers/helper';
import { Toast } from '../../components';
import CreateLimitModal from '../components/CreateLimitModal';
import PolicyCard from '../components/PolicyCard';
import type { CreateLimitState } from '../hooks/useCreateLimit';

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user } = useUser();
  const { policies: limits, isLoading: loading, setPolicies: setLimits, setIsLoading: setLoading } = usePolicyContext();
  const { fetchPolicies } = usePolicyFetcher();
  const { deviceId } = useDeviceResolver(user?.uid);

  const [refreshing, setRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const justOverriddenPackageRef = React.useRef<string | null>(null);

  const matchesLimitPackage = React.useCallback(
    (item: any, packageName?: string) => {
      if (!packageName) return false;
      return getPolicyPackageKey(item) === String(packageName).trim().toLowerCase();
    },
    [],
  );

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

  useEffect(() => {
    requestRequiredPermissions();
  }, []);

  useNativeTimerSync(setLimits);

  const fetchLimits = async () => {
    if (!user?.uid || !deviceId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const overriddenPkg = justOverriddenPackageRef.current;
    if (overriddenPkg) {
      justOverriddenPackageRef.current = null;
    }

    await fetchPolicies(
      overriddenPkg
        ? { overriddenPackage: overriddenPkg, matchesLimitPackage }
        : undefined,
    );
    setRefreshing(false);
  };

  const totalUsageText = React.useMemo(
    () => formatTotalUsageFromLimits(limits),
    [limits],
  );

  useFocusEffect(
    React.useCallback(() => {
      if (!deviceId) return;
      const overriddenPackage = route?.params?.justOverriddenPackage as string | undefined;
      if (overriddenPackage) {
        justOverriddenPackageRef.current = overriddenPackage;
      }
      setLoading(true);
      fetchLimits();
    }, [user?.uid, deviceId, route?.params?.refreshAt, matchesLimitPackage]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchLimits();
  };

  const handleCreateSubmit = async (state: CreateLimitState) => {
    const success = await createLimit(state);
    if (success) {
      await new Promise<void>(r => setTimeout(r, 1500));
      await fetchLimits();
    }
  };

  const handleOverride = (limit: any) => {
    const pkg = limit.app_name || limit.package_name || limit.packageName;
    if ((user?.overrides_left ?? 0) <= 0) {
      navigation.navigate('SubscriptionPlansScreen', {
        fromBlockingOverride: true,
        packageName: pkg,
        appName: pkg,
      });
      return;
    }
    navigation.navigate('ConfirmOverrideScreen', {
      limitId: limit.id,
      packageName: pkg,
      appName: pkg,
    });
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
              await hardDeleteAllPoliciesAPI();
              try {
                if (LimitterModule?.sendCommand) {
                  await LimitterModule.sendCommand('STOP', {});
                }
              } catch {}
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
      <Toast visible={showToast} message={toastMessage} onHide={() => setShowToast(false)} type="success" />

      <CreateLimitModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateSubmit}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.logoText}>Limitter</Text>
            <Text style={styles.subtitle}>Welcome, {user?.name || 'User'}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <TouchableOpacity style={styles.settingsBtn} onPress={handleResetAll}>
              <Trash2 size={22} color="#EF4444" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsBtn} onPress={() => fetchLimits()}>
              <RefreshCw size={22} color="#4F46E5" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.settingsBtn} onPress={() => navigation.navigate('SettingsScreen')}>
              <SettingsIcon size={24} color="#4F46E5" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.statsContainer}>
          <TouchableOpacity style={styles.statCard} activeOpacity={0.8} onPress={() => navigation.navigate('SubscriptionPlansScreen')}>
            <Text style={styles.statLabel}>Plan</Text>
            <Text style={styles.statValue}>{user?.plan?.toUpperCase() || 'FREE'}</Text>
          </TouchableOpacity>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Overrides</Text>
            <Text style={styles.statValue}>{user?.overrides_left || 0}</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>Total Usage</Text>
            <Text style={styles.statValue}>{loading ? 'Loading...' : totalUsageText}</Text>
          </View>
        </View>

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
            <ScrollView style={styles.limitsScrollWrap} contentContainerStyle={styles.limitsScrollContent} nestedScrollEnabled showsVerticalScrollIndicator>
              {limits.slice(0, 5).map((limit: any) => (
                <PolicyCard key={limit.id} limit={limit} onOverride={handleOverride} />
              ))}
              {limits.length > 5 && (
                <TouchableOpacity style={styles.moreItemsNote} onPress={() => navigation.navigate('PoliciesScreen')}>
                  <Text style={styles.moreItemsText}>
                    +{limits.length - 5} more limit{limits.length - 5 > 1 ? 's' : ''} · Tap to manage all
                  </Text>
                </TouchableOpacity>
              )}
            </ScrollView>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          {[
            { icon: <Shield size={24} color="#10B981" />, title: 'My Limits', desc: 'Edit or delete your limits', screen: 'PoliciesScreen' },
            { icon: <BarChart2 size={24} color="#4F46E5" />, title: 'View Activity', desc: 'See usage breakdown', screen: 'ActivityScreen' },
            { icon: <Clock size={24} color="#4F46E5" />, title: '7-Day Analytics', desc: 'View Monday-Sunday usage graph', screen: 'AnalyticsScreen' },
            { icon: <Smartphone size={24} color="#4F46E5" />, title: 'Manage Devices', desc: 'Configure your devices', screen: 'ControlPlansScreen' },
            { icon: <PlusIcon size={24} color="#4F46E5" />, title: 'Upgrade Plan', desc: 'Get more overrides', screen: 'SubscriptionPlansScreen' },
          ].map(action => (
            <TouchableOpacity key={action.screen} style={styles.actionCard} onPress={() => navigation.navigate(action.screen)}>
              {action.icon}
              <View style={styles.actionContent}>
                <Text style={styles.actionTitle}>{action.title}</Text>
                <Text style={styles.actionDesc}>{action.desc}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Home size={22} color="#4F46E5" />
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('PoliciesScreen')}>
          <Shield size={22} color="#94A3B8" />
          <Text style={[styles.navLabel, styles.inactiveLabel]}>Limits</Text>
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
  limitsScrollWrap: { maxHeight: 320 },
  limitsScrollContent: { paddingRight: 6 },
  moreItemsNote: { backgroundColor: '#EEF2FF', borderLeftWidth: 4, borderLeftColor: '#4F46E5', padding: 12, borderRadius: 8, marginTop: 8 },
  moreItemsText: { color: '#3730A3', fontSize: 13, fontWeight: '600' },
  emptyState: { alignItems: 'center', paddingVertical: 40, backgroundColor: '#FFFFFF', borderRadius: 12 },
  emptyText: { marginTop: 12, color: '#64748B', fontSize: 14, fontWeight: '500' },
  createBtn: { marginTop: 16, backgroundColor: '#4F46E5', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  createBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  actionCard: { backgroundColor: '#FFFFFF', padding: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  actionContent: { marginLeft: 12, flex: 1 },
  actionTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  actionDesc: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  bottomNav: { flexDirection: 'row', backgroundColor: '#FFFFFF', paddingVertical: 12, paddingHorizontal: 24, borderTopWidth: 1, borderTopColor: '#E2E8F0', justifyContent: 'space-around', position: 'absolute', bottom: 0, left: 0, right: 0 },
  navItem: { alignItems: 'center', justifyContent: 'center' },
  navLabel: { fontSize: 11, fontWeight: '600', color: '#4F46E5', marginTop: 4 },
  inactiveLabel: { color: '#94A3B8' },
});
