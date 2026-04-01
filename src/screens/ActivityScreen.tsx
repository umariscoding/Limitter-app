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
import { useNavigation } from '@react-navigation/native';
import { usePolicyContext } from '../context/PolicyContext';
import { usePolicyFetcher } from '../hooks/usePolicyFetcher';
import { useNativeTimerSync } from '../hooks/useNativeTimerSync';
import { formatLimitTime } from '../utils/policyMapper';

export default function ActivityScreen() {
  const navigation = useNavigation<any>();
  const { policies: limits, isLoading: loading, setPolicies: setLimits } = usePolicyContext();
  const { fetchPolicies } = usePolicyFetcher();
  const [refreshing, setRefreshing] = useState(false);

  useNativeTimerSync(setLimits);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchPolicies();
    setRefreshing(false);
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
                Used: {formatLimitTime(item.time_used_minutes || 0)} / {formatLimitTime(item.max_time_minutes || 0)}
              </Text>
              {item.created_at && (
                <Text style={styles.cardDate}>
                  Created: {new Date(item.created_at).toLocaleDateString()}
                </Text>
              )}
              <Text style={[styles.status, item.is_blocked ? styles.blocked : styles.active]}>
                {item.is_blocked ? 'BLOCKED' : 'ACTIVE'}
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
