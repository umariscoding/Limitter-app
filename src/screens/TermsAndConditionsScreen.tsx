import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, ShieldCheck } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { showAlert } from '../components/AppAlert';

// Account-scoped storage key. Each account has its own acceptance state on
// this device — switching accounts on the same device shows the screen again.
export const termsAcceptedKey = (accountId: string) => `@limitter/terms_accepted/${accountId}`;

export async function isTermsAcceptedForAccount(accountId: string): Promise<boolean> {
  if (!accountId) return false;
  try {
    const raw = await AsyncStorage.getItem(termsAcceptedKey(accountId));
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return !!(parsed && parsed.accepted === true);
  } catch {
    return false;
  }
}

interface Props {
  accountId: string;
  onAccept: () => void;
}

const TERMS_SECTIONS: Array<{ title: string; body: string }> = [
  {
    title: '1. Acceptance of Terms',
    body:
      'By installing and using Limitter, you agree to be bound by these Terms and Conditions. If you do not agree, please uninstall the app and discontinue use.',
  },
  {
    title: '2. Service Description',
    body:
      'Limitter helps you set daily usage limits for apps and websites across your devices. The service syncs limits, usage, and lock state between your registered devices.',
  },
  {
    title: '3. Account & Devices',
    body:
      'You must create an account to use Limitter. Each account may register multiple devices. You are responsible for keeping your credentials secure and for all activity on your account.',
  },
  {
    title: '4. Limits & Overrides',
    body:
      'Once a daily limit is reached, the app or website is blocked until the next daily reset. To regain access early, you may use an override credit. Overrides are part of the paid product and may be subject to plan-specific quotas.',
  },
  {
    title: '5. Subscriptions & Billing',
    body:
      'Paid plans grant additional override credits and features. Billing is handled by your platform store (Google Play / App Store). Plan changes and refunds follow the store\'s billing policies.',
  },
  {
    title: '6. Permissions',
    body:
      'Limitter requires Accessibility, Usage Stats, and Notification permissions to enforce limits on Android. These permissions are used solely to track and enforce the limits you create — never to collect data unrelated to the service.',
  },
  {
    title: '7. Data & Privacy',
    body:
      'We store account, device, policy, usage, and override data necessary to operate the service. We do not sell your data. Refer to the in-app Privacy section for full details on what is collected and how it is used.',
  },
  {
    title: '8. Acceptable Use',
    body:
      'You agree not to attempt to bypass, tamper with, or reverse-engineer the limit enforcement mechanism, or to use the service in any way that violates applicable laws.',
  },
  {
    title: '9. Disclaimer',
    body:
      'Limitter is provided "as is" without warranties of any kind. We are not liable for any indirect or consequential losses arising from use of the service or from limits failing to enforce due to OS-level restrictions.',
  },
  {
    title: '10. Changes to Terms',
    body:
      'We may update these Terms from time to time. Continued use of the app after an update constitutes acceptance of the revised Terms.',
  },
];

const TermsAndConditionsScreen: React.FC<Props> = ({ accountId, onAccept }) => {
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleAccept = async () => {
    if (submitting) return;
    if (!agreed) {
      showAlert(
        'Agreement Required',
        'Please tick the checkbox to confirm you have read and agree to the Terms & Conditions before continuing.',
      );
      return;
    }
    setSubmitting(true);
    try {
      await AsyncStorage.setItem(termsAcceptedKey(accountId), JSON.stringify({
        accepted: true,
        acceptedAtMs: Date.now(),
        accountId,
        version: 1,
      }));
      onAccept();
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={s.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#059669" />
      <LinearGradient colors={['#10B981', '#059669', '#0F172A']} style={s.headerGradient}>
        <View style={s.headerInner}>
          <View style={s.iconWrap}>
            <ShieldCheck size={28} color="#FFFFFF" />
          </View>
          <Text style={s.headerTitle}>Terms & Conditions</Text>
          <Text style={s.headerSubtitle}>
            Please read and accept to start using Limitter
          </Text>
        </View>
      </LinearGradient>

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollContent}
        showsVerticalScrollIndicator
      >
        {TERMS_SECTIONS.map(section => (
          <View key={section.title} style={s.section}>
            <Text style={s.sectionTitle}>{section.title}</Text>
            <Text style={s.sectionBody}>{section.body}</Text>
          </View>
        ))}
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity
          style={s.checkboxRow}
          activeOpacity={0.8}
          onPress={() => setAgreed(prev => !prev)}
        >
          <View style={[s.checkbox, agreed && s.checkboxChecked]}>
            {agreed && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
          </View>
          <Text style={s.checkboxLabel}>
            I have read and agree to the Terms & Conditions
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleAccept}
          disabled={submitting}
          activeOpacity={0.85}
          style={[s.acceptBtn, submitting && s.acceptBtnDisabled]}
        >
          {submitting ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={s.acceptBtnText}>Accept & Continue</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  headerGradient: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 },
  headerInner: { alignItems: 'center' },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF', marginBottom: 6 },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },

  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 16 },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8ECF4',
  },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 6 },
  sectionBody: { fontSize: 13, color: '#475569', lineHeight: 19 },

  footer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkboxChecked: { backgroundColor: '#10B981', borderColor: '#10B981' },
  checkboxLabel: { flex: 1, fontSize: 13, color: '#334155', fontWeight: '600' },

  acceptBtn: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtnDisabled: { backgroundColor: '#A7F3D0' },
  acceptBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});

export default TermsAndConditionsScreen;
