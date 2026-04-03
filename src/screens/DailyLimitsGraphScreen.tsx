import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { useUser } from '../context/UserContext';
import { useDeviceResolver } from '../hooks/useDeviceResolver';
import { getPoliciesAPI } from '../services/policyService';
import BottomNav from '../components/BottomNav';

type LimitItem = {
  id: string;
  app_name?: string;
  category?: string;
  time_used_minutes?: number;
  max_time_minutes?: number;
  is_blocked?: boolean;
};

const BAR_COLORS = ['#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#14B8A6'];

export default function DailyLimitsGraphScreen() {
  const navigation = useNavigation<any>();
  const { user } = useUser();
  const { deviceId } = useDeviceResolver(user?.uid);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [limits, setLimits] = useState<LimitItem[]>([]);

  const fetchData = async () => {
    if (!user?.uid || !deviceId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const policiesResult = await getPoliciesAPI();
      const policiesData = Array.isArray(policiesResult) ? policiesResult : [];
      const list = policiesData.map((item: any) => {
        const p = item.policy || item;
        const state = item.policyState || p.policyState || {};
        return {
          id: p.policyId,
          app_name: p.targetLabel || p.targetKey,
          category: p.type === 'category' ? p.targetLabel : undefined,
          max_time_minutes: p.dailyLimitMinutes,
          time_used_minutes: state.usageTodayMinutes || 0,
          is_blocked: state.isExhaustedToday || false,
        };
      });
      setLimits(list);
    } catch {
      setLimits([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (deviceId) {
      fetchData();
    }
  }, [user?.uid, deviceId]);

  const chartRows = useMemo(() => {
    const filtered = limits.filter(item => Number(item.max_time_minutes || 0) > 0);
    return filtered.map((item, index) => {
      const used = Number(item.time_used_minutes || 0);
      const max = Number(item.max_time_minutes || 0);
      const pct = Math.max(0, Math.min(100, Math.round((used / max) * 100)));
      const name = item.app_name || item.category || 'Unknown';

      return {
        id: item.id,
        name,
        used,
        max,
        pct,
        blocked: Boolean(item.is_blocked),
        color: BAR_COLORS[index % BAR_COLORS.length],
      };
    });
  }, [limits]);

  const totalUsed = chartRows.reduce((sum, row) => sum + row.used, 0);
  const totalMax = chartRows.reduce((sum, row) => sum + row.max, 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.title}>Daily Time Limits Graph</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              fetchData();
            }}
          />
        }
      >
        {loading ? (
          <View style={styles.centerWrap}>
            <ActivityIndicator size="large" color="#4F46E5" />
            <Text style={styles.loadingText}>Loading graph data...</Text>
          </View>
        ) : chartRows.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No limit data available</Text>
            <Text style={styles.emptySub}>Create app limits first, then daily graph will appear here.</Text>
          </View>
        ) : (
          <>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Today Summary</Text>
              <Text style={styles.summaryText}>{totalUsed} / {totalMax} min used</Text>
            </View>

            {chartRows.map(row => (
              <View key={row.id} style={styles.rowCard}>
                <View style={styles.rowHeader}>
                  <Text style={styles.rowName}>{row.name}</Text>
                  <Text style={styles.rowValue}>{row.used}/{row.max} min</Text>
                </View>
                <View style={styles.progressBg}>
                  <View style={[styles.progressFill, { width: `${row.pct}%`, backgroundColor: row.color }]} />
                </View>
                <View style={styles.rowFooter}>
                  <Text style={styles.rowPct}>{row.pct}% used</Text>
                  <Text style={[styles.rowStatus, row.blocked ? styles.blocked : styles.active]}>
                    {row.blocked ? 'BLOCKED' : 'ACTIVE'}
                  </Text>
                </View>
              </View>
            ))}
          </>
        )}
        <View style={{ height: 80 }} />
      </ScrollView>
      <BottomNav active="analytics" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  backButton: { padding: 8 },
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#0F172A' },
  headerSpacer: { width: 40 },
  content: { padding: 16 },
  centerWrap: { marginTop: 60, alignItems: 'center' },
  loadingText: { marginTop: 10, color: '#64748B' },
  emptyCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
  },
  emptyTitle: { fontWeight: '700', color: '#0F172A', marginBottom: 6 },
  emptySub: { color: '#64748B' },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
  summaryText: { marginTop: 6, color: '#475569' },
  rowCard: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  rowHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  rowName: { fontWeight: '700', color: '#0F172A', flex: 1, paddingRight: 8 },
  rowValue: { color: '#475569', fontWeight: '600' },
  progressBg: { height: 10, borderRadius: 999, backgroundColor: '#E2E8F0', overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  rowFooter: { marginTop: 8, flexDirection: 'row', justifyContent: 'space-between' },
  rowPct: { color: '#64748B', fontSize: 12 },
  rowStatus: { fontWeight: '700', fontSize: 12 },
  active: { color: '#16A34A' },
  blocked: { color: '#DC2626' },
});
