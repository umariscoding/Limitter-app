import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useUser } from '../context/UserContext';
import { usePolicyContext } from '../context/PolicyContext';
import { signOut, updateDisplayName, resetPassword } from '../auth/firebaseAuthService';
import { updateBlockedApps, stopAllTimers } from '../services/appBlockerService';
import axiosService from '../services/axiosService';
import { API } from '../config/config';
import BottomNav from '../components/BottomNav';
import {
  User,
  CreditCard,
  Smartphone,
  Shield,
  LogOut,
  ChevronRight,
  Zap,
  Edit3,
  Lock,
} from 'lucide-react-native';

interface ProfileData {
  user: { uid: string; email: string; displayName: string | null };
  account: { accountId: string; name: string; planCode: string; status: string };
  subscription: any;
  devices: { count: number; max: number; list: Array<{ deviceId: string; deviceName: string; platform: string }> };
  overrides: { freeRemaining: number; grantedRemaining: number; totalAvailable: number; totalUsedThisMonth: number; freeOverridesPerMonth: number };
  planLimits: { maxPolicies: number | null; currentPolicies: number; customTimers: boolean };
}

const PLAN_COLORS: Record<string, [string, string]> = {
  free: ['#64748B', '#475569'],
  pro: ['#6366F1', '#4F46E5'],
  elite: ['#F59E0B', '#D97706'],
};

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { clearUser } = useUser();
  const { setPolicies } = usePolicyContext();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showEditName, setShowEditName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [savingName, setSavingName] = useState(false);

  const fetchProfile = async () => {
    try {
      const data = await axiosService.get<ProfileData>(API.AccountProfile);
      setProfile(data);
    } catch {}
    finally { setLoading(false); setRefreshing(false); }
  };

  const fetchRef = useRef(fetchProfile);
  fetchRef.current = fetchProfile;
  useFocusEffect(React.useCallback(() => { fetchRef.current(); }, []));

  const onRefresh = () => { setRefreshing(true); fetchProfile(); };

  const handleEditName = () => {
    setEditNameValue(profile?.user.displayName || '');
    setShowEditName(true);
  };

  const handleSaveName = async () => {
    const trimmed = editNameValue.trim();
    if (!trimmed) { Alert.alert('Validation', 'Name cannot be empty'); return; }
    setSavingName(true);
    try {
      await updateDisplayName(trimmed);
      setProfile(prev => prev ? { ...prev, user: { ...prev.user, displayName: trimmed } } : prev);
      setShowEditName(false);
      Alert.alert('Success', 'Name updated successfully');
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Failed to update name');
    } finally { setSavingName(false); }
  };

  const handleResetPassword = () => {
    const email = profile?.user.email;
    if (!email) return;
    Alert.alert('Reset Password', `We'll send a password reset link to ${email}`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Send', onPress: async () => {
        try {
          await resetPassword(email);
          Alert.alert('Email Sent', 'Check your inbox for the password reset link.');
        } catch (err: any) {
          Alert.alert('Error', err?.message || 'Failed to send reset email');
        }
      }},
    ]);
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: async () => {
        await stopAllTimers();
        updateBlockedApps([]);
        setPolicies([]);
        await signOut();
        clearUser();
      } },
    ]);
  };

  const planCode = profile?.account.planCode || 'free';
  const planColors = PLAN_COLORS[planCode] || PLAN_COLORS.free;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <Modal visible={showEditName} transparent animationType="fade" onRequestClose={() => setShowEditName(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Edit Name</Text>
            <TextInput
              value={editNameValue}
              onChangeText={setEditNameValue}
              placeholder="Enter your name"
              style={styles.modalInput}
              autoFocus
              autoCapitalize="words"
              placeholderTextColor="#94A3B8"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowEditName(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalSaveBtn} onPress={handleSaveName} disabled={savingName}>
                <Text style={styles.modalSaveText}>{savingName ? 'Saving...' : 'Save'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color="#6366F1" />
          </View>
        ) : profile ? (
          <>
            <View style={styles.profileCard}>
              <LinearGradient colors={['#6366F1', '#818CF8']} style={styles.avatarGradient}>
                <Text style={styles.avatarLetter}>
                  {(profile.user.displayName || profile.user.email)?.[0]?.toUpperCase() || 'U'}
                </Text>
              </LinearGradient>
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{profile.user.displayName || 'User'}</Text>
                <Text style={styles.profileEmail}>{profile.user.email}</Text>
              </View>
              <LinearGradient colors={planColors as [string, string]} style={styles.planBadge}>
                <Text style={styles.planBadgeText}>{planCode.toUpperCase()}</Text>
              </LinearGradient>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Shield size={18} color="#10B981" />
                <Text style={styles.statValue}>
                  {profile.planLimits.currentPolicies}/{profile.planLimits.maxPolicies ?? '\u221E'}
                </Text>
                <Text style={styles.statLabel}>Limits</Text>
              </View>
              <View style={styles.statBox}>
                <Smartphone size={18} color="#3B82F6" />
                <Text style={styles.statValue}>{profile.devices.count}/{profile.devices.max}</Text>
                <Text style={styles.statLabel}>Devices</Text>
              </View>
              <TouchableOpacity style={styles.statBox} onPress={() => navigation.navigate('OverrideLogsScreen')} activeOpacity={0.8}>
                <Zap size={18} color="#F59E0B" />
                <Text style={styles.statValue}>{profile.overrides.totalAvailable}</Text>
                <Text style={styles.statLabel}>Overrides</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.sectionTitle}>Account</Text>
            <TouchableOpacity style={styles.menuCard} onPress={handleEditName}>
              <Edit3 size={20} color="#10B981" />
              <View style={styles.menuContent}>
                <Text style={styles.menuLabel}>Edit Name</Text>
              </View>
              <ChevronRight size={18} color="#CBD5E1" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuCard} onPress={handleResetPassword}>
              <Lock size={20} color="#6366F1" />
              <View style={styles.menuContent}>
                <Text style={styles.menuLabel}>Reset Password</Text>
              </View>
              <ChevronRight size={18} color="#CBD5E1" />
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Subscription</Text>
            <TouchableOpacity style={styles.menuCard} onPress={() => navigation.navigate('SubscriptionPlansScreen')}>
              <CreditCard size={20} color="#6366F1" />
              <View style={styles.menuContent}>
                <Text style={styles.menuLabel}>Current Plan</Text>
                <Text style={styles.menuValue}>{planCode.toUpperCase()}</Text>
              </View>
              <ChevronRight size={18} color="#CBD5E1" />
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>Devices</Text>
            {profile.devices.list.map(d => (
              <View key={d.deviceId} style={styles.deviceCard}>
                <View style={styles.deviceIconWrap}>
                  <Smartphone size={18} color="#6366F1" />
                </View>
                <View style={styles.deviceInfo}>
                  <Text style={styles.deviceName}>{d.deviceName}</Text>
                  <Text style={styles.devicePlatform}>{d.platform}</Text>
                </View>
              </View>
            ))}

            <Text style={styles.sectionTitle}>Quick Links</Text>
            <TouchableOpacity style={styles.menuCard} onPress={() => navigation.navigate('OverrideLogsScreen')}>
              <Zap size={20} color="#F59E0B" />
              <View style={styles.menuContent}>
                <Text style={styles.menuLabel}>Overrides</Text>
              </View>
              <ChevronRight size={18} color="#CBD5E1" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.menuCard} onPress={() => navigation.navigate('PoliciesScreen')}>
              <Shield size={20} color="#10B981" />
              <View style={styles.menuContent}>
                <Text style={styles.menuLabel}>Manage Limits</Text>
              </View>
              <ChevronRight size={18} color="#CBD5E1" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut} activeOpacity={0.8}>
              <LogOut size={18} color="#DC2626" />
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

      <BottomNav active="settings" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  header: { backgroundColor: '#FFFFFF', paddingVertical: 40, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  scrollContent: { padding: 20 },
  loadingWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },

  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 18, borderRadius: 20, borderWidth: 1, borderColor: '#E8ECF4', marginBottom: 16, shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  avatarGradient: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  avatarLetter: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  profileEmail: { fontSize: 13, color: '#64748B', marginTop: 2 },
  planBadge: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20 },
  planBadgeText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF', letterSpacing: 0.5 },

  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statBox: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#E8ECF4', shadowColor: '#64748B', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  statValue: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
  statLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },

  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10, marginTop: 8 },

  menuCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: '#E8ECF4', gap: 14 },
  menuContent: { flex: 1 },
  menuLabel: { fontSize: 15, fontWeight: '600', color: '#0F172A' },
  menuValue: { fontSize: 12, color: '#6366F1', fontWeight: '700', marginTop: 2 },

  deviceCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#E8ECF4', marginBottom: 8, gap: 12 },
  deviceIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
  deviceInfo: { flex: 1 },
  deviceName: { fontSize: 14, fontWeight: '600', color: '#0F172A' },
  devicePlatform: { fontSize: 12, color: '#94A3B8', marginTop: 2 },

  signOutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 24, paddingVertical: 14, backgroundColor: '#FEF2F2', borderRadius: 14, borderWidth: 1, borderColor: '#FECACA' },
  signOutText: { color: '#DC2626', fontWeight: '700', fontSize: 15 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.45)', justifyContent: 'center', paddingHorizontal: 24 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 16 },
  modalInput: { borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#0F172A', backgroundColor: '#F8FAFC', marginBottom: 20 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  modalCancelBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, backgroundColor: '#E2E8F0' },
  modalCancelText: { color: '#334155', fontWeight: '600', fontSize: 14 },
  modalSaveBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, backgroundColor: '#10B981' },
  modalSaveText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  errorText: { fontSize: 16, color: '#64748B', marginBottom: 12 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: '#6366F1', borderRadius: 10 },
  retryText: { color: '#FFFFFF', fontWeight: '700' },
});
