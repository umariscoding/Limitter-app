import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useUser } from '../context/UserContext';
import { getPoliciesAPI } from '../services/policyService';
import { getNativeBlockedPackages } from '../native/appBlockerService';
import { subscribeTimerBlocked, subscribeTimerTicks } from '../native/timerRealtimeService';
import { resolveCurrentDeviceId } from '../native/currentDeviceService';

export default function ActivityScreen() {
  const navigation = useNavigation<any>();
  const { user } = useUser();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [limits, setLimits] = useState<any[]>([]);
  const [deviceId, setDeviceId] = useState<string>('');

  const getLimitPackageKey = React.useCallback((item: any) => {
    return String(item?.app_name || item?.package_name || item?.packageName || '')
      .trim()
      .toLowerCase();
  }, []);

  const matchesLimitPackage = React.useCallback(
    (item: any, packageName?: string) => {
      if (!packageName) return false;
      return getLimitPackageKey(item) === String(packageName).trim().toLowerCase();
    },
    [getLimitPackageKey]
  );

  const resolveBlockedState = React.useCallback((item: any) => {
    if (typeof item?.is_blocked === 'boolean') return item.is_blocked;

    const rawStatus = String(item?.status_text || item?.status || '')
      .trim()
      .toLowerCase();
    if (rawStatus.includes('block')) return true;
    if (rawStatus.includes('active') || rawStatus.includes('running') || rawStatus.includes('unblocked')) {
      return false;
    }

    const blockedUntil = Number(item?.blocked_until_timestamp || 0);
    if (blockedUntil > Date.now()) return true;

    const maxMinutes = Number(item?.max_time_minutes || 0);
    const usedMinutes = Number(item?.time_used_minutes || 0);
    return maxMinutes > 0 && usedMinutes >= maxMinutes;
  }, []);

  const normalizeLimit = React.useCallback(
    (item: any) => ({
      ...item,
      is_blocked: resolveBlockedState(item),
    }),
    [resolveBlockedState]
  );

  React.useEffect(() => {
    const loadCurrentDevice = async () => {
      if (!user?.uid) return;
      const resolvedId = await resolveCurrentDeviceId(user.uid);
      if (resolvedId) {
        setDeviceId(resolvedId);
      }
    };

    loadCurrentDevice();
  }, [user?.uid]);

  const fetchActivity = async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    if (!deviceId) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const policiesResult = await getPoliciesAPI();
      const policiesData = Array.isArray(policiesResult) ? policiesResult : [];
      // Map policies to limit shape and sort with latest first
      const list = policiesData.map((item: any) => {
        const p = item.policy || item;
        const state = item.policyState || p.policyState || {};
        return {
          id: p.policyId,
          app_name: p.targetKey,
          package_name: p.targetKey,
          packageName: p.targetKey,
          category: p.type === 'category' ? p.targetLabel : null,
          target_label: p.targetLabel,
          target_type: p.type,
          max_time_minutes: p.dailyLimitMinutes,
          time_used_minutes: state.usageTodayMinutes || 0,
          is_blocked: state.isExhaustedToday || false,
          blocked_until_timestamp: 0,
          created_at: p.createdAt?._seconds ? p.createdAt._seconds * 1000 : Date.now(),
        };
      });
      const sortedList = list.sort(
        (a: any, b: any) => b.created_at - a.created_at
      );
      const normalizedList = sortedList.map(normalizeLimit);
      const nativeBlockedPackages = await getNativeBlockedPackages();

      const reconciledList = normalizedList.map((item: any) => {
        const key = getLimitPackageKey(item);
        if (nativeBlockedPackages.has(key)) {
          return { ...item, is_blocked: true };
        }
        return item;
      });

      setLimits(reconciledList);
      console.log('📊 Activity - All limits:', sortedList);
    } catch (error) {
      console.error('Activity fetch failed:', error);
      setLimits([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      if (!deviceId) return;
      setLoading(true);
      fetchActivity();
    }, [user?.uid, deviceId])
  );

  React.useEffect(() => {
    const unsubTick = subscribeTimerTicks(event => {
      if (!event?.package) return;

      setLimits(prev =>
        prev.map((item: any) => {
          if (!matchesLimitPackage(item, event.package)) return item;

          const maxMinutes = Number(item.max_time_minutes || 0);
          const consumedSeconds = Math.max(0, maxMinutes * 60 - Number(event.remaining || 0));
          const eventBlocked =
            typeof event.isBlocked === 'boolean'
              ? event.isBlocked
              : String(event.status || '').toLowerCase() === 'blocked';

          return {
            ...item,
            time_used_minutes: Math.floor(consumedSeconds / 60),
            is_blocked: eventBlocked,
          };
        })
      );
    });

    const unsubBlocked = subscribeTimerBlocked(event => {
      if (!event?.package) return;
      setLimits(prev =>
        prev.map((item: any) =>
          matchesLimitPackage(item, event.package) ? { ...item, is_blocked: true } : item
        )
      );
    });

    return () => {
      unsubTick();
      unsubBlocked();
    };
  }, [user?.uid, matchesLimitPackage]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchActivity();
  };

  const formatMinutes = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  };

  if (loading && !refreshing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContent}>
          <ActivityIndicator size="large" color="#4F46E5" />
          <Text style={styles.loadingText}>Loading activity...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Complete Activity</Text>
          <Text style={styles.subtitle}>{limits.length} total limits</Text>
        </View>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {limits.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No activity history yet</Text>
            <Text style={styles.emptySubText}>All limits you create will appear here in reverse chronological order.</Text>
          </View>
        ) : (
          limits.map((item: any) => (
            <View key={item.id} style={styles.card}>
              <Text style={styles.cardTitle}>{item.app_name || item.category || 'Untitled'}</Text>
              <Text style={styles.cardLine}>
                Used: {formatMinutes(item.time_used_minutes || 0)} / {formatMinutes(item.max_time_minutes || 0)}
              </Text>
              {item.created_at && (
                <Text style={styles.cardDate}>
                  Created: {new Date(item.created_at).toLocaleDateString()}
                </Text>
              )}
              <Text style={[styles.status, item.is_blocked ? styles.blocked : styles.active]}>
                {item.is_blocked ? '🔴 BLOCKED' : '🟢 ACTIVE'}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  backBtn: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  backBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  content: {
    padding: 16,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#64748B',
  },
  emptyState: {
    marginTop: 30,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  emptyText: {
    color: '#0F172A',
    fontWeight: '700',
    marginBottom: 6,
  },
  emptySubText: {
    color: '#64748B',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 10,
  },
  cardTitle: {
    color: '#0F172A',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  cardLine: {
    color: '#334155',
    marginBottom: 8,
  },
  cardDate: {
    color: '#94A3B8',
    fontSize: 11,
    marginBottom: 6,
  },
  status: {
    fontWeight: '800',
    fontSize: 12,
  },
  active: {
    color: '#16A34A',
  },
  blocked: {
    color: '#DC2626',
  },
});
