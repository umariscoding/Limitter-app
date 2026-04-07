import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { useUsageContext } from '../context/UsageContext';
import { usePolicyContext } from '../context/PolicyContext';
import { getWeeklyUsageAPI } from '../services/usageService';
import { useUser } from '../context/UserContext';
import { WeeklyUsageGraph } from '../components/WeeklyUsageGraph';
import BottomNav from '../components/BottomNav';

export default function UsageScreen() {
  const navigation = useNavigation<any>();
  const { user } = useUser();
  const { weeklyUsage, isLoadingWeekly, weeklyError, setWeeklyUsage, setIsLoadingWeekly, setWeeklyError } = useUsageContext();
  const { policies } = usePolicyContext();
  const [todayIndex, setTodayIndex] = useState(-1);

  const handleRefresh = useCallback(async () => {
    setIsLoadingWeekly(true);
    setWeeklyError(null);
    try {
      const days = await getWeeklyUsageAPI(user?.accountId);

      const WEEK_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      const slots: Array<{ dateKey: string; totalMinutes: number } | null> = new Array(7).fill(null);

      for (const d of days) {
        const date = new Date(d.dateKey + 'T12:00:00');
        const jsDay = date.getDay();
        const monIdx = jsDay === 0 ? 6 : jsDay - 1;
        if (!slots[monIdx] || d.dateKey > slots[monIdx]!.dateKey) {
          slots[monIdx] = d;
        }
      }

      const points = WEEK_LABELS.map((label, idx) => ({
        dateKey: slots[idx]?.dateKey || `day-${idx}`,
        label,
        totalMinutes: slots[idx]?.totalMinutes ?? 0,
      }));

      const jsToday = new Date().getDay();
      setTodayIndex(jsToday === 0 ? 6 : jsToday - 1);
      setWeeklyUsage(points);
    } catch (err: any) {
      setWeeklyError(err?.message || 'Failed to load usage data');
    } finally {
      setIsLoadingWeekly(false);
    }
  }, [user?.accountId, setWeeklyUsage, setIsLoadingWeekly, setWeeklyError]);

  // Override today's bar with real-time total from policies
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Usage</Text>
        <View style={styles.rightSpace} />
      </View>

      <View style={styles.content}>
        <WeeklyUsageGraph
          title="My Activity - 7 Day Usage"
          data={graphData}
          todayIndex={todayIndex}
          isLoading={isLoadingWeekly}
          error={weeklyError}
          onRefresh={handleRefresh}
        />
      </View>
      <BottomNav active="analytics" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 12 : 12,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F1F5F9',
  },
  rightSpace: {
    width: 40,
    height: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
  },
  content: {
    padding: 16,
  },
});
