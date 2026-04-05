import React, { useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { useUsageContext } from '../context/UsageContext';
import { getWeeklyUsageAPI } from '../services/usageService';
import { WeeklyUsageGraph } from '../components/WeeklyUsageGraph';
import BottomNav from '../components/BottomNav';

export default function UsageScreen() {
  const navigation = useNavigation<any>();
  const { weeklyUsage, isLoadingWeekly, weeklyError, setWeeklyUsage, setIsLoadingWeekly, setWeeklyError } = useUsageContext();

  const handleRefresh = useCallback(async () => {
    setIsLoadingWeekly(true);
    setWeeklyError(null);
    try {
      const data = await getWeeklyUsageAPI();
      const days = Array.isArray(data) ? data : (data as any)?.days || [];
      setWeeklyUsage(days.map((d: any) => ({ dateKey: d.dateKey, totalMinutes: d.totalMinutes || 0 })));
    } catch (err: any) {
      setWeeklyError(err?.message || 'Failed to load usage data');
    } finally {
      setIsLoadingWeekly(false);
    }
  }, [setWeeklyUsage, setIsLoadingWeekly, setWeeklyError]);

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
          data={weeklyUsage}
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
