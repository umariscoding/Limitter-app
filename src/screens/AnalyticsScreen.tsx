import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar, ScrollView, RefreshControl } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, BarChart2 } from 'lucide-react-native';
import { useUser } from '../context/UserContext';
import { useUsageContext } from '../context/UsageContext';
import { usePolicyContext } from '../context/PolicyContext';
import { WeeklyUsageGraph } from '../components/WeeklyUsageGraph';
import { getWeeklyUsageAPI } from '../services/usageService';
import { useDeviceResolver } from '../hooks/useDeviceResolver';
import { formatLimitTime } from '../utils/policyMapper';
import BottomNav from '../components/BottomNav';

interface BreakdownItem {
  id: string;
  name: string;
  usedMinutes: number;
  limitMinutes: number;
  isBlocked: boolean;
}

export default function AnalyticsScreen() {
  const navigation = useNavigation<any>();
  const { user } = useUser();
  const { weeklyUsage, isLoadingWeekly, weeklyError, setWeeklyUsage, setIsLoadingWeekly, setWeeklyError } = useUsageContext();
  const { policies } = usePolicyContext();
  const { deviceId } = useDeviceResolver(user?.uid);
  const [refreshing, setRefreshing] = useState(false);
  const [todayIndex, setTodayIndex] = useState(-1);

  const breakdown = useMemo<BreakdownItem[]>(() => {
    return policies
      .filter(p => p.target_label)
      .slice(0, 8)
      .map(p => ({
        id: p.id,
        name: p.target_label,
        usedMinutes: p.time_used_minutes || 0,
        limitMinutes: p.max_time_minutes || 0,
        isBlocked: p.is_blocked,
      }));
  }, [policies]);

  const fetchWeekly = async () => {
    setIsLoadingWeekly(true);
    setWeeklyError(null);
    try {
      const days = await getWeeklyUsageAPI(user?.accountId);

      // Map API data by day-of-week: Mon=0 … Sun=6
      const WEEK_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const slots: Array<{ dateKey: string; totalMinutes: number } | null> = new Array(7).fill(null);

      for (const d of days) {
        const date = new Date(d.dateKey + 'T12:00:00');
        const jsDay = date.getDay(); // 0=Sun … 6=Sat
        const monIdx = jsDay === 0 ? 6 : jsDay - 1; // Mon=0 … Sun=6
        if (!slots[monIdx] || d.dateKey > slots[monIdx]!.dateKey) {
          slots[monIdx] = d;
        }
      }

      // Build 7 points: Mon → Sun
      const points: typeof weeklyUsage = WEEK_LABELS.map((label, idx) => ({
        dateKey: slots[idx]?.dateKey || `day-${idx}`,
        label,
        totalMinutes: slots[idx]?.totalMinutes ?? 0,
      }));

      // Find today's index (Mon=0 … Sun=6)
      const jsToday = new Date().getDay(); // 0=Sun … 6=Sat
      setTodayIndex(jsToday === 0 ? 6 : jsToday - 1);
      setWeeklyUsage(points);
    } catch {
      setWeeklyError('Failed to load weekly usage');
    } finally {
      setIsLoadingWeekly(false);
    }
  };

  useEffect(() => {
    fetchWeekly();
  }, [deviceId]);

  // Override today's bar with real-time total from policies (same source as dashboard)
  const graphData = useMemo(() => {
    if (todayIndex < 0 || weeklyUsage.length === 0) return weeklyUsage;
    const liveTotalMinutes = policies.reduce(
      (sum, p) => sum + Math.max(0, Number(p.time_used_minutes ?? 0)),
      0,
    );
    return weeklyUsage.map((point, idx) => {
      if (idx !== todayIndex) return point;
      const best = Math.max(point.totalMinutes, liveTotalMinutes);
      return { ...point, totalMinutes: best };
    });
  }, [weeklyUsage, todayIndex, policies]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchWeekly();
    setRefreshing(false);
  };

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Analytics</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <WeeklyUsageGraph
          title="7-Day Usage"
          data={graphData}
          todayIndex={todayIndex}
          isLoading={isLoadingWeekly}
          error={weeklyError}
          onRefresh={onRefresh}
        />

        <View style={s.sectionHeader}>
          <BarChart2 size={18} color="#6366F1" />
          <Text style={s.sectionTitle}>App Breakdown</Text>
        </View>

        {breakdown.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>No usage data available yet</Text>
          </View>
        ) : (
          breakdown.map(item => {
            const pct = item.limitMinutes > 0 ? Math.min(100, (item.usedMinutes / item.limitMinutes) * 100) : 0;
            const progressColors: [string, string] = item.isBlocked
              ? ['#EF4444', '#DC2626']
              : pct >= 75
                ? ['#F59E0B', '#D97706']
                : ['#10B981', '#059669'];

            return (
              <View key={item.id} style={s.breakdownCard}>
                <View style={s.breakdownRow}>
                  <Text style={s.appName} numberOfLines={1}>{item.name}</Text>
                  <View style={[s.statusPill, item.isBlocked ? s.pillBlocked : s.pillActive]}>
                    <View style={[s.statusDot, item.isBlocked ? s.dotBlocked : s.dotActive]} />
                    <Text style={[s.statusText, item.isBlocked ? s.textBlocked : s.textActive]}>
                      {item.isBlocked ? 'Blocked' : 'Active'}
                    </Text>
                  </View>
                </View>
                <View style={s.progressTrack}>
                  <LinearGradient colors={progressColors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[s.progressFill, { width: `${Math.max(pct, 2)}%` }]} />
                </View>
                <View style={s.breakdownRow}>
                  <Text style={s.metaText}>{formatLimitTime(item.usedMinutes)} used</Text>
                  <Text style={s.metaText}>{formatLimitTime(item.limitMinutes)} limit</Text>
                </View>
              </View>
            );
          })
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomNav active="analytics" />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 40, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  backBtn: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  content: { padding: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, marginBottom: 12 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
  emptyCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#E8ECF4' },
  emptyText: { fontSize: 14, color: '#94A3B8', fontWeight: '500' },
  breakdownCard: { backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E8ECF4', shadowColor: '#64748B', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  appName: { fontSize: 14, fontWeight: '700', color: '#0F172A', flex: 1, marginRight: 8 },
  statusPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, gap: 5 },
  pillActive: { backgroundColor: '#F0FDF4' },
  pillBlocked: { backgroundColor: '#FEF2F2' },
  statusDot: { width: 6, height: 6, borderRadius: 3 },
  dotActive: { backgroundColor: '#10B981' },
  dotBlocked: { backgroundColor: '#EF4444' },
  statusText: { fontSize: 10, fontWeight: '700' },
  textActive: { color: '#059669' },
  textBlocked: { color: '#DC2626' },
  progressTrack: { height: 6, backgroundColor: '#F1F5F9', borderRadius: 3, overflow: 'hidden', marginVertical: 10 },
  progressFill: { height: '100%', borderRadius: 3 },
  metaText: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
});
