import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Platform,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import {
  Smartphone,
  Laptop,
  Tablet,
  Monitor,
  ChevronRight,
  ChevronLeft,
  Zap,
  Shield,
  Clock,
} from 'lucide-react-native';
import { useUser } from '../context/UserContext';
import axiosService from '../services/axiosService';
import { API } from '../config/config';
import SideDrawer from '../components/SideDrawer';
import HamburgerButton from '../components/HamburgerButton';
import { formatPlanName } from '../utils/planRules';

interface ProfileData {
  account: { planCode: string };
  devices: {
    count: number;
    max: number | null;
    list: Array<{ deviceId: string; deviceName: string; platform: string; lastSeenAt: any }>;
  };
  planLimits: { maxPolicies: number; currentPolicies: number; customTimers: boolean };
  overrides: { totalAvailable: number; freeOverridesPerMonth: number };
}

const PLAN_COLORS: Record<string, [string, string]> = {
  free: ['#64748B', '#475569'],
  pro: ['#10B981', '#059669'],
  elite: ['#F59E0B', '#D97706'],
  ultra_elite: ['#7C3AED', '#5B21B6'],
};

export default function ControlPlansScreen() {
  const navigation = useNavigation<any>();
  const { user } = useUser();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchRef = useRef(async () => {});
  fetchRef.current = async () => {
    try {
      const data = await axiosService.get<ProfileData>(API.AccountProfile);
      setProfile(data);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchRef.current(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchRef.current(); };

  const planCode = profile?.account.planCode || 'free';
  const planColors = PLAN_COLORS[planCode] || PLAN_COLORS.free;
  const deviceCount = profile?.devices.count || 0;
  const deviceMax = profile?.devices.max ?? -1;
  const devicePct = deviceMax !== -1 ? Math.min(100, (deviceCount / deviceMax) * 100) : 0;

  const getDeviceIcon = (platform: string) => {
    const p = platform.toLowerCase();
    if (p.includes('android') || p.includes('ios') || p === 'chrome') return <Smartphone size={20} color="#10B981" />;
    if (p.includes('tablet') || p.includes('ipad')) return <Tablet size={20} color="#10B981" />;
    if (p.includes('mac') || p.includes('windows')) return <Laptop size={20} color="#10B981" />;
    return <Monitor size={20} color="#10B981" />;
  };

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={s.header}>
        <HamburgerButton onPress={() => setDrawerOpen(true)} color="#0F172A" />
        <Text style={s.headerTitle}>Devices & Plan</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View style={s.loadingWrap}>
            <ActivityIndicator size="large" color="#10B981" />
          </View>
        ) : profile ? (
          <>
            <LinearGradient colors={planColors as [string, string]} style={s.planCard}>
              <View style={s.planRow}>
                <View>
                  <Text style={s.planLabel}>Current Plan</Text>
                  <Text style={s.planName}>{formatPlanName(planCode)}</Text>
                </View>
                <TouchableOpacity
                  style={s.upgradeChip}
                  onPress={() => navigation.navigate('SubscriptionPlansScreen')}
                  activeOpacity={0.8}
                >
                  <Text style={s.upgradeChipText}>
                    {planCode === 'elite' || planCode === 'ultra_elite' ? 'Top Plan' : 'Upgrade'}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={s.planStatsRow}>
                <View style={s.planStat}>
                  <Shield size={14} color="rgba(255,255,255,0.7)" />
                  <Text style={s.planStatValue}>{profile.planLimits.maxPolicies !== -1 ? `${profile.planLimits.currentPolicies}/${profile.planLimits.maxPolicies}` : `${profile.planLimits.currentPolicies}`}</Text>
                  <Text style={s.planStatLabel}>Limits</Text>
                </View>
                <View style={s.planStat}>
                  <Smartphone size={14} color="rgba(255,255,255,0.7)" />
                  <Text style={s.planStatValue}>{deviceCount}/{deviceMax === -1 ? '\u221E' : deviceMax}</Text>
                  <Text style={s.planStatLabel}>Devices</Text>
                </View>
                <View style={s.planStat}>
                  <Zap size={14} color="rgba(255,255,255,0.7)" />
                  <Text style={s.planStatValue}>{profile.overrides.freeOverridesPerMonth === -1 ? '\u221E' : profile.overrides.totalAvailable}</Text>
                  <Text style={s.planStatLabel}>Overrides</Text>
                </View>
              </View>
            </LinearGradient>

            <Text style={s.sectionTitle}>Device Slots</Text>
            <View style={s.card}>
              <View style={s.quotaRow}>
                <Text style={s.quotaLabel}>Used</Text>
                <Text style={s.quotaValue}>{deviceCount} / {deviceMax === -1 ? '\u221E' : deviceMax}</Text>
              </View>
              {deviceMax !== -1 && (
                <View style={s.progressTrack}>
                  <LinearGradient
                    colors={devicePct >= 100 ? ['#EF4444', '#DC2626'] : ['#10B981', '#34D399']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[s.progressFill, { width: `${Math.max(devicePct, 4)}%` }]}
                  />
                </View>
              )}
              <Text style={s.quotaHint}>
                {deviceMax === -1
                  ? 'Unlimited devices'
                  : deviceMax - deviceCount > 0
                    ? `${deviceMax - deviceCount} slot${deviceMax - deviceCount > 1 ? 's' : ''} remaining`
                    : 'All slots used. Upgrade for more.'}
              </Text>
            </View>

            <Text style={s.sectionTitle}>Registered Devices</Text>
            {profile.devices.list.length === 0 ? (
              <View style={s.emptyCard}>
                <Text style={s.emptyText}>No devices registered yet</Text>
              </View>
            ) : (
              profile.devices.list.map(device => (
                <View key={device.deviceId} style={s.deviceCard}>
                  <View style={s.deviceIconWrap}>
                    {getDeviceIcon(device.platform)}
                  </View>
                  <View style={s.deviceInfo}>
                    <Text style={s.deviceName}>{device.deviceName}</Text>
                    <Text style={s.devicePlatform}>{device.platform}</Text>
                  </View>
                  <View style={s.activeDot} />
                </View>
              ))
            )}

            <Text style={s.sectionTitle}>Quick Actions</Text>
            <TouchableOpacity style={s.menuCard} onPress={() => navigation.navigate('PoliciesScreen')}>
              <Shield size={20} color="#10B981" />
              <View style={s.menuContent}>
                <Text style={s.menuLabel}>Manage Limits</Text>
              </View>
              <ChevronRight size={18} color="#CBD5E1" />
            </TouchableOpacity>
            <TouchableOpacity style={s.menuCard} onPress={() => navigation.navigate('SubscriptionPlansScreen')}>
              <Zap size={20} color="#F59E0B" />
              <View style={s.menuContent}>
                <Text style={s.menuLabel}>Upgrade Plan</Text>
              </View>
              <ChevronRight size={18} color="#CBD5E1" />
            </TouchableOpacity>
            <TouchableOpacity style={s.menuCard} onPress={() => navigation.navigate('AnalyticsScreen')}>
              <Clock size={20} color="#10B981" />
              <View style={s.menuContent}>
                <Text style={s.menuLabel}>Usage Analytics</Text>
              </View>
              <ChevronRight size={18} color="#CBD5E1" />
            </TouchableOpacity>

            <View style={{ height: 20 }} />
          </>
        ) : (
          <View style={s.loadingWrap}>
            <Text style={s.emptyText}>Failed to load</Text>
          </View>
        )}
      </ScrollView>

      <SideDrawer visible={drawerOpen} active="settings" onClose={() => setDrawerOpen(false)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  backBtn: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  scrollContent: { padding: 20 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },

  planCard: { borderRadius: 20, padding: 20, marginBottom: 20 },
  planRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  planLabel: { fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: '500' },
  planName: { fontSize: 24, fontWeight: '900', color: '#FFFFFF', marginTop: 2 },
  upgradeChip: { backgroundColor: 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  upgradeChipText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  planStatsRow: { flexDirection: 'row', gap: 10 },
  planStat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 12, padding: 10, alignItems: 'center', gap: 4 },
  planStatValue: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  planStatLabel: { fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: '600' },

  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 8 },

  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E8ECF4', marginBottom: 16 },
  quotaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  quotaLabel: { fontSize: 14, fontWeight: '600', color: '#475569' },
  quotaValue: { fontSize: 14, fontWeight: '800', color: '#0F172A' },
  progressTrack: { height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', borderRadius: 4 },
  quotaHint: { fontSize: 12, color: '#94A3B8', fontWeight: '500' },

  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#E8ECF4', marginBottom: 16 },
  emptyText: { fontSize: 14, color: '#94A3B8', fontWeight: '500' },

  deviceCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#E8ECF4', marginBottom: 8, gap: 12, shadowColor: '#64748B', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  deviceIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F0FDF4', alignItems: 'center', justifyContent: 'center' },
  deviceInfo: { flex: 1 },
  deviceName: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  devicePlatform: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  activeDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981' },

  menuCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: '#E8ECF4', gap: 14 },
  menuContent: { flex: 1 },
  menuLabel: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
});
