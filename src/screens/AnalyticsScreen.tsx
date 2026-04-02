import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar, Platform, ScrollView } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft } from 'lucide-react-native';
import { useUser } from '../context/UserContext';
import { useUsageContext } from '../context/UsageContext';
import { WeeklyUsageGraph } from '../components/WeeklyUsageGraph';
import { getPoliciesAPI } from '../services/policyService';
import { useDeviceResolver } from '../hooks/useDeviceResolver';
import { getNativeBlockedPackages } from '../services/appBlockerService';
import { getPolicyPackageKey, formatLimitTime } from '../utils/policyMapper';

interface BreakdownItem {
  id: string;
  name: string;
  category: string;
  usedMinutes: number;
  limitMinutes: number;
  isBlocked: boolean;
  timerSetAt: number;
}

export default function AnalyticsScreen() {
  const navigation = useNavigation<any>();
  const { user } = useUser();
  const { weeklyUsage, isLoadingWeekly, weeklyError } = useUsageContext();
  const { deviceId } = useDeviceResolver(user?.uid);
  const [breakdown, setBreakdown] = React.useState<BreakdownItem[]>([]);

  const fetchBreakdown = React.useCallback(async () => {
    if (!user?.uid || !deviceId) {
      setBreakdown([]);
      return;
    }

    try {
      const policiesResult = await getPoliciesAPI();
      const policiesData = Array.isArray(policiesResult) ? policiesResult : [];
      const rows = policiesData.map((item: any) => {
        const p = item.policy || item;
        const state = item.policyState || p.policyState || {};
        return {
          id: p.policyId,
          app_name: p.targetKey,
          package_name: p.targetKey,
          packageName: p.targetKey,
          target_label: p.targetLabel,
          category: p.type === 'category' ? p.targetLabel : null,
          max_time_minutes: p.dailyLimitMinutes,
          time_used_minutes: state.usageTodayMinutes || 0,
          is_blocked: state.isExhaustedToday || false,
          created_at: p.createdAt?._seconds ? p.createdAt._seconds * 1000 : Date.now(),
        };
      });

      const nativeBlockedPackages = await getNativeBlockedPackages();

      const normalized: BreakdownItem[] = rows
        .map((row: any, idx: number) => {
          const appName = String(row?.app_name || row?.package_name || row?.packageName || '').trim();
          if (!appName) return null;

          const packageKey = getPolicyPackageKey(row);

          const usedMinutes = Math.max(0, Number(row?.time_used_minutes ?? row?.used_minutes ?? 0));
          const limitMinutes = Math.max(0, Number(row?.max_time_minutes ?? row?.limit_minutes ?? 0));
          const blockedRaw = row?.is_blocked;
          const statusText = String(row?.status_text || row?.status || '').toLowerCase();
          const isBlocked =
            typeof blockedRaw === 'boolean'
              ? blockedRaw
              : statusText.includes('block') || statusText.includes('blocked');

          const blockedByUsage = limitMinutes > 0 && usedMinutes >= limitMinutes;
          const blockedUntil = Number(row?.blocked_until_timestamp || 0);
          const blockedByUntil = blockedUntil > Date.now();
          const blockedByNative = packageKey ? nativeBlockedPackages.has(packageKey) : false;

          let resolvedBlocked = isBlocked || blockedByUsage || blockedByUntil || blockedByNative;

          const timerSetAt = Math.max(
            Number(new Date(row?.created_at || 0).getTime() || 0),
            Number(new Date(row?.updated_at || 0).getTime() || 0)
          );

          return {
            id: String(row?.id || row?.limit_id || `${appName}-${idx}`),
            name: appName,
            category: String(row?.category || row?.category_name || 'General').trim(),
            usedMinutes,
            limitMinutes,
            isBlocked: resolvedBlocked,
            timerSetAt,
          } as BreakdownItem;
        })
        .filter((item: BreakdownItem | null): item is BreakdownItem => !!item);

      const latestByApp = new Map<string, BreakdownItem>();
      normalized.forEach((item: BreakdownItem) => {
        const key = item.name.trim().toLowerCase();
        const existing = latestByApp.get(key);
        if (!existing || item.timerSetAt > existing.timerSetAt) {
          latestByApp.set(key, item);
        }
      });

      const mapped = Array.from(latestByApp.values())
        .sort((a: BreakdownItem, b: BreakdownItem) => {
          if (b.timerSetAt !== a.timerSetAt) return b.timerSetAt - a.timerSetAt;
          return b.limitMinutes - a.limitMinutes;
        })
        .slice(0, 6);

      setBreakdown(mapped);
    } catch {
      setBreakdown([]);
    }
  }, [user?.uid, deviceId]);

  React.useEffect(() => {
    void fetchBreakdown();
  }, [fetchBreakdown]);

  const onRefreshAll = React.useCallback(async () => {
    await fetchBreakdown();
  }, [fetchBreakdown]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Analytics</Text>
        <View style={styles.rightSpace} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <WeeklyUsageGraph
          title="My Activity - 7 Day Usage"
          data={weeklyUsage}
          isLoading={isLoadingWeekly}
          error={weeklyError}
          onRefresh={() => {
            void onRefreshAll();
          }}
        />

        <View style={styles.breakdownSection}>
          <Text style={styles.breakdownTitle}>App Breakdown (Recent Timers)</Text>
          {breakdown.length === 0 ? (
            <View style={styles.breakdownCard}>
              <Text style={styles.emptyText}>No app usage breakdown available yet.</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.breakdownScroll}
              contentContainerStyle={styles.breakdownScrollContent}
              nestedScrollEnabled
              showsVerticalScrollIndicator
            >
              {breakdown.map(item => {
                const pct = item.limitMinutes > 0 ? Math.min(100, (item.usedMinutes / item.limitMinutes) * 100) : 0;
                return (
                  <View key={item.id} style={styles.breakdownCard}>
                    <View style={styles.breakdownRow}>
                      <Text style={styles.appName}>{item.name}</Text>
                      <View style={[styles.statusBadge, item.isBlocked ? styles.statusBlocked : styles.statusActive]}>
                        <Text style={[styles.statusText, item.isBlocked ? styles.statusTextBlocked : styles.statusTextActive]}>
                          {item.isBlocked ? 'Blocked' : 'Active'}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.breakdownRow}>
                      <Text style={styles.appCategory}>{item.category}</Text>
                      <Text style={styles.appTime}>{formatLimitTime(item.usedMinutes)}</Text>
                    </View>
                    <View style={styles.track}>
                      <View style={[styles.fill, { width: `${pct}%` }]} />
                    </View>
                    <View style={styles.breakdownRow}>
                      <Text style={styles.metaText}>Used: {formatLimitTime(item.usedMinutes)}</Text>
                      <Text style={styles.metaText}>Limit: {formatLimitTime(item.limitMinutes)}</Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </ScrollView>
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
    paddingBottom: 30,
  },
  breakdownSection: {
    marginTop: 16,
  },
  breakdownScroll: {
    maxHeight: 360,
  },
  breakdownScrollContent: {
    paddingBottom: 6,
  },
  breakdownTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 10,
  },
  breakdownCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 12,
    marginBottom: 10,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  appName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0F172A',
  },
  appTime: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1D4ED8',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusActive: {
    backgroundColor: '#DCFCE7',
  },
  statusBlocked: {
    backgroundColor: '#FEE2E2',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusTextActive: {
    color: '#166534',
  },
  statusTextBlocked: {
    color: '#991B1B',
  },
  appCategory: {
    marginTop: 4,
    fontSize: 12,
    color: '#64748B',
  },
  track: {
    marginTop: 8,
    height: 8,
    borderRadius: 5,
    backgroundColor: '#E2E8F0',
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    backgroundColor: '#2563EB',
  },
  metaText: {
    marginTop: 8,
    fontSize: 11,
    color: '#64748B',
    fontWeight: '600',
  },
  emptyText: {
    fontSize: 13,
    color: '#64748B',
    fontWeight: '600',
  },
});
