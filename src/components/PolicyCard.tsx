import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Shield, ShieldOff, Clock, Zap, Lock } from 'lucide-react-native';
import { formatUsageTime, formatLimitTime, type UIPolicy } from '../utils/policyMapper';

interface PolicyCardProps {
  limit: UIPolicy;
  onOverride: (limit: UIPolicy) => void;
  onLockNow?: (limit: UIPolicy) => void;
}

export default function PolicyCard({ limit, onOverride, onLockNow }: PolicyCardProps) {
  // During an active manual lock, display is driven by the snapshot captured
  // at lock start — not the live server value. This freezes the bar/percentage
  // at exactly what the user saw when they pressed Lock Now, regardless of any
  // server-side drift, native-side ticking, or other-device aggregation lag.
  const isManualLocked = limit.is_manual_locked;
  const displayUsedMinutes = isManualLocked
    ? (limit.manual_lock_snapshot_seconds ?? 0) / 60
    : (limit.time_used_minutes || 0);

  const pct = limit.max_time_minutes > 0
    ? Math.min((displayUsedMinutes / limit.max_time_minutes) * 100, 100)
    : 0;
  // Defensive: any policy at-or-over its daily quota is blocked, even if the
  // upstream is_blocked flag desyncs (e.g., RTDB lock cleared but quota still
  // exhausted). Computed against the displayed value so a frozen-below-quota
  // snapshot does not falsely flip exhaustion on/off during a manual lock.
  const isExhausted = limit.max_time_minutes > 0 && displayUsedMinutes >= limit.max_time_minutes;
  const isBlocked = limit.is_blocked || isExhausted;
  const isWarning = pct >= 75 && !isBlocked;
  const isActive = !isBlocked && displayUsedMinutes > 0;

  // Bar color is driven by pct, which is frozen during a manual lock — matches
  // spec: color stays whatever it was at lock moment (red if exceeded, etc.).
  const progressColors: [string, string] = isBlocked
    ? ['#EF4444', '#DC2626']
    : isWarning
      ? ['#F59E0B', '#D97706']
      : ['#10B981', '#059669'];

  const targetName = limit.target_label || limit.app_name || limit.category || 'App';
  const typeLabel = limit.target_type === 'website' ? 'Website' : limit.target_type === 'category' ? 'Category' : 'App';

  // Status badge: manual lock is its own visual state (amber) so the user can
  // distinguish "I locked this myself" from "quota exhausted" (red).
  const badgeStyle = isManualLocked
    ? s.statusLocked
    : isBlocked
      ? s.statusBlocked
      : isActive
        ? s.statusActive
        : s.statusIdle;
  const dotStyle = isManualLocked
    ? s.dotLocked
    : isBlocked
      ? s.dotBlocked
      : isActive
        ? s.dotActive
        : s.dotIdle;
  const textStyle = isManualLocked
    ? s.statusLockedText
    : isBlocked
      ? s.statusBlockedText
      : isActive
        ? s.statusActiveText
        : s.statusIdleText;
  const statusLabel = isManualLocked ? 'Locked' : isBlocked ? 'Blocked' : isActive ? 'Active' : 'Ready';

  return (
    <View style={[s.card, isBlocked && s.cardBlocked]}>
      <View style={s.topRow}>
        <View style={s.iconWrap}>
          {isBlocked ? (
            <ShieldOff size={20} color={isManualLocked ? '#D97706' : '#EF4444'} />
          ) : (
            <Shield size={20} color="#21e396ff" />
          )}
        </View>
        <View style={s.titleWrap}>
          <Text style={s.name} numberOfLines={1}>{targetName}</Text>
          <Text style={s.typeLabel}>{typeLabel}</Text>
        </View>
        <View style={[s.statusBadge, badgeStyle]}>
          <View style={[s.statusDot, dotStyle]} />
          <Text style={[s.statusText, textStyle]}>{statusLabel}</Text>
        </View>
      </View>

      <View style={s.usageRow}>
        <View style={s.usageLeft}>
          <Clock size={14} color="#94A3B8" />
          <Text style={s.usageText}>
            {formatUsageTime(displayUsedMinutes)}
            <Text style={s.usageSeparator}> / </Text>
            {formatLimitTime(limit.max_time_minutes)}
            {isManualLocked && <Text style={s.frozenLabel}>  (Frozen)</Text>}
          </Text>
        </View>
        <Text style={[s.remainingText, isBlocked && !isManualLocked && s.remainingBlocked, isManualLocked && s.remainingLocked]}>
          {isManualLocked ? 'Locked' : isBlocked ? 'Limit reached' : `${Math.round(pct)}% used`}
        </Text>
      </View>

      <View style={s.progressTrack}>
        <LinearGradient
          colors={progressColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[s.progressBar, { width: `${Math.max(pct, 2)}%` }]}
        />
      </View>

      {isBlocked ? (
        <TouchableOpacity onPress={() => onOverride(limit)} activeOpacity={0.8}>
          <View style={[s.overrideBtn, s.overrideBtnActive]}>
            <Zap size={16} color="#FFFFFF" />
            <Text style={s.overrideBtnText}>Use Override</Text>
          </View>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={() => onLockNow?.(limit)}
          activeOpacity={0.8}
          disabled={!onLockNow}
        >
          <View style={[s.overrideBtn, onLockNow ? s.lockNowBtn : s.overrideBtnDisabled]}>
            <Lock size={16} color={onLockNow ? '#0F172A' : '#94A3B8'} />
            <Text style={[s.lockNowBtnText, !onLockNow && s.overrideBtnTextDisabled]}>
              Lock Now
            </Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8ECF4',
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  cardBlocked: {
    borderColor: '#FECACA',
    backgroundColor: '#FFFBFB',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  titleWrap: { flex: 1 },
  name: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  typeLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '500', marginTop: 1 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 5,
  },
  statusActive: { backgroundColor: '#F0FDF4' },
  statusBlocked: { backgroundColor: '#FEF2F2' },
  statusLocked: { backgroundColor: '#FEF3C7' },
  statusIdle: { backgroundColor: '#F8FAFC' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  dotActive: { backgroundColor: '#10B981' },
  dotBlocked: { backgroundColor: '#EF4444' },
  dotLocked: { backgroundColor: '#F59E0B' },
  dotIdle: { backgroundColor: '#CBD5E1' },
  statusText: { fontSize: 11, fontWeight: '700' },
  statusActiveText: { color: '#059669' },
  statusBlockedText: { color: '#DC2626' },
  statusLockedText: { color: '#B45309' },
  statusIdleText: { color: '#94A3B8' },
  frozenLabel: { color: '#B45309', fontWeight: '700', fontSize: 11 },
  remainingLocked: { color: '#B45309' },
  usageRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  usageLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  usageText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  usageSeparator: { color: '#CBD5E1' },
  remainingText: { fontSize: 12, fontWeight: '600', color: '#10B981' },
  remainingBlocked: { color: '#EF4444' },
  progressTrack: {
    height: 6,
    backgroundColor: '#F1F5F9',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressBar: { height: '100%', borderRadius: 3 },
  overrideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 12,
  },
  overrideBtnActive: { backgroundColor: '#EF4444' },
  overrideBtnDisabled: { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  overrideBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
  overrideBtnTextDisabled: { color: '#64748B', fontWeight: '600', fontSize: 13 },
  lockNowBtn: { backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#CBD5E1' },
  lockNowBtnText: { color: '#0F172A', fontWeight: '700', fontSize: 14 },
});
