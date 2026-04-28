import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';
import { Lock, Clock } from 'lucide-react-native';
import type { UIPolicy } from '../utils/policyMapper';
import { lockPolicyNow } from '../services/lockPolicyNow';
import { usePolicyContext } from '../context/PolicyContext';
import { nextResetTimestamp, formatHHMMtoAMPM } from '../utils/timeWindow';

interface Props {
  visible: boolean;
  policy: UIPolicy | null;
  onCancel: () => void;
  onLocked: (policy: UIPolicy, untilTs: number) => void;
}

const SYNC_TIMEOUT_MS = 5000;

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
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [awaitingSync, setAwaitingSync] = useState(false);
  const [syncDelayed, setSyncDelayed] = useState(false);
  const confirmedTsRef = useRef<number | null>(null);

  useEffect(() => {
    if (visible) {
      setPending(false);
      setError(null);
      setAwaitingSync(false);
      setSyncDelayed(false);
      confirmedTsRef.current = null;
    }
  }, [visible]);

  const endTimeDisplay = useMemo(() => {
    if (!policy) return '';
    return formatHHMMtoAMPM(policy.daily_reset_time_local || '00:00');
  }, [policy]);

  const nextResetTs = useMemo(() => {
    if (!policy) return 0;
    return nextResetTimestamp(policy.daily_reset_time_local || '00:00');
  }, [policy]);

  const livePolicy = useMemo(
    () => (policy ? policies.find(p => p.id === policy.id) || null : null),
    [policy, policies],
  );

  useEffect(() => {
    if (!awaitingSync || !livePolicy || !livePolicy.is_blocked) return;
    const ts = confirmedTsRef.current ?? nextResetTs;
    onLocked(livePolicy, ts);
  }, [awaitingSync, livePolicy, onLocked, nextResetTs]);

  useEffect(() => {
    if (!awaitingSync) return;
    const t = setTimeout(() => setSyncDelayed(true), SYNC_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [awaitingSync]);

  const handleConfirm = async () => {
    if (!policy || pending || awaitingSync) return;
    setPending(true);
    setError(null);
    const ts = nextResetTimestamp(policy.daily_reset_time_local || '00:00');
    confirmedTsRef.current = ts;
    const result = await lockPolicyNow(policy, ts);
    setPending(false);
    if (result.ok) {
      await refreshManualLocks();
      setAwaitingSync(true);
    } else {
      confirmedTsRef.current = null;
      setError(result.message);
    }
  };

  if (!policy) return null;

  const targetName = policy.target_label || policy.app_name || 'this limit';
  const dismissDisabled = pending;

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
              <View style={s.previewBox}>
                <Clock size={14} color="#64748B" />
                <Text style={s.previewText}>
                  Will be locked until <Text style={s.previewStrong}>{endTimeDisplay}</Text>
                  {' '}(<Text style={s.previewStrong}>{formatAbsolute(nextResetTs)}</Text>)
                </Text>
              </View>

              {error && <Text style={s.errorText}>{error}</Text>}

              <TouchableOpacity
                style={[s.btnPrimary, pending && s.btnPrimaryDisabled]}
                onPress={handleConfirm}
                disabled={pending}
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
