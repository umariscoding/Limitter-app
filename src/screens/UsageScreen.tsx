import React, { useRef, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { useUsageContext } from '../context/UsageContext';
import { getWeeklyUsageAPI } from '../services/usageService';
import { useUser } from '../context/UserContext';
import { WeeklyUsageGraph } from '../components/WeeklyUsageGraph';
import SideDrawer from '../components/SideDrawer';
import HamburgerButton from '../components/HamburgerButton';

export default function UsageScreen() {
  const navigation = useNavigation<any>();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user } = useUser();
  const { weeklyUsage, isLoadingWeekly, weeklyError, setWeeklyUsage, setIsLoadingWeekly, setWeeklyError } = useUsageContext();
  const [todayIndex, setTodayIndex] = useState(-1);

  const handleRefresh = useRef(async () => {
    setIsLoadingWeekly(true);
    setWeeklyError(null);
    try {
      const days = await getWeeklyUsageAPI(user?.accountId);
      const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const dayMap = new Map(days.map(d => [d.dateKey, d.totalMinutes]));
      const today = new Date().toISOString().slice(0, 10);

      const points: typeof weeklyUsage = [];
      let todayIdx = -1;
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateKey = date.toISOString().slice(0, 10);
        const label = DAY_NAMES[date.getDay()];
        points.push({
          dateKey,
          label,
          totalMinutes: dayMap.get(dateKey) ?? 0,
        });
        if (dateKey === today) todayIdx = points.length - 1;
      }

      setTodayIndex(todayIdx);
      setWeeklyUsage(points);
    } catch (err: any) {
      setWeeklyError(err?.message || 'Failed to load usage data');
    } finally {
      setIsLoadingWeekly(false);
    }
  }).current;

  const graphData = useMemo(() => weeklyUsage, [weeklyUsage]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Usage</Text>
        <HamburgerButton onPress={() => setDrawerOpen(true)} />
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
      <SideDrawer visible={drawerOpen} active="analytics" onClose={() => setDrawerOpen(false)} />
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
