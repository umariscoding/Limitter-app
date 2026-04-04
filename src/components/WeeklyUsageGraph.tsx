import React, { memo, useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import type { WeeklyUsagePoint } from '../context/UsageContext';

interface WeeklyUsageGraphProps {
  title?: string;
  data: WeeklyUsagePoint[];
  isLoading?: boolean;
  error?: string | null;
  onRefresh?: () => void;
}

interface GraphPoint {
  key: string;
  label: string;
  fullLabel: string;
  date: string;
  minutes: number;
}

const DEFAULT_POINTS: GraphPoint[] = [
  { key: 'mon', label: 'Mon', fullLabel: 'Monday', date: '', minutes: 0 },
  { key: 'tue', label: 'Tue', fullLabel: 'Tuesday', date: '', minutes: 0 },
  { key: 'wed', label: 'Wed', fullLabel: 'Wednesday', date: '', minutes: 0 },
  { key: 'thu', label: 'Thu', fullLabel: 'Thursday', date: '', minutes: 0 },
  { key: 'fri', label: 'Fri', fullLabel: 'Friday', date: '', minutes: 0 },
  { key: 'sat', label: 'Sat', fullLabel: 'Saturday', date: '', minutes: 0 },
  { key: 'sun', label: 'Sun', fullLabel: 'Sunday', date: '', minutes: 0 },
];

const formatMinutes = (mins: number) => {
  const safe = Math.max(0, Number(mins || 0));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${h}h ${m}m`;
};

function WeeklyUsageGraphImpl({
  title = '7-Day Usage',
  data,
  isLoading = false,
  error,
  onRefresh,
}: WeeklyUsageGraphProps) {
  const normalizedData = useMemo(() => {
    const source = Array.isArray(data) ? data : [];
    return DEFAULT_POINTS.map((fallback, idx) => {
      const item = source[idx];
      if (!item) return fallback;

      const minutes = Number(item.totalMinutes ?? 0);
      return {
        key: String(item.dateKey || fallback.key),
        label: String(item.label || fallback.label),
        fullLabel: String(item.label || fallback.fullLabel),
        date: String(item.dateKey || fallback.date),
        minutes: Number.isFinite(minutes) ? Math.max(0, minutes) : 0,
      };
    });
  }, [data]);

  const [selectedKey, setSelectedKey] = useState<string>(normalizedData[normalizedData.length - 1]?.key || '');

  useEffect(() => {
    const latestKey = normalizedData[normalizedData.length - 1]?.key || '';
    setSelectedKey(latestKey);
  }, [normalizedData]);

  const maxMinutes = Math.max(...normalizedData.map(item => item.minutes), 0);
  const scaleMax = maxMinutes > 0 ? maxMinutes : 1;

  if (isLoading) {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.loadingText}>Loading graph...</Text>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>{title}</Text>
        {!!onRefresh && (
          <TouchableOpacity onPress={onRefresh} style={styles.refreshBtn}>
            <Text style={styles.refreshText}>Refresh</Text>
          </TouchableOpacity>
        )}
      </View>

      {!!error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.fixedHeightWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.graphScroll}>
          <View style={styles.graphRow}>
            {normalizedData.map(point => {
              const isSelected = point.key === selectedKey;
              const rawHeight = (point.minutes / scaleMax) * 130;
              const barHeight = maxMinutes === 0 ? 3 : Math.max(3, rawHeight);

              return (
                <TouchableOpacity
                  key={point.key}
                  activeOpacity={0.8}
                  onPress={() => setSelectedKey(point.key)}
                  style={styles.barTouch}
                >
                  <Text style={[styles.barMinute, isSelected && styles.barMinuteSelected]}>{point.minutes}m</Text>
                  <View style={[styles.barTrack, isSelected && styles.barTrackSelected]}>
                    <View style={[styles.barFill, { height: barHeight }, isSelected && styles.barFillSelected]} />
                  </View>
                  <Text style={[styles.barLabel, isSelected && styles.barLabelSelected]}>{point.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
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
    marginBottom: 8,
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
  fixedHeightWrap: {
    height: 210,
  },
  graphScroll: {
    backgroundColor: '#FFFFFF',
  },
  graphRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    minHeight: 160,
    paddingTop: 8,
    paddingBottom: 8,
  },
  barTouch: {
    width: 36,
    alignItems: 'center',
    marginRight: 14,
  },
  barMinute: {
    fontSize: 10,
    color: '#64748B',
    fontWeight: '600',
    marginBottom: 4,
  },
  barMinuteSelected: {
    color: '#3730A3',
    fontWeight: '800',
  },
  barTrack: {
    width: 30,
    height: 130,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    justifyContent: 'flex-end',
  },
  barTrackSelected: {
    borderWidth: 1,
    borderColor: '#6366F1',
  },
  barFill: {
    width: '100%',
    backgroundColor: '#C7D2FE',
    borderRadius: 8,
  },
  barFillSelected: {
    backgroundColor: '#6366F1',
  },
  barLabel: {
    marginTop: 8,
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  barLabelSelected: {
    color: '#3730A3',
    fontWeight: '800',
  },
});

export const WeeklyUsageGraph = memo(WeeklyUsageGraphImpl);
