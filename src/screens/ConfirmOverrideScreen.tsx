import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  ChevronLeft,
  ShieldOff,
  Clock,
  Zap,
  Shield,
  ArrowUpRight,
} from 'lucide-react-native';
import { overrideConfig, overrideLabels } from '../data/appData';
import { getRandomNudge } from '../data/nudges';
import { useUser } from '../context/UserContext';
import { usePolicyContext } from '../context/PolicyContext';
import { usePolicyFetcher } from '../hooks/usePolicyFetcher';
import { useDeviceResolver } from '../hooks/useDeviceResolver';
import { grantTemporaryOverrideAccess, grantTemporaryWebsiteOverride } from '../services/appBlockerService';
import { useOverrideAPI, getOverrideBalanceAPI, type OverrideBalanceResponse } from '../services/overrideService';

export default function ConfirmOverrideScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user, updateUser } = useUser();
  const { policies } = usePolicyContext();
  const { fetchPolicies } = usePolicyFetcher();
  const { deviceId } = useDeviceResolver(user?.uid);
  const limitId = route?.params?.limitId;
  const packageName = route?.params?.packageName;
  const appNameFromRoute = route?.params?.appName;
  const targetType = route?.params?.targetType as string || 'app';

  const [isLoading, setIsLoading] = useState(false);
  const [balance, setBalance] = useState<OverrideBalanceResponse | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [nudge] = useState(getRandomNudge);

  useEffect(() => {
    setBalanceLoading(true);
    getOverrideBalanceAPI()
      .then(data => setBalance(data))
      .catch(() => setBalance(null))
      .finally(() => setBalanceLoading(false));
  }, []);

  const totalAvailable = balance?.totalAvailable ?? 0;
  const hasCredits = totalAvailable > 0;

  const handleConfirm = async () => {
    if (!user?.uid) { Alert.alert('Error', 'User not logged in'); return; }

    if (!hasCredits) {
      navigation.navigate('BuyOverrides');
      return;
    }

    setIsLoading(true);
    try {
      if (!deviceId) { Alert.alert('Error', 'Unable to resolve your device.'); return; }

      let resolvedLimitId = limitId;
      if (!resolvedLimitId && packageName) {
        const matching = (Array.isArray(policies) ? policies : [])
          .filter((p: any) => (p.app_name || p.package_name || p.packageName) === packageName)
          .sort((a: any, b: any) => (b.created_at || 0) - (a.created_at || 0))[0];
        resolvedLimitId = matching?.id;
        if (!resolvedLimitId) await fetchPolicies();
      }

      if (!resolvedLimitId) { Alert.alert('Error', 'Unable to resolve limit for override'); return; }

      await useOverrideAPI(resolvedLimitId, deviceId);
      updateUser({ overrides_left: Math.max(0, totalAvailable - 1) });

      if (packageName) {
        if (targetType === 'website') {
          await grantTemporaryWebsiteOverride(packageName, 5);
        } else {
          await grantTemporaryOverrideAccess(packageName, appNameFromRoute || packageName, 5);
        }
      }

      const overriddenKey = targetType === 'website' && packageName ? `website:${packageName}` : packageName;
      Alert.alert(overrideLabels.alertUnlockedTitle, 'Override applied successfully', [{
        text: 'OK',
        onPress: () => navigation.navigate('DashboardScreen', { refreshAt: Date.now(), justOverriddenPackage: overriddenKey || null }),
      }]);
    } catch (error: any) {
      const msg = error?.message || 'Failed to use override';
      const status = error?.response?.status;
      if (status === 402 || msg.toLowerCase().includes('no free override credits') || msg.toLowerCase().includes('no override credits')) {
        Alert.alert('No Credits', 'You have no override credits remaining.', [
          { text: 'Buy Credits', onPress: () => navigation.navigate('BuyOverrides') },
          { text: 'Cancel', style: 'cancel' },
        ]);
      } else {
        Alert.alert('Error', msg);
      }
    } finally { setIsLoading(false); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ChevronLeft size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Confirm Override</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <LinearGradient colors={['#EEF2FF', '#F5F3FF']} style={styles.iconCircle}>
            <ShieldOff size={28} color="#6366F1" />
          </LinearGradient>

          <Text style={styles.overrideTitle}>{String(overrideConfig.overrideTitle)}</Text>
          <Text style={styles.overrideDesc}>{String(overrideConfig.overrideDescription)}</Text>

          {balanceLoading ? (
            <ActivityIndicator size="small" color="#6366F1" style={{ marginVertical: 20 }} />
          ) : (
            <View style={styles.balanceSection}>
              {hasCredits ? (
                <View style={styles.creditsBadge}>
                  <Zap size={16} color="#10B981" />
                  <Text style={styles.creditsBadgeText}>{totalAvailable} override{totalAvailable !== 1 ? 's' : ''} available</Text>
                </View>
              ) : (
                <View style={[styles.creditsBadge, styles.noCreditsBadge]}>
                  <Zap size={16} color="#EF4444" />
                  <Text style={[styles.creditsBadgeText, { color: '#DC2626' }]}>No overrides available</Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.expirationRow}>
            <Clock size={16} color="#F59E0B" />
            <Text style={styles.expirationText}>{String(overrideConfig.expiresLabel)}</Text>
          </View>
        </View>

        {balance && (
          <View style={styles.detailCard}>
            <Text style={styles.detailTitle}>Override Balance</Text>
            {[
              { label: 'Plan', value: (balance.planCode || 'free').toUpperCase() },
              ...(balance.freeOverridesPerMonth > 0 ? [{ label: 'Plan credits', value: `${balance.freeRemaining} / ${balance.freeOverridesPerMonth}` }] : []),
              ...(balance.grantedCredits > 0 ? [{ label: 'Purchased', value: `${balance.grantedRemaining} / ${balance.grantedCredits}` }] : []),
              { label: 'Total available', value: String(totalAvailable), color: totalAvailable > 0 ? '#10B981' : '#EF4444' },
            ].map((row, i) => (
              <View key={i} style={styles.detailRow}>
                <Text style={styles.detailLabel}>{row.label}</Text>
                <Text style={[styles.detailValue, row.color ? { color: row.color } : undefined]}>{row.value}</Text>
              </View>
            ))}
          </View>
        )}

        {hasCredits ? (
          <View style={styles.infoBox}>
            <Shield size={16} color="#059669" />
            <Text style={styles.infoText}>{overrideLabels.noPaymentRequired}</Text>
          </View>
        ) : (
          <TouchableOpacity style={styles.upgradeBox} onPress={() => navigation.navigate('BuyOverrides')} activeOpacity={0.8}>
            <View>
              <Text style={styles.upgradeTitle}>Need more overrides?</Text>
              <Text style={styles.upgradeDesc}>Buy any number of overrides at $1.99 each</Text>
            </View>
            <ArrowUpRight size={20} color="#6366F1" />
          </TouchableOpacity>
        )}

        <View style={styles.nudgeCard}>
          <Text style={styles.nudgeEmoji}>{"\uD83D\uDCAC"}</Text>
          <Text style={styles.nudgeText}>{"\u201C"}{nudge}{"\u201D"}</Text>
        </View>

        <TouchableOpacity
          onPress={handleConfirm}
          disabled={isLoading || !hasCredits}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={hasCredits ? ['#10B981', '#059669'] : ['#94A3B8', '#64748B']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={[styles.confirmBtn, (isLoading || !hasCredits) && styles.btnDisabled]}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Zap size={18} color="#FFFFFF" />
                <Text style={styles.confirmBtnText}>
                  {hasCredits ? 'Confirm & Unlock' : 'Upgrade to Unlock'}
                </Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <View style={styles.securityFooter}>
          <Shield size={12} color="#CBD5E1" />
          <Text style={styles.securityText}>Secured & encrypted</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  backButton: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  scrollContent: { padding: 20 },

  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#E8ECF4', shadowColor: '#64748B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 3, marginBottom: 16 },
  iconCircle: { width: 64, height: 64, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  overrideTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 6 },
  overrideDesc: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 16 },
  balanceSection: { marginBottom: 16 },
  creditsBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F0FDF4', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: '#BBF7D0' },
  noCreditsBadge: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  creditsBadgeText: { fontSize: 14, fontWeight: '700', color: '#059669' },
  expirationRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFFBEB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#FDE68A' },
  expirationText: { fontSize: 13, color: '#92400E', fontWeight: '600' },

  detailCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E8ECF4', marginBottom: 16 },
  detailTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 12 },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  detailLabel: { fontSize: 13, color: '#64748B' },
  detailValue: { fontSize: 13, fontWeight: '700', color: '#0F172A' },

  infoBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F0FDF4', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#BBF7D0', marginBottom: 20 },
  infoText: { flex: 1, fontSize: 13, color: '#065F46', fontWeight: '600' },

  upgradeBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#EEF2FF', borderRadius: 14, padding: 18, borderWidth: 1, borderColor: '#C7D2FE', marginBottom: 20 },
  upgradeTitle: { fontSize: 15, fontWeight: '700', color: '#3730A3', marginBottom: 2 },
  upgradeDesc: { fontSize: 12, color: '#6366F1' },

  confirmBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, height: 56, borderRadius: 16, shadowColor: '#10B981', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  btnDisabled: { opacity: 0.7, shadowOpacity: 0 },
  confirmBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },

  nudgeCard: { backgroundColor: '#FFFBEB', borderRadius: 16, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#FDE68A', marginBottom: 20 },
  nudgeEmoji: { fontSize: 24, marginBottom: 10 },
  nudgeText: { fontSize: 14, fontWeight: '600', color: '#92400E', textAlign: 'center', lineHeight: 20, fontStyle: 'italic' },

  securityFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 20 },
  securityText: { fontSize: 11, color: '#CBD5E1', fontWeight: '500' },
});
