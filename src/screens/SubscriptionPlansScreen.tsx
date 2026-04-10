import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Alert,
  ActivityIndicator,
  Keyboard,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ChevronLeft, Check, X, Zap, Shield, ShieldCheck } from 'lucide-react-native';
import { subscriptionPlans } from '../data/appData';
import { useUser } from '../context/UserContext';
import { useDeviceResolver } from '../hooks/useDeviceResolver';
import { grantTemporaryOverrideAccess } from '../services/appBlockerService';
import { grantOverrideCreditsAPI, useOverrideAPI, getOverrideBalanceAPI } from '../services/overrideService';
import { getPoliciesAPI } from '../services/policyService';
import { getPlanOverrideLimit, normalizePlan } from '../utils/planRules';
import { upgradePlanAPI } from '../services/planGuardService';
import BottomNav from '../components/BottomNav';

const PLAN_GRADIENTS: Record<string, [string, string]> = {
  '1': ['#64748B', '#475569'],
  '2': ['#6366F1', '#4F46E5'],
  '3': ['#F59E0B', '#D97706'],
};

const OVERRIDE_PACKS = [
  { count: 2, total: 3.98 },
  { count: 5, total: 9.95 },
  { count: 10, total: 19.90 },
];

export default function SubscriptionPlansScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user, updateUser } = useUser();
  const { deviceId } = useDeviceResolver(user?.uid);
  const currentUserPlan = normalizePlan(user?.plan);

  const defaultSelectedPlanId = currentUserPlan === 'elite' ? '3' : currentUserPlan === 'pro' ? '2' : '1';
  const [selectedPlanId, setSelectedPlanId] = useState(defaultSelectedPlanId);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showOverrideChoice, setShowOverrideChoice] = useState(false);
  const [showBuyOverridesModal, setShowBuyOverridesModal] = useState(false);

  const blockingPackage = route?.params?.packageName as string | undefined;
  const blockingAppName = route?.params?.appName as string | undefined;
  const fromBlockingOverride = Boolean(route?.params?.fromBlockingOverride && blockingPackage);
  const showBuyOverridesParam = Boolean(route?.params?.showBuyOverrides);

  useEffect(() => {
    if (fromBlockingOverride) setShowOverrideChoice(true);
    if (showBuyOverridesParam) setShowBuyOverridesModal(true);
  }, [fromBlockingOverride, showBuyOverridesParam]);

  const selectedPlan = subscriptionPlans.find(p => p.id === selectedPlanId) || subscriptionPlans[1];
  const isCurrentPlan = normalizePlan(selectedPlan.name) === currentUserPlan;

  const mapPlanIdToUserPlan = (planId: string): 'free' | 'pro' | 'elite' => {
    if (planId === '3') return 'elite';
    if (planId === '2') return 'pro';
    return 'free';
  };

  const handleConfirmPay = async () => {
    Keyboard.dismiss();
    const newPlan = mapPlanIdToUserPlan(selectedPlanId);
    if (newPlan === currentUserPlan) { Alert.alert('Already Active', `You are already on the ${selectedPlan.name} plan.`); return; }

    setIsProcessing(true);
    try {
      const result = await upgradePlanAPI(newPlan);
      const confirmedPlan = result?.planCode || newPlan;

      // Fetch fresh override balance from backend after upgrade
      let overrideCount = getPlanOverrideLimit(confirmedPlan);
      try {
        const balance = await getOverrideBalanceAPI();
        overrideCount = balance.totalAvailable;
      } catch { /* use fallback */ }
      updateUser({ plan: confirmedPlan, overrides_left: overrideCount });
      Alert.alert('Plan Activated!', `You are now on the ${selectedPlan.name} plan.`, [{
        text: 'Go to Dashboard',
        onPress: () => navigation.navigate('DashboardScreen', { planUpdatedAt: Date.now() }),
      }]);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to upgrade plan.');
    } finally { setIsProcessing(false); }
  };

  const handlePurchaseOverridePack = async (count: number) => {
    setIsProcessing(true);
    try {
      const result = await grantOverrideCreditsAPI(count);
      updateUser({ overrides_left: result.grantedRemaining });

      if (blockingPackage && deviceId) {
        try {
          const policies = await getPoliciesAPI() as any[];
          const match = (policies || []).find((p: any) => (p.policy || p).targetKey === blockingPackage);
          const resolvedPolicyId = match ? (match.policy || match).policyId || match.id : undefined;
          if (resolvedPolicyId) {
            await useOverrideAPI(resolvedPolicyId, deviceId);
            await grantTemporaryOverrideAccess(blockingPackage, blockingAppName || blockingPackage, 5);
          }
        } catch {}
      }

      setShowBuyOverridesModal(false);
      Alert.alert('Overrides Added', `${count} override credits purchased.`, [{
        text: 'OK',
        onPress: () => navigation.navigate('DashboardScreen', { refreshAt: Date.now(), justOverriddenPackage: blockingPackage || null }),
      }]);
    } catch (error: any) {
      Alert.alert('Error', error?.message || 'Failed to purchase overrides.');
    } finally { setIsProcessing(false); }
  };

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <Modal visible={showOverrideChoice} transparent animationType="fade" onRequestClose={() => { setShowOverrideChoice(false); navigation.goBack(); }}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalIconWrap}>
              <Zap size={28} color="#F59E0B" />
            </View>
            <Text style={s.modalTitle}>No Overrides Left</Text>
            <Text style={s.modalBody}>
              {blockingAppName || 'Selected app'} reached its daily limit. Buy overrides or upgrade your plan.
            </Text>
            <TouchableOpacity style={s.modalBtnPrimary} onPress={() => { setShowOverrideChoice(false); setShowBuyOverridesModal(true); }}>
              <Text style={s.modalBtnPrimaryText}>Buy Overrides</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.modalBtnSecondary} onPress={() => setShowOverrideChoice(false)}>
              <Text style={s.modalBtnSecondaryText}>Browse Plans</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.modalBtnGhost} onPress={() => { setShowOverrideChoice(false); navigation.goBack(); }}>
              <Text style={s.modalBtnGhostText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={showBuyOverridesModal} transparent animationType="fade" onRequestClose={() => setShowBuyOverridesModal(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modalCard}>
            <View style={s.modalIconWrap}>
              <Zap size={28} color="#6366F1" />
            </View>
            <Text style={s.modalTitle}>Buy Overrides</Text>
            <Text style={s.modalBody}>Each override is $1.99. Choose a pack:</Text>
            {OVERRIDE_PACKS.map(pack => (
              <TouchableOpacity
                key={pack.count}
                style={[s.packBtn, isProcessing && s.packBtnDisabled]}
                disabled={isProcessing}
                onPress={() => handlePurchaseOverridePack(pack.count)}
                activeOpacity={0.8}
              >
                <LinearGradient colors={['#6366F1', '#4F46E5']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.packGradient}>
                  <Zap size={16} color="#FFFFFF" />
                  <Text style={s.packText}>{pack.count} Overrides</Text>
                  <Text style={s.packPrice}>${pack.total.toFixed(2)}</Text>
                </LinearGradient>
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={s.modalBtnGhost} disabled={isProcessing} onPress={() => setShowBuyOverridesModal(false)}>
              <Text style={s.modalBtnGhostText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Choose Your Plan</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator={false}>
        {subscriptionPlans.map(plan => {
          const isSelected = selectedPlanId === plan.id;
          const isCurrent = normalizePlan(plan.name) === currentUserPlan;
          const gradientColors = PLAN_GRADIENTS[plan.id] || PLAN_GRADIENTS['1'];

          return (
            <TouchableOpacity
              key={plan.id}
              activeOpacity={0.9}
              onPress={() => setSelectedPlanId(plan.id)}
              style={[s.planCard, isSelected && s.planCardSelected]}
            >
              {plan.badge && (
                <LinearGradient colors={['#F59E0B', '#D97706']} style={s.planBadge}>
                  <Text style={s.planBadgeText}>{plan.badge}</Text>
                </LinearGradient>
              )}

              <View style={s.planHeader}>
                <LinearGradient colors={gradientColors as [string, string]} style={s.planIconWrap}>
                  <Shield size={18} color="#FFFFFF" />
                </LinearGradient>
                <View style={s.planTitleWrap}>
                  <Text style={s.planName}>{plan.name}</Text>
                  <Text style={s.planPrice}>{plan.priceLabel}</Text>
                </View>
                {isCurrent && (
                  <View style={s.currentBadge}>
                    <Text style={s.currentBadgeText}>Current</Text>
                  </View>
                )}
              </View>

              <View style={s.featuresList}>
                {plan.features.map(f => (
                  <View key={f.text} style={s.featureRow}>
                    {f.enabled ? <Check size={16} color="#10B981" strokeWidth={3} /> : <X size={16} color="#CBD5E1" strokeWidth={3} />}
                    <Text style={[s.featureText, !f.enabled && s.featureDisabled]}>{f.text}</Text>
                  </View>
                ))}
              </View>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity style={s.buyOverridesCard} onPress={() => setShowBuyOverridesModal(true)} activeOpacity={0.8}>
          <Zap size={20} color="#F59E0B" />
          <View style={s.buyOverridesContent}>
            <Text style={s.buyOverridesTitle}>Need overrides?</Text>
            <Text style={s.buyOverridesDesc}>Purchase override packs at $1.99 each</Text>
          </View>
          <ChevronLeft size={16} color="#CBD5E1" style={{ transform: [{ rotate: '180deg' }] }} />
        </TouchableOpacity>

        <View style={s.trustRow}>
          <ShieldCheck size={16} color="#10B981" />
          <Text style={s.trustText}>30-day money back guarantee</Text>
        </View>

        <View style={{ height: 180 }} />
      </ScrollView>

      <View style={s.footer}>
        <View style={s.footerRow}>
          <View>
            <Text style={s.footerPlan}>{selectedPlan.name} Plan</Text>
            <Text style={s.footerPrice}>{selectedPlan.priceLabel}</Text>
          </View>
          <TouchableOpacity
            onPress={handleConfirmPay}
            disabled={isProcessing || isCurrentPlan}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={isCurrentPlan ? ['#94A3B8', '#64748B'] : ['#6366F1', '#4F46E5']}
              style={[s.footerBtn, (isProcessing || isCurrentPlan) && s.footerBtnDisabled]}
            >
              {isProcessing ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={s.footerBtnText}>{isCurrentPlan ? 'Current Plan' : 'Upgrade Now'}</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>

      <BottomNav active="settings" />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  backBtn: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  scrollContent: { padding: 20 },

  planCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 2, borderColor: '#E8ECF4', position: 'relative', shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 1 },
  planCardSelected: { borderColor: '#6366F1', backgroundColor: '#FAFAFF' },
  planBadge: { position: 'absolute', top: -8, right: 16, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10, zIndex: 10 },
  planBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  planHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 12 },
  planIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  planTitleWrap: { flex: 1 },
  planName: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  planPrice: { fontSize: 14, fontWeight: '600', color: '#6366F1', marginTop: 1 },
  currentBadge: { backgroundColor: '#F0FDF4', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#BBF7D0' },
  currentBadgeText: { fontSize: 10, fontWeight: '800', color: '#059669' },
  featuresList: { gap: 8 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  featureText: { fontSize: 13, color: '#334155', fontWeight: '500' },
  featureDisabled: { textDecorationLine: 'line-through', color: '#CBD5E1' },

  buyOverridesCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFBEB', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#FDE68A', gap: 12, marginTop: 4, marginBottom: 12 },
  buyOverridesContent: { flex: 1 },
  buyOverridesTitle: { fontSize: 14, fontWeight: '700', color: '#92400E' },
  buyOverridesDesc: { fontSize: 12, color: '#B45309', marginTop: 2 },

  trustRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 8 },
  trustText: { fontSize: 12, color: '#10B981', fontWeight: '600' },

  footer: { position: 'absolute', bottom: Platform.OS === 'ios' ? 88 : 72, left: 0, right: 0, backgroundColor: '#FFFFFF', paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 10 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerPlan: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  footerPrice: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginTop: 2 },
  footerBtn: { paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14 },
  footerBtnDisabled: { opacity: 0.7 },
  footerBtnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'center', paddingHorizontal: 24 },
  modalCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, alignItems: 'center' },
  modalIconWrap: { width: 56, height: 56, borderRadius: 18, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
  modalBody: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  modalBtnPrimary: { width: '100%', backgroundColor: '#6366F1', paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginBottom: 8 },
  modalBtnPrimaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  modalBtnSecondary: { width: '100%', backgroundColor: '#EEF2FF', paddingVertical: 14, borderRadius: 14, alignItems: 'center', marginBottom: 8 },
  modalBtnSecondaryText: { color: '#4F46E5', fontWeight: '700', fontSize: 15 },
  modalBtnGhost: { width: '100%', paddingVertical: 12, alignItems: 'center' },
  modalBtnGhostText: { color: '#94A3B8', fontWeight: '600', fontSize: 14 },
  packBtn: { width: '100%', marginBottom: 8 },
  packBtnDisabled: { opacity: 0.6 },
  packGradient: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 14, borderRadius: 14 },
  packText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14, flex: 1, marginLeft: 10 },
  packPrice: { color: 'rgba(255,255,255,0.8)', fontWeight: '800', fontSize: 14 },
});
