import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import {
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Info,
  XCircle,
} from 'lucide-react-native';

type AlertVariant = 'error' | 'success' | 'warning' | 'info' | 'confirm';

interface AlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

interface AlertConfig {
  title: string;
  message?: string;
  variant?: AlertVariant;
  buttons?: AlertButton[];
}

type AlertListener = (config: AlertConfig | null) => void;

let globalListener: AlertListener | null = null;

export function showAlert(
  title: string,
  message?: string,
  buttons?: AlertButton[],
  variant?: AlertVariant,
) {
  const resolved = variant || inferVariant(title, buttons);
  globalListener?.({ title, message, variant: resolved, buttons });
}

function inferVariant(title: string, buttons?: AlertButton[]): AlertVariant {
  const t = title.toLowerCase();
  if (t.includes('error') || t.includes('failed')) return 'error';
  if (t.includes('success') || t.includes('activated') || t.includes('sent') || t.includes('updated')) return 'success';
  if (t.includes('warning') || t.includes('validation') || t.includes('limit reached') || t.includes('already')) return 'warning';
  if (buttons?.some(b => b.style === 'destructive')) return 'confirm';
  if (buttons && buttons.length > 1) return 'confirm';
  return 'info';
}

const VARIANT_CONFIG = {
  error: { color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', Icon: XCircle },
  success: { color: '#059669', bg: '#ECFDF5', border: '#A7F3D0', Icon: CheckCircle2 },
  warning: { color: '#D97706', bg: '#FFFBEB', border: '#FDE68A', Icon: AlertTriangle },
  info: { color: '#4F46E5', bg: '#EEF2FF', border: '#C7D2FE', Icon: Info },
  confirm: { color: '#0F172A', bg: '#F8FAFC', border: '#E2E8F0', Icon: AlertCircle },
};

export function AppAlertProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AlertConfig | null>(null);
  const scaleAnim = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    globalListener = setConfig;
    return () => { globalListener = null; };
  }, []);

  useEffect(() => {
    if (config) {
      scaleAnim.setValue(0.85);
      opacityAnim.setValue(0);
      Animated.parallel([
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 120, friction: 8 }),
        Animated.timing(opacityAnim, { toValue: 1, useNativeDriver: true, duration: 150 }),
      ]).start();
    }
  }, [config]);

  const dismiss = (onPress?: () => void) => {
    Animated.parallel([
      Animated.timing(scaleAnim, { toValue: 0.85, useNativeDriver: true, duration: 120 }),
      Animated.timing(opacityAnim, { toValue: 0, useNativeDriver: true, duration: 120 }),
    ]).start(() => {
      setConfig(null);
      onPress?.();
    });
  };

  if (!config) return <>{children}</>;

  const v = VARIANT_CONFIG[config.variant || 'info'];
  const buttons = config.buttons?.length ? config.buttons : [{ text: 'OK', style: 'default' as const }];

  return (
    <>
      {children}
      <Modal visible transparent animationType="none" statusBarTranslucent>
        <Animated.View style={[s.overlay, { opacity: opacityAnim }]}>
          <Animated.View style={[s.card, { transform: [{ scale: scaleAnim }] }]}>
            <View style={[s.iconCircle, { backgroundColor: v.bg, borderColor: v.border }]}>
              <v.Icon size={28} color={v.color} />
            </View>

            <Text style={s.title}>{config.title}</Text>
            {config.message ? <Text style={s.message}>{config.message}</Text> : null}

            <View style={buttons.length > 1 ? s.buttonsRow : s.buttonsSingle}>
              {buttons.map((btn, i) => {
                const isDestructive = btn.style === 'destructive';
                const isCancel = btn.style === 'cancel';
                const isPrimary = !isCancel && !isDestructive && buttons.length > 1 && i === buttons.length - 1;

                return (
                  <TouchableOpacity
                    key={i}
                    style={[
                      s.btn,
                      buttons.length > 1 && s.btnFlex,
                      isCancel && s.btnCancel,
                      isDestructive && s.btnDestructive,
                      isPrimary && s.btnPrimary,
                      !isCancel && !isDestructive && !isPrimary && buttons.length === 1 && s.btnPrimary,
                    ]}
                    onPress={() => dismiss(btn.onPress)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      s.btnText,
                      isCancel && s.btnTextCancel,
                      isDestructive && s.btnTextDestructive,
                      (isPrimary || buttons.length === 1) && s.btnTextPrimary,
                    ]}>
                      {btn.text}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingTop: 28,
    paddingBottom: 20,
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 4,
  },
  buttonsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 20,
    width: '100%',
  },
  buttonsSingle: {
    marginTop: 20,
    width: '100%',
  },
  btn: {
    paddingVertical: 13,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnFlex: {
    flex: 1,
  },
  btnCancel: {
    backgroundColor: '#F1F5F9',
  },
  btnDestructive: {
    backgroundColor: '#FEF2F2',
  },
  btnPrimary: {
    backgroundColor: '#10B981',
  },
  btnText: {
    fontSize: 15,
    fontWeight: '700',
  },
  btnTextCancel: {
    color: '#64748B',
  },
  btnTextDestructive: {
    color: '#DC2626',
  },
  btnTextPrimary: {
    color: '#FFFFFF',
  },
});
