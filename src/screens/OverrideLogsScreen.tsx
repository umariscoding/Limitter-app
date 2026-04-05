import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Platform,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, Zap, Clock, FileText } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import BottomNav from '../components/BottomNav';
import { getOverrideHistoryAPI, type OverrideRecordResponse } from '../services/overrideService';

export default function OverrideLogsScreen() {
  const navigation = useNavigation<any>();
  const [logs, setLogs] = useState<OverrideRecordResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLogs = async () => {
    try {
      const data = await getOverrideHistoryAPI(50);
      setLogs(data.overrides || []);
    } catch { setLogs([]); }
    finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchLogs(); }, []);

  const onRefresh = () => { setRefreshing(true); fetchLogs(); };

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return '';
    const seconds = timestamp._seconds || timestamp.seconds;
    if (seconds) return new Date(seconds * 1000).toLocaleString();
    return String(timestamp);
  };

  const getModeLabel = (mode: string) => mode === 'free_credit' ? 'Free Credit' : mode === 'paid' ? 'Purchased' : mode || 'Unknown';
  const getModeColors = (mode: string): [string, string] => mode === 'free_credit' ? ['#10B981', '#059669'] : ['#6366F1', '#4F46E5'];

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ChevronLeft size={22} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Override History</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color="#6366F1" />
          </View>
        ) : logs.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <FileText size={36} color="#CBD5E1" />
            </View>
            <Text style={styles.emptyTitle}>No overrides yet</Text>
            <Text style={styles.emptyDesc}>Override history will appear here when you use override credits</Text>
          </View>
        ) : (
          logs.map((log, index) => (
            <View key={log.overrideId} style={styles.logCard}>
              <View style={styles.timelineRow}>
                <View style={styles.timelineDot} />
                {index < logs.length - 1 && <View style={styles.timelineLine} />}
              </View>
              <View style={styles.logContent}>
                <View style={styles.logHeader}>
                  <Text style={styles.logTarget} numberOfLines={1}>{log.targetKey}</Text>
                  <LinearGradient colors={getModeColors(log.mode)} style={styles.modeBadge}>
                    <Text style={styles.modeBadgeText}>{getModeLabel(log.mode)}</Text>
                  </LinearGradient>
                </View>
                <View style={styles.logMeta}>
                  <Clock size={12} color="#94A3B8" />
                  <Text style={styles.logDate}>{formatDate(log.createdAt)}</Text>
                </View>
                <View style={styles.logFooter}>
                  <Text style={styles.logType}>{log.type}</Text>
                  <Text style={styles.logStatus}>{log.status}</Text>
                </View>
              </View>
            </View>
          ))
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomNav active="settings" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  backButton: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#0F172A' },
  scrollContent: { padding: 20 },

  emptyState: { alignItems: 'center', paddingVertical: 60 },
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
  modeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  modeBadgeText: { fontSize: 10, fontWeight: '800', color: '#FFFFFF' },
  logMeta: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  logDate: { fontSize: 12, color: '#94A3B8' },
  logFooter: { flexDirection: 'row', gap: 12 },
  logType: { fontSize: 11, color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase' },
  logStatus: { fontSize: 11, color: '#10B981', fontWeight: '700', textTransform: 'uppercase' },
});
