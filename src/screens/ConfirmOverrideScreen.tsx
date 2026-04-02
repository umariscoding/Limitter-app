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
import { useNavigation, useRoute } from '@react-navigation/native';
import {
  ChevronLeft,
  ShieldOff,
  Clock,
  LockOpen,
  Shield,
} from 'lucide-react-native';
import { overrideConfig, overrideLabels } from '../data/appData';
import { useUser } from '../context/UserContext';
import { usePolicyContext } from '../context/PolicyContext';
import { usePolicyFetcher } from '../hooks/usePolicyFetcher';
import { useDeviceResolver } from '../hooks/useDeviceResolver';
import { grantTemporaryOverrideAccess } from '../services/appBlockerService';
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

  const [isLoading, setIsLoading] = useState(false);
  const [balance, setBalance] = useState<OverrideBalanceResponse | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);

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
    if (!user?.uid) {
      Alert.alert('Error', 'User not logged in');
      return;
    }

    if (!hasCredits) {
      navigation.navigate('SubscriptionPlansScreen', {
        fromBlockingOverride: true,
        packageName,
        appName: appNameFromRoute,
      });
      return;
    }

    setIsLoading(true);
    try {
      if (!deviceId) {
        Alert.alert('Error', 'Unable to resolve your device. Please try again.');
        return;
      }

      let resolvedLimitId = limitId;

      if (!resolvedLimitId && packageName) {
        const policiesData = Array.isArray(policies) ? policies : [];
        const matching = policiesData
          .filter((p: any) => {
            const key = p.app_name || p.package_name || p.packageName;
            return key === packageName;
          })
          .sort((a: any, b: any) => (b.created_at || 0) - (a.created_at || 0))[0];

        resolvedLimitId = matching?.id;

        if (!resolvedLimitId) {
          await fetchPolicies();
        }
      }

      if (!resolvedLimitId) {
        Alert.alert('Error', 'Unable to resolve limit for override');
        return;
      }

      await useOverrideAPI(resolvedLimitId, deviceId);

      updateUser({ overrides_left: Math.max(0, totalAvailable - 1) });

      if (packageName) {
        await grantTemporaryOverrideAccess(packageName, appNameFromRoute || packageName, 5);
      }

      Alert.alert(
        overrideLabels.alertUnlockedTitle,
        'Override applied successfully',
        [{
          text: 'OK',
          onPress: () =>
            navigation.navigate('DashboardScreen', {
              refreshAt: Date.now(),
              justOverriddenPackage: packageName || null,
            }),
        }]
      );
    } catch (error: any) {
      const msg = error?.message || 'Failed to use override';
      if (msg.includes('No free override credits')) {
        navigation.navigate('SubscriptionPlansScreen', {
          fromBlockingOverride: true,
          packageName,
          appName: appNameFromRoute,
        });
      } else {
        Alert.alert('Error', msg);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color="#0F172A" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{overrideLabels.headerTitle}</Text>
          <Text style={styles.headerSubtitle}>{overrideLabels.headerSubtitle}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <View style={styles.cardTopSection}>
            <View style={styles.iconContainer}>
              <ShieldOff size={32} color="#6366F1" />
            </View>
            <Text style={styles.overrideTitle}>{String(overrideConfig.overrideTitle)}</Text>
            <Text style={styles.overrideDescription}>{String(overrideConfig.overrideDescription)}</Text>
          </View>

          <View style={styles.priceSection}>
            {balanceLoading ? (
              <ActivityIndicator size="small" color="#6366F1" />
            ) : hasCredits ? (
              <View style={styles.freeContainer}>
                <View style={styles.greenBadge}>
                  <Text style={styles.greenBadgeText}>{totalAvailable} override{totalAvailable !== 1 ? 's' : ''} remaining</Text>
                </View>
                <Text style={styles.priceSubtext}>{overrideLabels.freeUsageNote}</Text>
              </View>
            ) : (
              <View style={styles.paidContainer}>
                <Text style={styles.noCreditsText}>No free overrides remaining</Text>
                <Text style={styles.priceSubtext}>Upgrade your plan for more overrides</Text>
              </View>
            )}
          </View>

          <View style={styles.expirationRow}>
            <Clock size={20} color="#F59E0B" style={styles.expirationIcon} />
            <Text style={styles.expirationText}>{String(overrideConfig.expiresLabel)}</Text>
          </View>
        </View>

        <View style={styles.paymentSection}>
          {hasCredits ? (
            <View style={styles.freeInfoBox}>
              <View style={styles.greenCheckCircle}>
                <Text style={styles.whiteCheck}>✓</Text>
              </View>
              <Text style={styles.freeInfoText}>{overrideLabels.noPaymentRequired}</Text>
            </View>
          ) : (
            <View style={styles.upgradeBox}>
              <Text style={styles.upgradeText}>Upgrade to Pro or Elite for free overrides every month</Text>
              <TouchableOpacity
                style={styles.upgradeBtn}
                onPress={() => navigation.navigate('SubscriptionPlansScreen')}
              >
                <Text style={styles.upgradeBtnText}>View Plans</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {balance && (
          <View style={styles.balanceCard}>
            <Text style={styles.balanceTitle}>Override Balance</Text>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>Plan</Text>
              <Text style={styles.balanceValue}>{(balance.planCode || 'free').toUpperCase()}</Text>
            </View>
            {balance.freeOverridesPerMonth > 0 && (
              <View style={styles.balanceRow}>
                <Text style={styles.balanceLabel}>Plan credits</Text>
                <Text style={styles.balanceValue}>{balance.freeRemaining} / {balance.freeOverridesPerMonth}</Text>
              </View>
            )}
            {balance.grantedCredits > 0 && (
              <View style={styles.balanceRow}>
                <Text style={styles.balanceLabel}>Purchased credits</Text>
                <Text style={styles.balanceValue}>{balance.grantedRemaining} / {balance.grantedCredits}</Text>
              </View>
            )}
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>Total available</Text>
              <Text style={[styles.balanceValue, { color: totalAvailable > 0 ? '#10B981' : '#EF4444' }]}>
                {totalAvailable}
              </Text>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={[
            styles.confirmBtn,
            { backgroundColor: hasCredits ? '#10B981' : '#6366F1' },
            (isLoading || !hasCredits) && styles.btnDisabled,
          ]}
          onPress={handleConfirm}
          disabled={isLoading || !hasCredits}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <LockOpen size={20} color="#FFFFFF" style={styles.btnIcon} />
              <Text style={styles.confirmBtnText}>
                {hasCredits ? overrideLabels.btnFree : 'Upgrade to Unlock'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <View style={styles.securityFooter}>
          <View style={styles.securityRow}>
            <Shield size={14} color="#9CA3AF" />
            <Text style={styles.securityText}>{overrideLabels.securityMain}</Text>
          </View>
          <Text style={styles.encryptionText}>{overrideLabels.securitySub}</Text>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 12 : 12, paddingBottom: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  headerTitleContainer: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  headerSubtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
  scrollContent: { padding: 24 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5 },
  cardTopSection: { alignItems: 'center', marginBottom: 24 },
  iconContainer: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  overrideTitle: { fontSize: 22, fontWeight: '700', color: '#0F172A', marginBottom: 8 },
  overrideDescription: { fontSize: 14, color: '#64748B', textAlign: 'center' },
  priceSection: { alignItems: 'center', marginBottom: 24, paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#F1F5F9' },
  freeContainer: { alignItems: 'center' },
  greenBadge: { backgroundColor: '#DCFCE7', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99, marginBottom: 8 },
  greenBadgeText: { color: '#10B981', fontWeight: '700', fontSize: 14 },
  paidContainer: { alignItems: 'center' },
  noCreditsText: { fontSize: 16, fontWeight: '700', color: '#EF4444', marginBottom: 4 },
  priceSubtext: { fontSize: 12, color: '#94A3B8' },
  expirationRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A', borderRadius: 10, padding: 12 },
  expirationIcon: { marginRight: 10 },
  expirationText: { fontSize: 14, color: '#92400E', fontWeight: '500' },
  paymentSection: { marginTop: 24 },
  freeInfoBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#DCFCE7', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#86EFAC' },
  greenCheckCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#10B981', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  whiteCheck: { color: '#FFFFFF', fontWeight: '900', fontSize: 14 },
  freeInfoText: { flex: 1, fontSize: 14, color: '#065F46', fontWeight: '600' },
  upgradeBox: { backgroundColor: '#EEF2FF', borderRadius: 12, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#C7D2FE' },
  upgradeText: { fontSize: 14, color: '#3730A3', fontWeight: '600', textAlign: 'center', marginBottom: 12 },
  upgradeBtn: { backgroundColor: '#6366F1', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8 },
  upgradeBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  balanceCard: { backgroundColor: '#FFFFFF', borderRadius: 12, padding: 16, marginTop: 24, borderWidth: 1, borderColor: '#E2E8F0' },
  balanceTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 12 },
  balanceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  balanceLabel: { fontSize: 14, color: '#64748B' },
  balanceValue: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  confirmBtn: { marginTop: 32, height: 56, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: '#6366F1', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 },
  btnDisabled: { opacity: 0.7 },
  btnIcon: { marginRight: 10 },
  confirmBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  securityFooter: { marginTop: 24, alignItems: 'center', paddingBottom: 40 },
  securityRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  securityText: { fontSize: 11, color: '#9CA3AF', fontWeight: '600' },
  encryptionText: { fontSize: 10, color: '#D1D5DB', fontWeight: '500' },
});
