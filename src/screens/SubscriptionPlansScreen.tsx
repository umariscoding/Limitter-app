import React, { useState } from 'react';
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
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Check, X, Smartphone, Plus, Minus, ShieldCheck, Lock } from 'lucide-react-native';
import { 
  subscriptionPlans, 
  addonPricing, 
  trustSignals, 
  planDetails,
  subscriptionLabels
} from '../data/appData';

// Memoized feature item for max performance
const FeatureItem = React.memo(({ feature }: { feature: { text: string; enabled: boolean } }) => (
  <View style={styles.featureRow}>
    {feature.enabled ? (
      <Check size={18} color="#10B981" strokeWidth={3} />
    ) : (
      <X size={18} color="#94A3B8" strokeWidth={3} />
    )}
    <Text
      style={[
        styles.featureText,
        !feature.enabled && styles.disabledFeatureText,
      ]}
    >
      {feature.text}
    </Text>
  </View>
));

export default function SubscriptionPlansScreen() {
  const navigation = useNavigation<any>();
  const [selectedPlanId, setSelectedPlanId] = useState('2'); // Default to Pro ID
  const [extraDevices, setExtraDevices] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const selectedPlan = subscriptionPlans.find(p => p.id === selectedPlanId) || subscriptionPlans[1];
  const extraDevicesCost = extraDevices * addonPricing.extraDevicePricePerUnit;
  const totalMonthly = selectedPlan.price + extraDevicesCost;

  const currentIndex = subscriptionPlans.findIndex(
    p => p.name === planDetails.currentPlan
  );
  const nextPlan = subscriptionPlans[currentIndex + 1];
  const upgradeLabel = nextPlan 
    ? subscriptionLabels.upgradePrefix + nextPlan.name 
    : subscriptionLabels.topPlanBadge;

  const handleConfirmPay = () => {
    Keyboard.dismiss();
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      Alert.alert(
        subscriptionLabels.alertActivatedTitle,
        `${subscriptionLabels.alertActivatedMsg}${selectedPlan.name} plan.`,
        [{ 
          text: subscriptionLabels.btnDashboard, 
          onPress: () => navigation.navigate('ControlPlansScreen', { activePlan: selectedPlan.name })
        }]
      );
    }, 1500); 
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <ChevronLeft size={28} color="#0F172A" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{subscriptionLabels.headerTitle}</Text>
          <Text style={styles.headerSubtitle}>{subscriptionLabels.headerSubtitle}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* PLAN CARDS */}
        {subscriptionPlans.map((plan) => {
          const isSelected = selectedPlanId === plan.id;
          return (
            <TouchableOpacity
              key={plan.id}
              activeOpacity={0.9}
              onPress={() => setSelectedPlanId(plan.id)}
              style={[
                styles.planCard,
                isSelected ? styles.selectedCard : styles.unselectedCard,
                plan.id === '3' && { overflow: 'visible' }
              ]}
            >
              {plan.badge && (
                <View style={styles.eliteBadge}>
                  <Text style={styles.badgeText}>{plan.badge}</Text>
                </View>
              )}
              
              <Text style={styles.planTitle}>{plan.name}</Text>
              <Text style={styles.planPrice}>{plan.priceLabel}</Text>
              
              <View style={styles.divider} />
              
              <View style={styles.featuresList}>
                {plan.features.map((f) => (
                  <FeatureItem key={f.text} feature={f} />
                ))}
              </View>
            </TouchableOpacity>
          );
        })}

        {/* ADD-ONS SECTION */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{subscriptionLabels.addOnsTitle}</Text>
        </View>

        <View style={styles.addOnCard}>
          <View style={styles.addOnLeft}>
            <View style={styles.addOnIconContainer}>
              <Smartphone size={24} color="#4F46E5" />
            </View>
            <View>
              <Text style={styles.addOnLabel}>{addonPricing.extraDeviceLabel}</Text>
              <Text style={styles.addOnSubtext}>${addonPricing.extraDevicePricePerUnit}{subscriptionLabels.deviceMo}</Text>
            </View>
          </View>

          <View style={styles.counterContainer}>
            <TouchableOpacity 
              style={[styles.counterBtn, (extraDevices === 0 || isProcessing) && styles.counterBtnDisabled]}
              onPress={() => setExtraDevices(Math.max(0, extraDevices - 1))}
              disabled={extraDevices === 0 || isProcessing}
            >
              <Minus size={20} color={extraDevices === 0 ? "#94A3B8" : "#4F46E5"} />
            </TouchableOpacity>
            
            <View style={styles.countValueContainer}>
              <Text style={styles.countValue}>{extraDevices}</Text>
            </View>

            <TouchableOpacity 
              style={[styles.counterBtn, (extraDevices === addonPricing.maxExtraDevices || isProcessing) && styles.counterBtnDisabled]}
              onPress={() => setExtraDevices(Math.min(addonPricing.maxExtraDevices, extraDevices + 1))}
              disabled={extraDevices === addonPricing.maxExtraDevices || isProcessing}
            >
              <Plus size={20} color={extraDevices === addonPricing.maxExtraDevices ? "#94A3B8" : "#4F46E5"} />
            </TouchableOpacity>
          </View>
        </View>

        {/* TRUST SIGNAL BANNERS */}
        <View style={styles.trustSection}>
          {trustSignals.map((signal) => (
            <View 
              key={signal.id} 
              style={[styles.trustBannerShared, { backgroundColor: signal.bgColor, borderColor: signal.bgColor }]}
            >
              {signal.icon === 'shield-check' ? (
                <ShieldCheck size={20} color={signal.iconColor} />
              ) : (
                <Lock size={20} color={signal.iconColor} />
              )}
              <View style={styles.trustContent}>
                <Text style={[styles.trustTitleShared, { color: signal.iconColor }]}>{signal.title}</Text>
                <Text style={styles.trustSubtitle}>{signal.subtitle}</Text>
              </View>
            </View>
          ))}
        </View>
        
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* DYNAMIC PRICING FOOTER */}
      <View style={styles.pricingFooter}>
        <View style={styles.pricingRow}>
          <View>
            <Text style={styles.totalLabel}>{subscriptionLabels.totalMonthlyLabel}</Text>
            <Text style={styles.breakdownText}>
              {selectedPlan.name} Plan ${selectedPlan.price.toFixed(2)}
              {extraDevices > 0 ? `${subscriptionLabels.extraDevicesSuffix}${extraDevices} $${extraDevicesCost.toFixed(2)}` : ''}
            </Text>
          </View>
          <Text style={styles.totalAmount}>${totalMonthly.toFixed(2)}{subscriptionLabels.mo}</Text>
        </View>

        <TouchableOpacity 
          style={[styles.payButton, isProcessing && styles.payButtonDisabled]}
          onPress={handleConfirmPay}
          disabled={isProcessing}
          activeOpacity={0.8}
        >
          {isProcessing ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <>
              <ShieldCheck size={20} color="#FFF" style={{ marginRight: 8 }} />
              <Text style={styles.payButtonText}>{upgradeLabel}</Text>
              <Text style={styles.arrowIcon}>→</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 12 : 12,
    paddingBottom: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    padding: 4,
    zIndex: 10,
  },
  headerTitleContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
    textAlign: 'center',
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  planCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    borderWidth: 2,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  selectedCard: {
    borderColor: '#4F46E5',
    backgroundColor: '#F5F3FF',
  },
  unselectedCard: {
    borderColor: '#E2E8F0',
  },
  planTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#1E293B',
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 20,
    fontWeight: '600',
    color: '#4F46E5',
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginBottom: 16,
  },
  featuresList: {
    gap: 12,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 15,
    color: '#334155',
    fontWeight: '500',
  },
  disabledFeatureText: {
    textDecorationLine: 'line-through',
    color: '#94A3B8',
  },
  eliteBadge: {
    position: 'absolute',
    top: -10,
    right: -10,
    backgroundColor: '#8B5CF6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    zIndex: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  sectionHeader: {
    marginTop: 10,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  addOnCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  addOnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  addOnIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F5F3FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addOnLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  addOnSubtext: {
    fontSize: 13,
    color: '#64748B',
  },
  counterContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  counterBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  counterBtnDisabled: {
    backgroundColor: '#F1F5F9',
    opacity: 0.5,
  },
  countValueContainer: {
    paddingHorizontal: 12,
  },
  countValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  trustSection: {
    marginTop: 24,
    gap: 12,
  },
  trustBannerShared: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 12,
  },
  trustContent: {
    flex: 1,
  },
  trustTitleShared: {
    fontSize: 15,
    fontWeight: '700',
  },
  trustSubtitle: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  pricingFooter: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 20,
  },
  pricingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  totalLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  totalAmount: {
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  breakdownText: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  payButton: {
    backgroundColor: '#4F46E5',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 16,
    gap: 8,
  },
  payButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  payButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  arrowIcon: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginLeft: 4,
  },
});
