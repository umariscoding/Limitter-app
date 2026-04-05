import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Shield, ShieldOff, Clock, Zap } from 'lucide-react-native';
import { formatUsageTime, formatLimitTime, type UIPolicy } from '../utils/policyMapper';

interface PolicyCardProps {
  limit: UIPolicy;
  onOverride: (limit: UIPolicy) => void;
}

export default function PolicyCard({ limit, onOverride }: PolicyCardProps) {
  const pct = limit.max_time_minutes > 0
    ? Math.min((limit.time_used_minutes / limit.max_time_minutes) * 100, 100)
    : 0;
  const isBlocked = limit.is_blocked;
  const isWarning = pct >= 75 && !isBlocked;
  const isActive = (limit.time_used_minutes || 0) > 0 && !isBlocked;
  const remaining = Math.max(0, limit.max_time_minutes - (limit.time_used_minutes || 0));

  const progressColors: [string, string] = isBlocked
    ? ['#EF4444', '#DC2626']
    : isWarning
      ? ['#F59E0B', '#D97706']
      : ['#10B981', '#059669'];

  const targetName = limit.target_label || limit.app_name || limit.category || 'App';
  const typeLabel = limit.target_type === 'website' ? 'Website' : limit.target_type === 'category' ? 'Category' : 'App';

  return (
    <View style={[s.card, isBlocked && s.cardBlocked]}>
      <View style={s.topRow}>
        <View style={s.iconWrap}>
          {isBlocked ? (
            <ShieldOff size={20} color="#EF4444" />
          ) : (
            <Shield size={20} color="#4F46E5" />
          )}
        </View>
        <View style={s.titleWrap}>
          <Text style={s.name} numberOfLines={1}>{targetName}</Text>
          <Text style={s.typeLabel}>{typeLabel}</Text>
        </View>
        <View style={[s.statusBadge, isBlocked ? s.statusBlocked : isActive ? s.statusActive : s.statusIdle]}>
          <View style={[s.statusDot, isBlocked ? s.dotBlocked : isActive ? s.dotActive : s.dotIdle]} />
          <Text style={[s.statusText, isBlocked ? s.statusBlockedText : isActive ? s.statusActiveText : s.statusIdleText]}>
            {isBlocked ? 'Blocked' : isActive ? 'Active' : 'Ready'}
          </Text>
        </View>
      </View>

      <View style={s.usageRow}>
        <View style={s.usageLeft}>
          <Clock size={14} color="#94A3B8" />
          <Text style={s.usageText}>
            {formatUsageTime(limit.time_used_minutes || 0)}
            <Text style={s.usageSeparator}> / </Text>
            {formatLimitTime(limit.max_time_minutes)}
          </Text>
        </View>
        <Text style={[s.remainingText, isBlocked && s.remainingBlocked]}>
          {isBlocked ? 'Limit reached' : `${formatUsageTime(remaining)} left`}
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

      {isBlocked && (
        <TouchableOpacity onPress={() => onOverride(limit)} activeOpacity={0.8}>
          <LinearGradient
            colors={['#6366F1', '#4F46E5']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.overrideBtn}
          >
            <Zap size={16} color="#FFFFFF" />
            <Text style={s.overrideBtnText}>Use Override</Text>
          </LinearGradient>
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
  statusIdle: { backgroundColor: '#F8FAFC' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  dotActive: { backgroundColor: '#10B981' },
  dotBlocked: { backgroundColor: '#EF4444' },
  dotIdle: { backgroundColor: '#CBD5E1' },
  statusText: { fontSize: 11, fontWeight: '700' },
  statusActiveText: { color: '#059669' },
  statusBlockedText: { color: '#DC2626' },
  statusIdleText: { color: '#94A3B8' },
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
  overrideBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});
