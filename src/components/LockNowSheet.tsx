import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Lock, Clock, Minus, Plus } from 'lucide-react-native';
import type { UIPolicy } from '../utils/policyMapper';
import { lockPolicyNow, LOCK_NOW_MIN_FUTURE_MS } from '../services/lockPolicyNow';
import { usePolicyContext } from '../context/PolicyContext';

interface Props {
  visible: boolean;
  policy: UIPolicy | null;
  onCancel: () => void;
  onLocked: (policy: UIPolicy, untilTs: number) => void;
}

type PresetId = '30m' | '1h' | '4h' | 'midnight' | 'tomorrow8' | 'custom';

interface Preset {
  id: PresetId;
  label: string;
  compute: () => number;
}

const SYNC_TIMEOUT_MS = 5000;

function endOfDayLocal(): number {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d.getTime();
}

function tomorrowAt(hour: number, minute = 0): number {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, minute, 0, 0);
  return d.getTime();
}

const PRESETS: Preset[] = [
  { id: '30m', label: '30 min', compute: () => Date.now() + 30 * 60_000 },
  { id: '1h', label: '1 hour', compute: () => Date.now() + 60 * 60_000 },
  { id: '4h', label: '4 hours', compute: () => Date.now() + 4 * 60 * 60_000 },
  { id: 'midnight', label: 'Until midnight', compute: endOfDayLocal },
  { id: 'tomorrow8', label: 'Tomorrow 8 AM', compute: () => tomorrowAt(8) },
];

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

function formatDuration(ms: number): string {
  if (ms <= 0) return '0 min';
  const totalMin = Math.round(ms / 60_000);
  if (totalMin < 60) return `${totalMin} min`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export default function LockNowSheet({ visible, policy, onCancel, onLocked }: Props) {
  const { policies } = usePolicyContext();
  const [selected, setSelected] = useState<PresetId>('1h');
  const [customMinutes, setCustomMinutes] = useState(60);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awaitingSync, setAwaitingSync] = useState(false);
  const [syncDelayed, setSyncDelayed] = useState(false);
  const confirmedTsRef = useRef<number | null>(null);

  useEffect(() => {
    if (visible) {
      setSelected('1h');
      setCustomMinutes(60);
      setPending(false);
      setError(null);
      setAwaitingSync(false);
      setSyncDelayed(false);
      confirmedTsRef.current = null;
    }
  }, [visible]);

  const targetTs = useMemo(() => {
    if (selected === 'custom') return Date.now() + customMinutes * 60_000;
    const preset = PRESETS.find(p => p.id === selected);
    return preset ? preset.compute() : Date.now() + 60 * 60_000;
  }, [selected, customMinutes]);

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

  const adjustCustom = (deltaMin: number) => {
    setCustomMinutes(prev => {
      const next = prev + deltaMin;
      if (next < 1) return 1;
      if (next > 60 * 24 * 7) return 60 * 24 * 7;
      return next;
    });
  };

  const handleConfirm = async () => {
    if (!policy || pending || awaitingSync || !isValid) return;
    setPending(true);
    setError(null);
    const ts = targetTs;
    confirmedTsRef.current = ts;
    const result = await lockPolicyNow(policy, ts);
    setPending(false);
    if (result.ok) {
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
              <Text style={s.sectionLabel}>End time</Text>
              <View style={s.presetsWrap}>
                {PRESETS.map(p => (
                  <TouchableOpacity
                    key={p.id}
                    style={[s.chip, selected === p.id && s.chipActive]}
                    onPress={() => setSelected(p.id)}
                    disabled={pending}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.chipText, selected === p.id && s.chipTextActive]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[s.chip, selected === 'custom' && s.chipActive]}
                  onPress={() => setSelected('custom')}
                  disabled={pending}
                  activeOpacity={0.8}
                >
                  <Text style={[s.chipText, selected === 'custom' && s.chipTextActive]}>
                    Custom
                  </Text>
                </TouchableOpacity>
              </View>

              {selected === 'custom' && (
                <View style={s.customRow}>
                  <TouchableOpacity
                    style={s.stepBtn}
                    onPress={() => adjustCustom(-15)}
                    disabled={pending || customMinutes <= 1}
                    activeOpacity={0.7}
                  >
                    <Minus size={16} color="#0F172A" />
                  </TouchableOpacity>
                  <View style={s.stepValueWrap}>
                    <Text style={s.stepValue}>{formatDuration(customMinutes * 60_000)}</Text>
                    <Text style={s.stepHint}>from now</Text>
                  </View>
                  <TouchableOpacity
                    style={s.stepBtn}
                    onPress={() => adjustCustom(15)}
                    disabled={pending}
                    activeOpacity={0.7}
                  >
                    <Plus size={16} color="#0F172A" />
                  </TouchableOpacity>
                </View>
              )}

              <View style={s.previewBox}>
                <Clock size={14} color="#64748B" />
                <Text style={s.previewText}>
                  Locked until <Text style={s.previewStrong}>{formatAbsolute(targetTs)}</Text>
                </Text>
              </View>

              {!isValid && (
                <Text style={s.errorText}>End time must be at least 60 seconds away.</Text>
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
  presetsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 22,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  chipActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  chipTextActive: { color: '#FFFFFF' },
  customRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 8,
    marginBottom: 14,
    gap: 10,
  },
  stepBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepValueWrap: { flex: 1, alignItems: 'center' },
  stepValue: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  stepHint: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
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
