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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Check, X, Smartphone, Plus, Minus, ShieldCheck, Lock } from 'lucide-react-native';

const PLANS = [
  {
    id: 'free',
    title: 'Free',
    price: 0,
    priceLabel: '$0 / mo',
    features: [
      { text: '1 Device', enabled: true },
      { text: 'Standard Overrides', enabled: true },
      { text: 'Basic Blocking', enabled: true },
      { text: 'Web Filtering', enabled: true },
      { text: 'Custom Overrides', enabled: false },
      { text: 'Advanced Tracking', enabled: false },
    ],
    badge: null,
  },
  {
    id: 'pro',
    title: 'Pro',
    price: 9.99,
    priceLabel: '$9.99 / mo',
    features: [
      { text: 'Up to 5 Devices', enabled: true },
      { text: '3 Instant Overrides/day', enabled: true },
      { text: 'Advanced Tracking', enabled: true },
      { text: 'Custom Overrides', enabled: true },
      { text: 'Web Filtering', enabled: true },
      { text: 'AI Insights', enabled: false },
      { text: 'Geo-Fencing', enabled: false },
    ],
    badge: null,
  },
  {
    id: 'elite',
    title: 'Elite',
    price: 19.99,
    priceLabel: '$19.99 / mo',
    features: [
      { text: 'Unlimited Devices', enabled: true },
      { text: 'Unlimited Overrides', enabled: true },
      { text: 'AI Insights', enabled: true },
      { text: 'Geo-Fencing', enabled: true },
      { text: 'Custom Overrides', enabled: true },
      { text: '24/7 Priority Support', enabled: true },
    ],
    badge: 'Most Popular',
  },
];

const DEVICE_PRICE = 2.99;

export default function SubscriptionPlansScreen() {
  const navigation = useNavigation<any>();
  const [selectedPlanId, setSelectedPlanId] = useState('pro');
  const [extraDevices, setExtraDevices] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const selectedPlan = PLANS.find(p => p.id === selectedPlanId) || PLANS[1];
  const extraDevicesCost = extraDevices * DEVICE_PRICE;
  const totalMonthly = selectedPlan.price + extraDevicesCost;

  const handleConfirmPay = () => {
    setIsProcessing(true);
    
    // Step 1: Mock 1.5s loading
    setTimeout(() => {
      setIsProcessing(false);
      
      // Step 2: Show success alert
      Alert.alert(
        "Plan Activated!",
        `You are now on the ${selectedPlan.title} plan.`,
        [
          { 
            text: "Go to Dashboard", 
            onPress: () => {
              // Step 3: Navigate back with params
              navigation.navigate('ControlPlansScreen', { 
                activePlan: selectedPlan.title === 'Elite' ? 'Business' : selectedPlan.title 
              });
            }
          }
        ]
      );
    }, 1500);
  };

  const renderFeature = (feature: { text: string; enabled: boolean }) => (
    <View key={feature.text} style={styles.featureRow}>
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
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />
      
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.navigate('ControlPlansScreen')}
        >
          <ChevronLeft size={28} color="#0F172A" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>Choose Your Plan</Text>
          <Text style={styles.headerSubtitle}>Scale your digital wellness control</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView 
        style={styles.scrollContainer}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* PLAN CARDS */}
        {PLANS.map((plan) => {
          const isSelected = selectedPlanId === plan.id;
          return (
            <TouchableOpacity
              key={plan.id}
              activeOpacity={0.9}
              onPress={() => setSelectedPlanId(plan.id)}
              style={[
                styles.planCard,
                isSelected ? styles.selectedCard : styles.unselectedCard,
                plan.id === 'elite' && { overflow: 'visible' } // Ensure badge isn't clipped
              ]}
            >
              {plan.badge && (
                <View style={styles.eliteBadge}>
                  <Text style={styles.badgeText}>{plan.badge}</Text>
                </View>
              )}
              
              <Text style={styles.planTitle}>{plan.title}</Text>
              <Text style={styles.planPrice}>{plan.priceLabel}</Text>
              
              <View style={styles.divider} />
              
              <View style={styles.featuresList}>
                {plan.features.map(renderFeature)}
              </View>
            </TouchableOpacity>
          );
        })}

        {/* ADD-ONS SECTION */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Add-Ons</Text>
        </View>

        <View style={styles.addOnCard}>
          <View style={styles.addOnLeft}>
            <View style={styles.addOnIconContainer}>
              <Smartphone size={24} color="#4F46E5" />
            </View>
            <View>
              <Text style={styles.addOnLabel}>Extra Child Devices</Text>
              <Text style={styles.addOnSubtext}>${DEVICE_PRICE} / device / mo</Text>
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
              style={[styles.counterBtn, (extraDevices === 10 || isProcessing) && styles.counterBtnDisabled]}
              onPress={() => setExtraDevices(Math.min(10, extraDevices + 1))}
              disabled={extraDevices === 10 || isProcessing}
            >
              <Plus size={20} color={extraDevices === 10 ? "#94A3B8" : "#4F46E5"} />
            </TouchableOpacity>
          </View>
        </View>

        {/* TRUST SIGNAL BANNERS */}
        <View style={styles.trustSection}>
          <View style={styles.trustBannerGreen}>
            <ShieldCheck size={20} color="#15803D" />
            <View style={styles.trustContent}>
              <Text style={styles.trustTitleGreen}>30-Day Money Back Guarantee</Text>
              <Text style={styles.trustSubtext}>No questions asked. Cancel anytime.</Text>
            </View>
          </View>

          <View style={styles.trustBannerBlue}>
            <Lock size={20} color="#1D4ED8" />
            <View style={styles.trustContent}>
              <Text style={styles.trustTitleBlue}>Secure Stripe Payment</Text>
              <Text style={styles.trustSubtext}>Your payment info is encrypted and never stored.</Text>
            </View>
          </View>
        </View>
        
        {/* Spacer for scroll content */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* DYNAMIC PRICING FOOTER */}
      <View style={styles.pricingFooter}>
        <View style={styles.pricingRow}>
          <View>
            <Text style={styles.totalLabel}>Total Monthly</Text>
            <Text style={styles.breakdownText}>
              {selectedPlan.title} Plan ${selectedPlan.price.toFixed(2)}
              {extraDevices > 0 ? ` + ${extraDevices} Extra Devices $${extraDevicesCost.toFixed(2)}` : ''}
              {selectedPlan.id === 'free' && extraDevices === 0 ? ' (Base Plan)' : ''}
            </Text>
          </View>
          <Text style={styles.totalAmount}>${totalMonthly.toFixed(2)} / mo</Text>
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
              <Text style={styles.payButtonText}>Confirm & Pay</Text>
              <Text style={styles.arrowIcon}>→</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* STICKY BOTTOM NAV BAR */}
      <View style={styles.bottomNav}>
        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => navigation.navigate('DashboardScreen')}
        >
          <Text style={styles.navEmoji}>🏠</Text>
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navItem} 
          onPress={() => navigation.navigate('UsageScreen')}
        >
          <Text style={styles.navEmoji}>📊</Text>
          <Text style={styles.navLabel}>Usage</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => navigation.navigate('SettingsScreen')}
        >
          <Text style={[styles.navEmoji, styles.activeNavEmoji]}>⚙️</Text>
          <Text style={[styles.navLabel, styles.activeNavLabel]}>Settings</Text>
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
    paddingVertical: 12,
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
  trustBannerGreen: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0FDF4',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DCF7E3',
    gap: 12,
  },
  trustBannerBlue: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EFF6FF',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DBEAFE',
    gap: 12,
  },
  trustContent: {
    flex: 1,
  },
  trustTitleGreen: {
    fontSize: 15,
    fontWeight: '700',
    color: '#166534',
  },
  trustTitleBlue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E40AF',
  },
  trustSubtext: {
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
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    justifyContent: 'space-between',
    paddingBottom: 24,
  },
  navItem: {
    alignItems: 'center',
    flex: 1,
  },
  navEmoji: {
    fontSize: 22,
    marginBottom: 4,
    opacity: 0.4,
  },
  activeNavEmoji: {
    opacity: 1,
  },
  navLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  activeNavLabel: {
    color: '#4F46E5',
  },
});
