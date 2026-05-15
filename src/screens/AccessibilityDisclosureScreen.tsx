import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  AppState,
  type AppStateStatus,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Globe, Check } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LimitterModule } from '../config/nativeModules';
import { checkPermissions } from '../services/permissionsService';

const CONSENT_KEY = '@limitter/accessibility_disclosure_accepted';

export async function isAccessibilityDisclosureAccepted(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(CONSENT_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return !!(parsed && parsed.accepted === true);
  } catch {
    return false;
  }
}

async function saveAcceptance(): Promise<void> {
  await AsyncStorage.setItem(
    CONSENT_KEY,
    JSON.stringify({ accepted: true, acceptedAtMs: Date.now() }),
  );
}

function waitForNextForeground(): Promise<void> {
  return new Promise((resolve) => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        sub.remove();
        resolve();
      }
    });
  });
}

async function openAndWaitForAccessibility(): Promise<boolean> {
  const waiter = waitForNextForeground();
  if (LimitterModule?.openAccessibilitySettings) {
    await LimitterModule.openAccessibilitySettings();
  }
  await waiter;
  const status = await checkPermissions();
  return status.accessibility;
}

interface Props {
  onComplete: (granted: boolean) => void;
  onDecline: () => void;
}

const AccessibilityDisclosureScreen: React.FC<Props> = ({ onComplete, onDecline }) => {
  const [agreed, setAgreed] = useState(false);
  const [previouslyAccepted, setPreviouslyAccepted] = useState(false);

  useEffect(() => {
    isAccessibilityDisclosureAccepted().then(setPreviouslyAccepted);
  }, []);

  const handleAccept = async () => {
    if (!previouslyAccepted && !agreed) return;

    if (!previouslyAccepted) {
      await saveAcceptance();
    }

    const granted = await openAndWaitForAccessibility();
    onComplete(granted);
  };

  if (previouslyAccepted) {
    return (
      <SafeAreaView style={s.container} edges={['top', 'left', 'right']}>
        <StatusBar barStyle="light-content" backgroundColor="#059669" />
        <LinearGradient colors={['#10B981', '#059669', '#0F172A']} style={s.headerGradient}>
          <View style={s.headerInner}>
            <View style={s.iconWrap}>
              <Globe size={28} color="#FFFFFF" />
            </View>
            <Text style={s.headerTitle}>Accessibility Service Disabled</Text>
            <Text style={s.headerSubtitle}>
              Website limits require the Accessibility Service to be enabled
            </Text>
          </View>
        </LinearGradient>

        <View style={s.reEnableBody}>
          <View style={s.section}>
            <Text style={s.sectionBody}>
              You previously agreed to the Accessibility Service disclosure, but the service is currently disabled. Website time limits cannot work without it.
            </Text>
          </View>
          <View style={s.section}>
            <Text style={s.sectionBody}>
              Tap the button below to open settings and re-enable the Accessibility Service for Limitter.
            </Text>
          </View>
        </View>

        <View style={s.footer}>
          <TouchableOpacity
            onPress={handleAccept}
            activeOpacity={0.85}
            style={s.acceptBtn}
          >
            <Text style={s.acceptBtnText}>Open Settings & Enable</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onDecline}
            activeOpacity={0.85}
            style={s.declineBtn}
          >
            <Text style={s.declineBtnText}>Not Now</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor="#059669" />
      <LinearGradient colors={['#10B981', '#059669', '#0F172A']} style={s.headerGradient}>
        <View style={s.headerInner}>
          <View style={s.iconWrap}>
            <Globe size={28} color="#FFFFFF" />
          </View>
          <Text style={s.headerTitle}>Website Monitoring Disclosure</Text>
          <Text style={s.headerSubtitle}>
            Required before enabling website time limits
          </Text>
        </View>
      </LinearGradient>

      <ScrollView style={s.scroll} contentContainerStyle={s.scrollContent} showsVerticalScrollIndicator>
        <View style={s.section}>
          <Text style={s.sectionTitle}>What data does Limitter access?</Text>
          <Text style={s.sectionBody}>
            Limitter uses Android's Accessibility Service to read the URL (web address) displayed in your browser's address bar. This is the only data accessed through this permission.
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>How is this data used?</Text>
          <Text style={s.sectionBody}>
            The URLs are compared against the website time limits you have set. When your usage reaches a limit, Limitter blocks access to that website until the next daily reset or until you use an override credit. URLs are processed locally on your device and are not sent to any external server.
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Is my data shared?</Text>
          <Text style={s.sectionBody}>
            No. Browser URLs accessed through the Accessibility Service are never shared with third parties, never uploaded, and never used for advertising, analytics, or any purpose other than enforcing the limits you create.
          </Text>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>What if I decline?</Text>
          <Text style={s.sectionBody}>
            If you choose not to enable this permission, Limitter will still work for app-level time limits. Only website-specific limits require the Accessibility Service.
          </Text>
        </View>
      </ScrollView>

      <View style={s.footer}>
        <TouchableOpacity
          style={s.checkboxRow}
          activeOpacity={0.8}
          onPress={() => setAgreed((prev) => !prev)}
        >
          <View style={[s.checkbox, agreed && s.checkboxChecked]}>
            {agreed && <Check size={14} color="#FFFFFF" strokeWidth={3} />}
          </View>
          <Text style={s.checkboxLabel}>
            I understand and agree to enable the Accessibility Service for website monitoring
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleAccept}
          activeOpacity={0.85}
          disabled={!agreed}
          style={[s.acceptBtn, !agreed && s.acceptBtnDisabled]}
        >
          <Text style={s.acceptBtnText}>Agree & Enable</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={onDecline}
          activeOpacity={0.85}
          style={s.declineBtn}
        >
          <Text style={s.declineBtnText}>No Thanks</Text>
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
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginBottom: 6 },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.8)', textAlign: 'center' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 16 },
  reEnableBody: { flex: 1, padding: 20, justifyContent: 'center' },
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
    marginBottom: 10,
  },
  acceptBtnDisabled: { backgroundColor: '#A7F3D0' },
  acceptBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  declineBtn: {
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtnText: { color: '#64748B', fontWeight: '600', fontSize: 14 },
});

export default AccessibilityDisclosureScreen;
