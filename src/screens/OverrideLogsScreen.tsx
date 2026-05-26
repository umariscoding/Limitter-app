import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Zap, Clock, FileText } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import SideDrawer from '../components/SideDrawer';
import HamburgerButton from '../components/HamburgerButton';
import {
  getOverrideHistoryAPI,
  getOverrideBalanceAPI,
  type OverrideRecordResponse,
  type OverrideBalanceResponse,
} from '../services/overrideService';

export default function OverrideLogsScreen() {
  const navigation = useNavigation<any>();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [balance, setBalance] = useState<OverrideBalanceResponse | null>(null);
  const [logs, setLogs] = useState<OverrideRecordResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = async () => {
    try {
      const [balanceData, historyData] = await Promise.all([
        getOverrideBalanceAPI(),
        getOverrideHistoryAPI(50),
      ]);
      setBalance(balanceData);
      setLogs(historyData.overrides || []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchData(); };

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return '';
    const seconds = timestamp._seconds || timestamp.seconds;
    if (seconds) return new Date(seconds * 1000).toLocaleString();
    return String(timestamp);
  };

  const getModeLabel = (mode: string) =>
    mode === 'free_credit' ? 'Free Credit' : mode === 'paid' ? 'Purchased' : mode || 'Unknown';
  const getModeColors = (mode: string): [string, string] =>
    mode === 'free_credit' ? ['#10B981', '#059669'] : ['#6366F1', '#4F46E5'];

  const humanizeName = (key: string): string => {
    const generic = new Set(['com', 'org', 'net', 'io', 'android', 'app', 'apps', 'mobile', 'lite']);
    const parts = key.split('.').filter(p => !generic.has(p.toLowerCase()));
    const name = parts[parts.length - 1] || key.split('.')[1] || key;
    return name.charAt(0).toUpperCase() + name.slice(1);
  };

  interface GroupedOverride {
    targetKey: string;
    displayName: string;
    count: number;
    mode: string;
    type: string;
    status: string;
    latestDate: any;
  }

  const groupedLogs: GroupedOverride[] = React.useMemo(() => {
    const map = new Map<string, GroupedOverride>();
    for (const log of logs) {
      const key = log.targetKey;
      const existing = map.get(key);
      if (existing) {
        existing.count += 1;
      } else {
        map.set(key, {
          targetKey: key,
          displayName: humanizeName(key),
          count: 1,
          mode: log.mode,
          type: log.type,
          status: log.status,
          latestDate: log.createdAt,
        });
      }
    }
    return Array.from(map.values());
  }, [logs]);

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()}>
          <ChevronLeft size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Overrides</Text>
        <HamburgerButton onPress={() => setDrawerOpen(true)} />
      </View>

      <ScrollView
        contentContainerStyle={s.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View style={s.emptyState}>
            <ActivityIndicator size="large" color="#6366F1" />
          </View>
        ) : (
          <>
            {balance && (
              <>
                <View style={s.balanceCard}>
                  <View style={s.balanceHeader}>
                    <View style={s.balanceIconWrap}>
                      <Zap size={20} color="#F59E0B" />
                    </View>
                    <View>
                      <Text style={s.balanceTitle}>Available Credits</Text>
                      <Text style={s.balanceTotal}>{balance.unlimited ? '\u221E' : balance.totalAvailable}</Text>
                    </View>
                  </View>

                  <View style={s.balanceDivider} />

                  <View style={s.balanceGrid}>
                    <View style={s.balanceStat}>
                      <Text style={s.balanceStatValue}>{balance.unlimited ? '\u221E' : balance.freeRemaining}</Text>
                      <Text style={s.balanceStatLabel}>Free left</Text>
                    </View>
                    <View style={s.balanceStat}>
                      <Text style={s.balanceStatValue}>{balance.grantedRemaining}</Text>
                      <Text style={s.balanceStatLabel}>Purchased</Text>
                    </View>
                    <View style={s.balanceStat}>
                      <Text style={s.balanceStatValue}>{balance.totalUsedThisMonth}</Text>
                      <Text style={s.balanceStatLabel}>Used</Text>
                    </View>
                    <View style={s.balanceStat}>
                      <Text style={s.balanceStatValue}>{balance.unlimited ? '\u221E' : balance.freeOverridesPerMonth}</Text>
                      <Text style={s.balanceStatLabel}>Free / mo</Text>
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => navigation.navigate('BuyOverrides')}
                  activeOpacity={0.8}
                >
                  <LinearGradient colors={['#F59E0B', '#D97706']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={s.buyBtn}>
                    <Zap size={16} color="#FFFFFF" />
                    <Text style={s.buyBtnText}>Buy More Overrides</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            )}

            <Text style={s.sectionTitle}>History</Text>

            {groupedLogs.length === 0 ? (
              <View style={s.emptyState}>
                <View style={s.emptyIconWrap}>
                  <FileText size={36} color="#CBD5E1" />
                </View>
                <Text style={s.emptyTitle}>No overrides yet</Text>
                <Text style={s.emptyDesc}>Override history will appear here when you use credits</Text>
              </View>
            ) : (
              groupedLogs.map((group, index) => (
                <View key={group.targetKey} style={s.logCard}>
                  <View style={s.timelineRow}>
                    <View style={s.timelineDot} />
                    {index < groupedLogs.length - 1 && <View style={s.timelineLine} />}
                  </View>
                  <View style={s.logContent}>
                    <View style={s.logHeader}>
                      <Text style={s.logTarget} numberOfLines={1}>{group.displayName}</Text>
                      {group.count > 1 && (
                        <View style={s.countBadge}>
                          <Text style={s.countBadgeText}>x{group.count}</Text>
                        </View>
                      )}
                      <LinearGradient colors={getModeColors(group.mode)} style={s.modeBadge}>
                        <Text style={s.modeBadgeText}>{getModeLabel(group.mode)}</Text>
                      </LinearGradient>
                    </View>
                    <View style={s.logMeta}>
                      <Clock size={12} color="#94A3B8" />
                      <Text style={s.logDate}>Last used: {formatDate(group.latestDate)}</Text>
                    </View>
                    <View style={s.logFooter}>
                      <Text style={s.logType}>{group.type}</Text>
                      <Text style={s.logStatus}>{group.status}</Text>
                    </View>
                  </View>
                </View>
              ))
            )}

            <View style={{ height: 20 }} />
          </>
        )}
      </ScrollView>

      <SideDrawer visible={drawerOpen} active="overrides" onClose={() => setDrawerOpen(false)} />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 24, paddingBottom: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  backBtn: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  scrollContent: { padding: 20 },

  balanceCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, borderWidth: 1, borderColor: '#E8ECF4', marginBottom: 12, shadowColor: '#64748B', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  balanceHeader: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  balanceIconWrap: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#FFFBEB', alignItems: 'center', justifyContent: 'center' },
  balanceTitle: { fontSize: 13, color: '#64748B', fontWeight: '500' },
  balanceTotal: { fontSize: 28, fontWeight: '900', color: '#0F172A', marginTop: 2 },
  balanceDivider: { height: 1, backgroundColor: '#F1F5F9', marginVertical: 16 },
  balanceGrid: { flexDirection: 'row', justifyContent: 'space-between' },
  balanceStat: { alignItems: 'center', flex: 1 },
  balanceStatValue: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  balanceStatLabel: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 2 },

  buyBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: 14, marginBottom: 24 },
  buyBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  sectionTitle: { fontSize: 13, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },

  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#334155', marginBottom: 6 },
  emptyDesc: { fontSize: 13, color: '#94A3B8', textAlign: 'center', paddingHorizontal: 40 },

  logCard: { flexDirection: 'row', marginBottom: 4 },
  timelineRow: { width: 24, alignItems: 'center', paddingTop: 6 },
  timelineDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#6366F1', borderWidth: 2, borderColor: '#C7D2FE' },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#E2E8F0', marginTop: 4 },
  logContent: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 8, marginLeft: 8, borderWidth: 1, borderColor: '#E8ECF4', shadowColor: '#64748B', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  logTarget: { fontSize: 15, fontWeight: '700', color: '#0F172A', flex: 1, marginRight: 8 },
  countBadge: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10, marginRight: 6 },
  countBadgeText: { fontSize: 11, fontWeight: '800', color: '#475569' },
  modeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  modeBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
  logMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  logDate: { fontSize: 12, color: '#94A3B8' },
  logFooter: { flexDirection: 'row', gap: 12 },
  logType: { fontSize: 11, color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase' },
  logStatus: { fontSize: 11, color: '#10B981', fontWeight: '700', textTransform: 'uppercase' },
});
