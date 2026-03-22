import React, { useState } from 'react';
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
  CreditCard, 
  Plus, 
  Apple, 
  Brain, 
  Sparkles, 
  LockOpen, 
  Shield, 
  Moon, 
  AlertTriangle, 
  Info, 
  BookOpen 
} from 'lucide-react-native';
import { 
  userProfile, 
  overrideConfig, 
  overrideTierLogic,
  savedPaymentMethods,
  expressCheckout,
  aiNudgeMessages,
  activeNudgeContext,
  overrideLabels
} from '../data/appData';
import { useUser } from '../context/UserContext';
import { useOverrideAPI } from '../services/limitService';

export default function ConfirmOverrideScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { user, updateUser } = useUser();
  const limitId = route?.params?.limitId;
  const deviceId = 'device_001';
  
  // Use the requested logic but can fallback safely
  const currentPlan = (userProfile.plan || "Pro") as keyof typeof overrideTierLogic;
  const tierData = overrideTierLogic[currentPlan];

  const defaultCard = savedPaymentMethods.find(c => c.isDefault);
  const [selectedCardId, setSelectedCardId] = useState(defaultCard ? defaultCard.id : savedPaymentMethods[0].id);
  const [isLoading, setIsLoading] = useState(false);

  // STEP 2 — BUILD AI NUDGE BOX
  const nudge = aiNudgeMessages.find(n => n.context === activeNudgeContext) || aiNudgeMessages[3];

  const getNudgeStyles = (severity: string) => {
    switch(severity) {
      case 'critical': return { bg: '#FEF2F2', border: '#EF4444', icon: '#EF4444', label: overrideLabels.severityCritical };
      case 'warning': return { bg: '#FFFBEB', border: '#F59E0B', icon: '#F59E0B', label: overrideLabels.severityWarning };
      default: return { bg: '#EFF6FF', border: '#3B82F6', icon: '#3B82F6', label: overrideLabels.severityInfo };
    }
  };

  const nudgeStyles = getNudgeStyles(nudge.severity);

  const getNudgeIcon = (iconName: string, color: string) => {
    switch(iconName) {
      case 'book-open': return <BookOpen size={20} color={color} />;
      case 'moon': return <Moon size={20} color={color} />;
      case 'alert-triangle': return <AlertTriangle size={20} color={color} />;
      default: return <Info size={20} color={color} />;
    }
  };

  // STEP 3 — CONFIRM & UNLOCK BUTTON logic
  const handleConfirm = async () => {
    if (!user?.uid) {
      Alert.alert('Error', 'User not logged in');
      return;
    }

    if (!limitId) {
      Alert.alert('Error', 'Missing limit id for override');
      return;
    }

    setIsLoading(true);
    try {
      const response = await useOverrideAPI(user.uid, deviceId, limitId);

      if (!response?.success) {
        Alert.alert('Error', response?.message || 'Override failed');
        return;
      }

      const remaining = response?.data?.overrides_left;
      if (typeof remaining === 'number') {
        updateUser({ overrides_left: remaining });
      }

      Alert.alert(
        overrideLabels.alertUnlockedTitle,
        response?.data?.message || 'Override applied successfully',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      console.error('Override error:', error);
      Alert.alert('Error', 'Failed to use override');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      
      {/* 1. SCREEN HEADER */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => navigation.goBack()}
        >
          <ChevronLeft size={24} color="#0F172A" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{overrideLabels.headerTitle}</Text>
          <Text style={styles.headerSubtitle}>{overrideLabels.headerSubtitle}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* 2. OVERRIDE CARD */}
        <View style={styles.card}>
          <View style={styles.cardTopSection}>
            <View style={styles.iconContainer}>
              <ShieldOff size={32} color="#6366F1" />
            </View>
            <Text style={styles.overrideTitle}>{String(overrideConfig.overrideTitle)}</Text>
            <Text style={styles.overrideDescription}>{String(overrideConfig.overrideDescription)}</Text>
          </View>

          {/* 3. DYNAMIC PRICE LOGIC */}
          <View style={styles.priceSection}>
            {tierData.isFree ? (
              <View style={styles.freeContainer}>
                <View style={styles.greenBadge}>
                  <Text style={styles.greenBadgeText}>{String(tierData.remainingLabel)}</Text>
                </View>
                <Text style={styles.priceSubtext}>{overrideLabels.freeUsageNote}</Text>
              </View>
            ) : (
              <View style={styles.paidContainer}>
                <Text style={styles.priceLabel}>{String(overrideConfig.feeLabel)}</Text>
                <Text style={styles.priceSubtext}>{overrideLabels.oneTimePaymentNote}</Text>
              </View>
            )}
          </View>

          {/* 4. EXPIRATION INFO ROW */}
          <View style={styles.expirationRow}>
            <Clock size={20} color="#F59E0B" style={styles.expirationIcon} />
            <Text style={styles.expirationText}>{String(overrideConfig.expiresLabel)}</Text>
          </View>
        </View>

        {/* STEP 2 — BUILD PAYMENT METHODS SECTION */}
        <View style={styles.paymentSection}>
          {tierData.isFree ? (
            <View style={styles.freeInfoBox}>
              <View style={styles.greenCheckCircle}>
                <Text style={styles.whiteCheck}>✓</Text>
              </View>
              <Text style={styles.freeInfoText}>{overrideLabels.noPaymentRequired}</Text>
            </View>
          ) : (
            <>
              <Text style={styles.sectionHeading}>{overrideLabels.paymentMethodTitle}</Text>
              
              {/* 1. SAVED CARDS LIST */}
              {savedPaymentMethods.map((card) => {
                const isSelected = selectedCardId === card.id;
                return (
                  <TouchableOpacity 
                    key={card.id} 
                    style={[
                      styles.cardRow, 
                      isSelected ? styles.selectedCardRow : styles.unselectedCardRow
                    ]}
                    onPress={() => setSelectedCardId(card.id)}
                  >
                    <View style={styles.cardLeft}>
                      <CreditCard size={20} color={isSelected ? "#6366F1" : "#94A3B8"} />
                      <Text style={[styles.cardType, isSelected && styles.selectedText]}>{card.type}</Text>
                    </View>
                    
                    <View style={styles.cardMiddle}>
                      <Text style={[styles.cardNumbers, isSelected && styles.selectedText]}>•••• •••• •••• {card.last4}</Text>
                      <Text style={styles.cardExpiry}>Expires {card.expiry}</Text>
                    </View>
                    
                    <View style={[styles.radioButton, isSelected ? styles.radioSelected : styles.radioUnselected]}>
                      {isSelected && <View style={styles.radioInner} />}
                    </View>
                  </TouchableOpacity>
                );
              })}

              {/* 2. ADD NEW CARD BUTTON */}
              <TouchableOpacity 
                style={styles.addNewButton} 
                onPress={() => Alert.alert(overrideLabels.alertCardEntrySoon)}
              >
                <Plus size={20} color="#94A3B8" />
                <Text style={styles.addNewText}>{overrideLabels.addNewCard}</Text>
              </TouchableOpacity>

              {/* 3. EXPRESS CHECKOUT SECTION */}
              <View style={styles.dividerContainer}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>{overrideLabels.orPayWith}</Text>
                <View style={styles.dividerLine} />
              </View>

              <View style={styles.expressCheckoutContainer}>
                {expressCheckout.showApplePay && (
                  <TouchableOpacity 
                    style={styles.applePayBtn} 
                    onPress={() => Alert.alert(overrideLabels.alertPaySheetApple)}
                  >
                    <Apple size={20} color="#FFFFFF" fill="#FFFFFF" />
                    <Text style={styles.applePayText}> Pay</Text>
                  </TouchableOpacity>
                )}

                {expressCheckout.showGooglePay && (
                  <TouchableOpacity 
                    style={styles.googlePayBtn} 
                    onPress={() => Alert.alert(overrideLabels.alertPaySheetGoogle)}
                  >
                    <View style={styles.googleIconPlaceholder}>
                      <Text style={styles.googleG}>G</Text>
                    </View>
                    <Text style={styles.googlePayText}>Google Pay</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </View>

        {/* STEP 2 — BUILD AI NUDGE BOX */}
        <View style={[
          styles.nudgeBox, 
          { backgroundColor: nudgeStyles.bg, borderLeftColor: nudgeStyles.border }
        ]}>
          <View style={styles.nudgeHeader}>
            <View style={styles.nudgeTitleRow}>
              <Brain size={16} color={nudgeStyles.icon} />
              <Text style={styles.nudgeTitle}>{overrideLabels.aiInsightTitle}</Text>
            </View>
            <View style={[styles.severityBadge, { backgroundColor: nudgeStyles.icon + '20' }]}>
              <Text style={[styles.severityText, { color: nudgeStyles.icon }]}>{nudgeStyles.label}</Text>
            </View>
          </View>
          
          <View style={styles.nudgeBody}>
            {getNudgeIcon(nudge.icon, nudgeStyles.icon)}
            <Text style={styles.nudgeMessage}>{nudge.message}</Text>
          </View>

          <Text style={styles.nudgeFooter}>
            {overrideLabels.aiPoweredBy}{nudge.context}
          </Text>
        </View>

        {/* STEP 3 — CONFIRM & UNLOCK BUTTON */}
        <TouchableOpacity 
          style={[
            styles.confirmBtn, 
            { backgroundColor: tierData.isFree ? '#10B981' : '#6366F1' },
            isLoading && styles.btnDisabled
          ]}
          onPress={handleConfirm}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <LockOpen size={20} color="#FFFFFF" style={styles.btnIcon} />
              <Text style={styles.confirmBtnText}>
                {tierData.isFree 
                  ? overrideLabels.btnFree 
                  : `${overrideLabels.btnPaidPrefix}${overrideConfig.feeLabel}${overrideLabels.btnPaidSuffix}`
                }
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* STEP 4 — SECURITY FOOTER */}
        <View style={styles.securityFooter}>
          <View style={styles.securityRow}>
            <Shield size={14} color="#9CA3AF" />
            <Text style={styles.securityText}>{overrideLabels.securityMain}</Text>
          </View>
          <Text style={styles.encryptionText}>{overrideLabels.securitySub}</Text>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* 5. STICKY BOTTOM NAV BAR */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>🏠</Text>
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>📊</Text>
          <Text style={styles.navLabel}>Usage</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={styles.navIcon}>⚙️</Text>
          <Text style={styles.navLabel}>Settings</Text>
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
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 12 : 12,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  headerTitleContainer: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  scrollContent: {
    padding: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 5,
  },
  cardTopSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  overrideTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  overrideDescription: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
  },
  priceSection: {
    alignItems: 'center',
    marginBottom: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#F1F5F9',
  },
  freeContainer: {
    alignItems: 'center',
  },
  greenBadge: {
    backgroundColor: '#DCFCE7',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    marginBottom: 8,
  },
  greenBadgeText: {
    color: '#10B981',
    fontWeight: '700',
    fontSize: 14,
  },
  paidContainer: {
    alignItems: 'center',
  },
  priceLabel: {
    fontSize: 28,
    fontWeight: '800',
    color: '#6366F1',
    marginBottom: 4,
  },
  priceSubtext: {
    fontSize: 12,
    color: '#94A3B8',
  },
  expirationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    borderWidth: 1,
    borderColor: '#FDE68A',
    borderRadius: 10,
    padding: 12,
  },
  expirationIcon: {
    marginRight: 10,
  },
  expirationText: {
    fontSize: 14,
    color: '#92400E',
    fontWeight: '500',
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    justifyContent: 'space-between',
    paddingBottom: Platform.OS === 'ios' ? 34 : 24,
  },
  navItem: {
    alignItems: 'center',
    flex: 1,
  },
  navIcon: {
    fontSize: 20,
    marginBottom: 4,
    color: '#94A3B8',
  },
  navLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  paymentSection: {
    marginTop: 24,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 16,
  },
  freeInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DCFCE7',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#86EFAC',
  },
  greenCheckCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10B981',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  whiteCheck: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 14,
  },
  freeInfoText: {
    flex: 1,
    fontSize: 14,
    color: '#065F46',
    fontWeight: '600',
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
  },
  selectedCardRow: {
    borderColor: '#6366F1',
    backgroundColor: '#EEF2FF',
    borderWidth: 2,
  },
  unselectedCardRow: {
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  cardLeft: {
    marginRight: 12,
    alignItems: 'center',
  },
  cardType: {
    fontSize: 10,
    fontWeight: '700',
    color: '#94A3B8',
    marginTop: 2,
  },
  cardMiddle: {
    flex: 1,
  },
  cardNumbers: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  cardExpiry: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  selectedText: {
    color: '#6366F1',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: '#6366F1',
  },
  radioUnselected: {
    borderColor: '#D1D5DB',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#6366F1',
  },
  addNewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#D1D5DB',
    marginBottom: 24,
  },
  addNewText: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
  expressCheckoutContainer: {
    gap: 12,
  },
  applePayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    backgroundColor: '#000000',
    borderRadius: 12,
  },
  applePayText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  googlePayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 52,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  googlePayText: {
    color: '#3C4043',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  googleIconPlaceholder: {
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  googleG: {
    fontSize: 18,
    fontWeight: '900',
    color: '#4285F4',
  },
  nudgeBox: {
    marginTop: 24,
    borderRadius: 14,
    padding: 16,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  nudgeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  nudgeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nudgeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  severityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  severityText: {
    fontSize: 10,
    fontWeight: '800',
  },
  nudgeBody: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  nudgeMessage: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#1E293B',
    lineHeight: 20,
  },
  nudgeFooter: {
    fontSize: 10,
    color: '#94A3B8',
    fontWeight: '500',
  },
  confirmBtn: {
    marginTop: 32,
    height: 56,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  btnDisabled: {
    opacity: 0.7,
  },
  btnIcon: {
    marginRight: 10,
  },
  confirmBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  securityFooter: {
    marginTop: 24,
    alignItems: 'center',
    paddingBottom: 40,
  },
  securityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  securityText: {
    fontSize: 11,
    color: '#9CA3AF',
    fontWeight: '600',
  },
  encryptionText: {
    fontSize: 10,
    color: '#D1D5DB',
    fontWeight: '500',
  },
});
