import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { formatUsageTime, formatLimitTime, type UIPolicy } from '../utils/policyMapper';

interface PolicyCardProps {
  limit: UIPolicy;
  onOverride: (limit: UIPolicy) => void;
}

export default function PolicyCard({ limit, onOverride }: PolicyCardProps) {
  const pct = Math.min(
    (limit.time_used_minutes / limit.max_time_minutes) * 100,
    100,
  );
  const isBlocked = limit.is_blocked;
  const isActive = (limit.time_used_minutes || 0) > 0;

  return (
    <View style={s.card}>
      <View style={s.info}>
        <Text style={s.name}>
          {limit.target_label || limit.app_name || limit.category || 'App'}
        </Text>
        <View style={s.stats}>
          <Text style={s.stat}>
            {formatUsageTime(limit.time_used_minutes || 0)} /{' '}
            {formatLimitTime(limit.max_time_minutes)}
          </Text>
          <View
            style={[
              s.badge,
              isBlocked ? s.badgeBlocked : isActive ? s.badgeActive : s.badgeTracking,
            ]}
          >
            <Text
              style={[
                s.badgeText,
                isBlocked ? s.badgeBlockedText : isActive ? s.badgeActiveText : s.badgeTrackingText,
              ]}
            >
              {isBlocked ? 'BLOCKED' : isActive ? 'ACTIVE' : 'TRACKING'}
            </Text>
          </View>
        </View>
      </View>

      <View style={s.progressTrack}>
        <View
          style={[
            s.progressBar,
            { width: `${pct}%` },
            isBlocked && s.progressBlocked,
          ]}
        />
      </View>

      <TouchableOpacity onPress={() => onOverride(limit)} style={s.overrideBtn}>
        <Text style={s.overrideBtnText}>Use Override</Text>
      </TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  info: { marginBottom: 12 },
  name: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  stats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  stat: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  badgeActive: { backgroundColor: '#DCFCE7' },
  badgeTracking: { backgroundColor: '#F1F5F9' },
  badgeBlocked: { backgroundColor: '#FEE2E2' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  badgeActiveText: { color: '#166534' },
  badgeTrackingText: { color: '#64748B' },
  badgeBlockedText: { color: '#991B1B' },
  progressTrack: {
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBar: { height: '100%', backgroundColor: '#10B981', borderRadius: 4 },
  progressBlocked: { backgroundColor: '#EF4444' },
  overrideBtn: {
    backgroundColor: '#F59E0B',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  overrideBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
});
