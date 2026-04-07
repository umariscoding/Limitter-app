import React, { memo, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import type { WeeklyUsagePoint } from '../context/UsageContext';

interface WeeklyUsageGraphProps {
  title?: string;
  data: WeeklyUsagePoint[];
  todayIndex?: number;
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

/**
 * Smart time formatter for bar labels.
 * Handles all ranges: seconds → minutes → hours.
 *
 *   0          → "–"
 *   0.08  (5s) → "5s"
 *   0.5  (30s) → "30s"
 *   1          → "1m"
 *   3.5        → "3m 30s"
 *   45         → "45m"
 *   60         → "1h"
 *   90         → "1h 30m"
 *   150        → "2h 30m"
 *   600        → "10h"
 */
const formatBarLabel = (mins: number): string => {
  if (!mins || mins <= 0) return '–';

  const totalSeconds = Math.round(mins * 60);

  // Less than 1 minute → show seconds
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);

  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
};

/**
 * Compact label for the Y-axis scale hint.
 */
const formatScaleLabel = (mins: number): string => {
  if (mins < 1) return `${Math.round(mins * 60)}s`;
  if (mins < 60) return `${Math.round(mins)}m`;
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

const BAR_MAX_HEIGHT = 130;
const BAR_MIN_VISIBLE = 6; // minimum height for non-zero bars so they're always tappable/visible

function WeeklyUsageGraphImpl({
  title = '7-Day Usage',
  data,
  todayIndex = -1,
  isLoading = false,
  error,
  onRefresh,
}: WeeklyUsageGraphProps) {
  const bars = useMemo(() => {
    const source = Array.isArray(data) ? data : [];
    return source.map((item, idx) => ({
      key: item.dateKey || `day-${idx}`,
      label: item.label || '',
      minutes: Math.max(0, Number(item.totalMinutes ?? 0)),
      isToday: idx === todayIndex,
    }));
  }, [data, todayIndex]);

  const maxMinutes = Math.max(...bars.map(b => b.minutes), 0);
  // Use a sane scale so bars aren't invisible for small values
  const scaleMax = maxMinutes > 0 ? maxMinutes : 1;

  if (isLoading) {
    return (
      <View style={s.card}>
        <Text style={s.title}>{title}</Text>
        <Text style={s.loadingText}>Loading graph...</Text>
      </View>
    );
  }

  return (
    <View style={s.card}>
      <View style={s.headerRow}>
        <Text style={s.title}>{title}</Text>
        {!!onRefresh && (
          <TouchableOpacity onPress={onRefresh} style={s.refreshBtn}>
            <Text style={s.refreshText}>Refresh</Text>
          </TouchableOpacity>
        )}
      </View>

      {!!error && <Text style={s.errorText}>{error}</Text>}

      {/* Scale hint — shows max value so user knows what "full height" means */}
      {maxMinutes > 0 && (
        <Text style={s.scaleHint}>max: {formatScaleLabel(maxMinutes)}</Text>
      )}

      <View style={s.graphContainer}>
        {bars.map(bar => {
          const ratio = bar.minutes / scaleMax;
          const rawHeight = ratio * BAR_MAX_HEIGHT;
          const barHeight = bar.minutes > 0 ? Math.max(BAR_MIN_VISIBLE, rawHeight) : 3;

          return (
            <View key={bar.key} style={s.barColumn}>
              {/* Usage time above the bar */}
              <Text
                style={[s.barValue, bar.isToday && s.barValueToday]}
                numberOfLines={1}
              >
                {formatBarLabel(bar.minutes)}
              </Text>

              {/* Bar track + fill */}
              <View style={[s.barTrack, bar.isToday && s.barTrackToday]}>
                <View
                  style={[
                    s.barFill,
                    { height: barHeight },
                    bar.isToday
                      ? s.barFillToday
                      : bar.minutes > 0
                        ? s.barFillNormal
                        : s.barFillEmpty,
                  ]}
                />
              </View>

              {/* Day label */}
              <Text style={[s.dayLabel, bar.isToday && s.dayLabelToday]}>
                {bar.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  refreshBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#EEF2FF',
  },
  refreshText: {
    color: '#4338CA',
    fontWeight: '700',
    fontSize: 12,
  },
  loadingText: {
    marginTop: 8,
    color: '#64748B',
    fontWeight: '600',
  },
  errorText: {
    color: '#B91C1C',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 10,
  },
  scaleHint: {
    fontSize: 10,
    fontWeight: '600',
    color: '#CBD5E1',
    textAlign: 'right',
    marginBottom: 6,
  },
  graphContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: 4,
    paddingBottom: 4,
  },
  barColumn: {
    flex: 1,
    alignItems: 'center',
  },
  barValue: {
    fontSize: 9,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 4,
  },
  barValueToday: {
    color: '#4338CA',
    fontWeight: '800',
    fontSize: 10,
  },
  barTrack: {
    width: 28,
    height: BAR_MAX_HEIGHT,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barTrackToday: {
    borderWidth: 1.5,
    borderColor: '#6366F1',
  },
  barFill: {
    width: '100%',
    borderRadius: 8,
  },
  barFillNormal: {
    backgroundColor: '#C7D2FE',
  },
  barFillToday: {
    backgroundColor: '#6366F1',
  },
  barFillEmpty: {
    backgroundColor: '#E2E8F0',
  },
  dayLabel: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  dayLabelToday: {
    color: '#4338CA',
    fontWeight: '800',
  },
});

export const WeeklyUsageGraph = memo(WeeklyUsageGraphImpl);
