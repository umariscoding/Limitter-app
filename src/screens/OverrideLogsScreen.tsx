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
import { overrideLogLabels } from '../data/appData';
import { ArrowLeft } from 'lucide-react-native';
import BottomNav from '../components/BottomNav';
import { getOverrideHistoryAPI, type OverrideRecordResponse } from '../services/overrideService';

export default function OverrideLogsScreen() {
  const navigation = useNavigation<any>();
  const [logs, setLogs] = useState<OverrideRecordResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLogs = async () => {
    try {
      const data = await getOverrideHistoryAPI(50, 0);
      setLogs(data.overrides || []);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchLogs();
  };

  const formatDate = (timestamp: any): string => {
    if (!timestamp) return '';
    const seconds = timestamp._seconds || timestamp.seconds;
    if (seconds) {
      return new Date(seconds * 1000).toLocaleString();
    }
    return String(timestamp);
  };

  const getModeLabel = (mode: string): string => {
    if (mode === 'free_credit') return 'Free Credit';
    if (mode === 'paid') return 'Paid';
    return mode || 'Unknown';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{overrideLogLabels.headerTitle}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {loading ? (
          <View style={styles.emptyState}>
            <ActivityIndicator size="large" color="#4F46E5" />
          </View>
        ) : logs.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>{overrideLogLabels.emptyState}</Text>
          </View>
        ) : (
          logs.map((log) => (
            <View key={log.overrideId} style={styles.logCard}>
              <View style={styles.logHeader}>
                <Text style={styles.appName}>{log.targetKey}</Text>
                <Text style={styles.deviceBadge}>{getModeLabel(log.mode)}</Text>
              </View>
              <Text style={styles.logDate}>{formatDate(log.createdAt)}</Text>
              <View style={styles.logMeta}>
                <Text style={styles.logType}>{log.type}</Text>
                <Text style={styles.logStatus}>{log.status}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <BottomNav active="settings" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 12 : 12, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', backgroundColor: '#FFFFFF' },
  backButton: { padding: 8, marginRight: 10 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#0F172A', flex: 1, textAlign: 'center' },
  headerSpacer: { width: 40 },
  scrollContent: { padding: 20 },
  emptyState: { padding: 40, alignItems: 'center' },
  emptyStateText: { color: '#64748B', fontSize: 16 },
  logCard: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  logHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  appName: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  deviceBadge: { fontSize: 12, color: '#4F46E5', backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, overflow: 'hidden', fontWeight: '600' },
  logDate: { fontSize: 14, color: '#64748B', marginBottom: 6 },
  logMeta: { flexDirection: 'row', gap: 12 },
  logType: { fontSize: 12, color: '#94A3B8', fontWeight: '500' },
  logStatus: { fontSize: 12, color: '#10B981', fontWeight: '600' },
});
