import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Lock, Clock } from 'lucide-react-native';
import type { UIPolicy } from '../utils/policyMapper';
import { lockPolicyNow, LOCK_NOW_MIN_FUTURE_MS } from '../services/lockPolicyNow';
import { usePolicyContext } from '../context/PolicyContext';
import { clockTargetTimestampMs } from '../helpers/helper';

interface Props {
  visible: boolean;
  policy: UIPolicy | null;
  onCancel: () => void;
  onLocked: (policy: UIPolicy, untilTs: number) => void;
}

const SYNC_TIMEOUT_MS = 5000;
const MIN_LOCK_SECONDS = Math.ceil(LOCK_NOW_MIN_FUTURE_MS / 1000);

// Clamp 12-hour clock input. Hour is 1–12 (no zero); minute is 0–59. Empty
// string is allowed during typing so the field can be cleared.
function clampClockHour(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 2);
  if (!digits) return '';
  const n = parseInt(digits, 10);
  if (n < 1) return '1';
  if (n > 12) return '12';
  return String(n);
}

function clampClockMinute(text: string): string {
  const digits = text.replace(/\D/g, '').slice(0, 2);
  if (!digits) return '';
  const n = parseInt(digits, 10);
  if (n > 59) return '59';
  return String(n);
}

function formatAbsolute(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow =
    d.getFullYear() === tomorrow.getFullYear() &&
    d.getMonth() === tomorrow.getMonth() &&
    d.getDate() === tomorrow.getDate();

  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (sameDay) return `today at ${time}`;
  if (isTomorrow) return `tomorrow at ${time}`;
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function LockNowSheet({ visible, policy, onCancel, onLocked }: Props) {
  const { policies, refreshManualLocks } = usePolicyContext();
  // Default to ~1 hour from now in 12-hour format.
  const initialDefaults = useMemo(() => {
    const target = new Date(Date.now() + 60 * 60_000);
    const h24 = target.getHours();
    const period: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    const minute = target.getMinutes();
    return {
      hour: String(h12),
      minute: String(minute).padStart(2, '0'),
      period,
    };
  }, []);
  const [clockHour, setClockHour] = useState(initialDefaults.hour);
  const [clockMinute, setClockMinute] = useState(initialDefaults.minute);
  const [clockPeriod, setClockPeriod] = useState<'AM' | 'PM'>(initialDefaults.period);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awaitingSync, setAwaitingSync] = useState(false);
  const [syncDelayed, setSyncDelayed] = useState(false);
  const confirmedTsRef = useRef<number | null>(null);

  useEffect(() => {
    if (visible) {
      // Recompute the "1 hour from now" default freshly each time the sheet
      // opens — using the memoized initialDefaults would freeze it at the
      // first-mount time.
      const target = new Date(Date.now() + 60 * 60_000);
      const h24 = target.getHours();
      const period: 'AM' | 'PM' = h24 >= 12 ? 'PM' : 'AM';
      const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
      setClockHour(String(h12));
      setClockMinute(String(target.getMinutes()).padStart(2, '0'));
      setClockPeriod(period);
      setPending(false);
      setError(null);
      setAwaitingSync(false);
      setSyncDelayed(false);
      confirmedTsRef.current = null;
    }
  }, [visible]);

  // Resolve HH:MM AM/PM to the next-occurring absolute timestamp. If the time
  // has already passed today, clockTargetTimestampMs auto-bumps to tomorrow
  // (matches the user's mental model of "lock until X PM").
  const targetTs = useMemo(
    () => clockTargetTimestampMs(clockHour || '12', clockMinute || '0', clockPeriod),
    [clockHour, clockMinute, clockPeriod],
  );
  const remainingMs = targetTs - Date.now();
  const isValid = remainingMs >= LOCK_NOW_MIN_FUTURE_MS;

  // Live policy state from context — used to confirm RTDB has flipped is_blocked.
  const livePolicy = useMemo(
    () => (policy ? policies.find(p => p.id === policy.id) || null : null),
    [policy, policies],
  );

  // Watch for RTDB confirmation: when the live policy flips to blocked while
  // we're awaiting sync, fire onLocked with the originally-requested timestamp.
  useEffect(() => {
    if (!awaitingSync || !livePolicy || !livePolicy.is_blocked) return;
    const ts = confirmedTsRef.current ?? targetTs;
    onLocked(livePolicy, ts);
  }, [awaitingSync, livePolicy, onLocked, targetTs]);

  // Timeout: if RTDB hasn't confirmed within SYNC_TIMEOUT_MS, surface a fallback
  // message so the user knows the lock was saved but local sync is delayed.
  useEffect(() => {
    if (!awaitingSync) return;
    const t = setTimeout(() => setSyncDelayed(true), SYNC_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [awaitingSync]);

  const handleConfirm = async () => {
    if (!policy || pending || awaitingSync || !isValid) return;
    setPending(true);
    setError(null);
    // Recompute fresh at confirm time. clockTargetTimestampMs anchors the
    // tomorrow-bump decision to "now at click", not "now at last keystroke",
    // which prevents an off-by-one-day error if the user enters a time near
    // the current moment and waits to press Lock.
    const ts = clockTargetTimestampMs(clockHour || '12', clockMinute || '0', clockPeriod);
    confirmedTsRef.current = ts;
    const result = await lockPolicyNow(policy, ts);
    setPending(false);
    if (result.ok) {
      // Pull the freshly-written marker into PolicyContext BEFORE flipping into
      // awaiting-sync. When the RTDB lock arrives moments later, the selector
      // already has the marker → PolicyCard freezes the bar at the snapshot
      // instead of briefly showing the live server value.
      await refreshManualLocks();
      setAwaitingSync(true);
    } else {
      confirmedTsRef.current = null;
      setError(result.message);
    }
  };

  if (!policy) return null;

  const targetName = policy.target_label || policy.app_name || 'this limit';
  const dismissDisabled = pending; // user can dismiss during awaitingSync

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={dismissDisabled ? () => {} : onCancel}
    >
      <View style={s.overlay}>
        <View style={s.sheet}>
          <View style={s.handle} />

          <View style={s.header}>
            <View style={s.iconWrap}>
              <Lock size={22} color="#DC2626" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.title}>Lock Now</Text>
              <Text style={s.subtitle} numberOfLines={1}>
                {targetName}
              </Text>
            </View>
          </View>

          {awaitingSync ? (
            <View style={s.syncBlock}>
              <ActivityIndicator size="small" color="#475569" />
              <Text style={s.syncTitle}>
                {syncDelayed ? 'Lock saved on server' : 'Locking…'}
              </Text>
              <Text style={s.syncBody}>
                {syncDelayed
                  ? 'Waiting for this device to sync. The lock is active on the server — you can close this and it will appear shortly.'
                  : 'Syncing across your devices.'}
              </Text>
              {syncDelayed && (
                <TouchableOpacity style={s.btnGhost} onPress={onCancel} activeOpacity={0.7}>
                  <Text style={s.btnGhostText}>Close</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <>
              <Text style={s.sectionLabel}>Lock until</Text>
              <View style={s.durationRow}>
                <View style={s.durationBox}>
                  <Text style={s.durationLabel}>Hour</Text>
                  <TextInput
                    value={clockHour}
                    onChangeText={t => setClockHour(clampClockHour(t))}
                    keyboardType="number-pad"
                    style={s.durationInput}
                    placeholder="12"
                    placeholderTextColor="#CBD5E1"
                    editable={!pending}
                    maxLength={2}
                  />
                </View>
                <View style={s.durationBox}>
                  <Text style={s.durationLabel}>Minute</Text>
                  <TextInput
                    value={clockMinute}
                    onChangeText={t => setClockMinute(clampClockMinute(t))}
                    keyboardType="number-pad"
                    style={s.durationInput}
                    placeholder="00"
                    placeholderTextColor="#CBD5E1"
                    editable={!pending}
                    maxLength={2}
                  />
                </View>
              </View>

              <View style={s.periodRow}>
                {(['AM', 'PM'] as const).map(period => (
                  <TouchableOpacity
                    key={period}
                    style={[s.periodBtn, clockPeriod === period && s.periodBtnActive]}
                    onPress={() => setClockPeriod(period)}
                    disabled={pending}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.periodBtnText, clockPeriod === period && s.periodBtnTextActive]}>
                      {period}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={s.previewBox}>
                <Clock size={14} color="#64748B" />
                <Text style={s.previewText}>
                  Locked until <Text style={s.previewStrong}>{formatAbsolute(targetTs)}</Text>
                </Text>
              </View>

              {!isValid && (
                <Text style={s.errorText}>Lock end must be at least {MIN_LOCK_SECONDS} seconds in the future.</Text>
              )}
              {error && <Text style={s.errorText}>{error}</Text>}

              <TouchableOpacity
                style={[s.btnPrimary, (!isValid || pending) && s.btnPrimaryDisabled]}
                onPress={handleConfirm}
                disabled={!isValid || pending}
                activeOpacity={0.85}
              >
                {pending ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={s.btnPrimaryText}>Lock Now</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={s.btnGhost}
                onPress={onCancel}
                disabled={pending}
                activeOpacity={0.7}
              >
                <Text style={s.btnGhostText}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 28,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E2E8F0',
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  subtitle: { fontSize: 13, color: '#64748B', marginTop: 2 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  durationRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  durationBox: { flex: 1 },
  durationLabel: {
    color: '#64748B',
    fontSize: 11,
    marginBottom: 6,
    fontWeight: '700',
    textAlign: 'center',
  },
  durationInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    backgroundColor: '#F8FAFC',
    color: '#0F172A',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  periodRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
  },
  periodBtnActive: {
    borderColor: '#0F172A',
    backgroundColor: '#0F172A',
  },
  periodBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
    letterSpacing: 0.5,
  },
  periodBtnTextActive: {
    color: '#FFFFFF',
  },
  previewBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  previewText: { flex: 1, fontSize: 13, color: '#475569' },
  previewStrong: { fontWeight: '700', color: '#0F172A' },
  errorText: { fontSize: 12, color: '#DC2626', marginBottom: 10, textAlign: 'center' },
  btnPrimary: {
    width: '100%',
    backgroundColor: '#DC2626',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 8,
  },
  btnPrimaryDisabled: { backgroundColor: '#FCA5A5' },
  btnPrimaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  btnGhost: { width: '100%', paddingVertical: 12, alignItems: 'center' },
  btnGhostText: { color: '#94A3B8', fontWeight: '600', fontSize: 14 },
  syncBlock: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
  },
  syncTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  syncBody: {
    fontSize: 13,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 12,
    lineHeight: 18,
  },
});
