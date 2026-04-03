import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Platform,
  Alert,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '../context/UserContext';
import { signOut } from '../auth/firebaseAuthService';
import { dashboardLabels } from '../data/appData';
import axiosService from '../services/axiosService';
import { API } from '../config/config';
import {
  Home,
  BarChart2,
  Settings as SettingsIcon,
  User,
  CreditCard,
  Smartphone,
  Shield,
  LogOut,
  ChevronRight,
  Clock,
} from 'lucide-react-native';

interface ProfileData {
  user: { uid: string; email: string; displayName: string | null };
  account: { accountId: string; name: string; planCode: string; status: string };
  subscription: any;
  devices: { count: number; max: number; list: Array<{ deviceId: string; deviceName: string; platform: string }> };
  overrides: { freeRemaining: number; grantedRemaining: number; totalAvailable: number; totalUsedThisMonth: number; freeOverridesPerMonth: number };
  planLimits: { maxPolicies: number | null; currentPolicies: number; customTimers: boolean };
}

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { clearUser } = useUser();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProfile = async () => {
    try {
      const data = await axiosService.get<ProfileData>(API.AccountProfile);
      setProfile(data);
    } catch { /* silenced */ }
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchProfile(); }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchProfile();
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          clearUser();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#4F46E5" />
          </View>
        ) : profile ? (
          <>
            <View style={styles.profileCard}>
              <View style={styles.avatarCircle}>
                <User size={28} color="#4F46E5" />
              </View>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{profile.user.displayName || 'User'}</Text>
                <Text style={styles.profileEmail}>{profile.user.email}</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Subscription</Text>
            <TouchableOpacity
              style={styles.card}
              onPress={() => navigation.navigate('SubscriptionPlansScreen')}
            >
              <View style={styles.cardRow}>
                <CreditCard size={20} color="#4F46E5" />
                <View style={styles.cardContent}>
                  <Text style={styles.cardLabel}>Current Plan</Text>
                  <Text style={styles.cardValue}>{(profile.account.planCode || 'free').toUpperCase()}</Text>
                </View>
                <ChevronRight size={18} color="#94A3B8" />
              </View>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Plan Usage</Text>
            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Shield size={18} color="#10B981" />
                <Text style={styles.statValue}>
                  {profile.planLimits.currentPolicies}/{profile.planLimits.maxPolicies ?? '∞'}
                </Text>
                <Text style={styles.statLabel}>Limits</Text>
              </View>
              <View style={styles.statBox}>
                <Smartphone size={18} color="#3B82F6" />
                <Text style={styles.statValue}>{profile.devices.count}/{profile.devices.max}</Text>
                <Text style={styles.statLabel}>Devices</Text>
              </View>
              <View style={styles.statBox}>
                <Clock size={18} color="#F59E0B" />
                <Text style={styles.statValue}>{profile.overrides.totalAvailable}</Text>
                <Text style={styles.statLabel}>Overrides</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Override Credits</Text>
            <View style={styles.card}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Free / month</Text>
                <Text style={styles.detailValue}>{profile.overrides.freeOverridesPerMonth}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Free remaining</Text>
                <Text style={styles.detailValue}>{profile.overrides.freeRemaining}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Purchased remaining</Text>
                <Text style={styles.detailValue}>{profile.overrides.grantedRemaining}</Text>
              </View>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Used this month</Text>
                <Text style={styles.detailValue}>{profile.overrides.totalUsedThisMonth}</Text>
              </View>
            </View>

            <Text style={styles.sectionTitle}>Devices</Text>
            {profile.devices.list.map(d => (
              <View key={d.deviceId} style={styles.deviceRow}>
                <Smartphone size={18} color="#64748B" />
                <View style={styles.deviceInfo}>
                  <Text style={styles.deviceName}>{d.deviceName}</Text>
                  <Text style={styles.devicePlatform}>{d.platform}</Text>
                </View>
              </View>
            ))}

            <Text style={styles.sectionTitle}>Quick Links</Text>
            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => navigation.navigate('OverrideLogsScreen')}
            >
              <Text style={styles.linkText}>Override History</Text>
              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.linkRow}
              onPress={() => navigation.navigate('PoliciesScreen')}
            >
              <Text style={styles.linkText}>Manage Limits</Text>
              <ChevronRight size={18} color="#94A3B8" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
              <LogOut size={18} color="#B91C1C" />
              <Text style={styles.signOutText}>Sign Out</Text>
            </TouchableOpacity>

            <View style={{ height: 100 }} />
          </>
        ) : (
          <View style={styles.loadingWrap}>
            <Text style={styles.errorText}>Failed to load profile</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={fetchProfile}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('DashboardScreen')}>
          <Home size={22} color="#94A3B8" />
          <Text style={styles.navLabel}>{dashboardLabels.navHome}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('AnalyticsScreen')}>
          <BarChart2 size={22} color="#94A3B8" />
          <Text style={styles.navLabel}>{dashboardLabels.navUsage}</Text>
        </TouchableOpacity>
        <View style={styles.navItem}>
          <SettingsIcon size={22} color="#6366F1" />
          <Text style={[styles.navLabel, styles.activeNavText]}>{dashboardLabels.navSettings}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { backgroundColor: '#FFFFFF', padding: 20, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  scrollContent: { padding: 20 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 24 },
  avatarCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  profileEmail: { fontSize: 14, color: '#64748B', marginTop: 2 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 8 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardContent: { flex: 1 },
  cardLabel: { fontSize: 12, color: '#64748B' },
  cardValue: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginTop: 2 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statBox: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', gap: 6 },
  statValue: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  statLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  detailLabel: { fontSize: 14, color: '#64748B' },
  detailValue: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  deviceRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 8, gap: 12 },
  deviceInfo: { flex: 1 },
  deviceName: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  devicePlatform: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  linkRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 8 },
  linkText: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24, paddingVertical: 14, backgroundColor: '#FEE2E2', borderRadius: 12, borderWidth: 1, borderColor: '#FECACA' },
  signOutText: { color: '#B91C1C', fontWeight: '700', fontSize: 15 },
  errorText: { fontSize: 16, color: '#64748B', marginBottom: 12 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#4F46E5', borderRadius: 8 },
  retryText: { color: '#FFFFFF', fontWeight: '700' },
  bottomNav: { flexDirection: 'row', backgroundColor: '#FFFFFF', paddingVertical: 12, paddingHorizontal: 24, borderTopWidth: 1, borderTopColor: '#E2E8F0', justifyContent: 'space-between', paddingBottom: Platform.OS === 'ios' ? 24 : 12 },
  navItem: { alignItems: 'center', flex: 1 },
  navLabel: { fontSize: 12, fontWeight: '600', color: '#94A3B8' },
  activeNavText: { color: '#6366F1' },
});
