import React, { useState, useEffect, useMemo, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Dimensions,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { 
  Bell, 
  ChevronLeft, 
  AlertTriangle, 
  Instagram, 
  Gamepad2, 
  Youtube, 
  BookOpen, 
  BellRing,
  Home,
  BarChart2,
  Settings as SettingsIcon
} from 'lucide-react-native';
import { 
  todayUsage, 
  hourlyChart, 
  thresholdAlert, 
  appBreakdown, 
  quickInsights,
  analyticsLabels
} from '../data/appData';

const { width } = Dimensions.get('window');

// ─── MEMOIZED SUB-COMPONENTS TO PREVENT UNNECESSARY RE-RENDERS ────────────────

const CountdownTimer = memo(() => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      const diff = midnight.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeLeft('00:00:00');
        return;
      }
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      const minutes = Math.floor((diff / (1000 * 60)) % 60);
      const seconds = Math.floor((diff / 1000) % 60);
      const format = (num: number) => num.toString().padStart(2, '0');
      setTimeLeft(`${format(hours)}:${format(minutes)}:${format(seconds)}`);
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <View style={styles.countdownContainer}>
      <Text style={styles.countdownLabel}>{String(analyticsLabels.resetsIn)}</Text>
      <Text style={styles.countdownValue}>{String(timeLeft || '00:00:00')}</Text>
    </View>
  );
});

const HourlyActivityChart = memo(({ data }: { data: typeof hourlyChart }) => (
  <View style={styles.chartSection}>
    <Text style={styles.sectionTitle}>{String(analyticsLabels.hourlyActivity)}</Text>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartScroll}>
      <View style={styles.chartContainer}>
        {data.map((item, index) => {
          const barHeight = (item.minutes / 70) * 120;
          return (
            <View key={index} style={styles.barWrapper}>
              <Text style={styles.barValue}>{String(item.minutes)}m</Text>
              <View style={styles.barBase}>
                <View style={[styles.barFill, { height: barHeight }]} />
              </View>
              <Text style={styles.barLabel}>{String(item.label)}</Text>
            </View>
          );
        })}
      </View>
    </ScrollView>
  </View>
));

const AppBreakdownList = memo(({ 
  data, 
  onNavigate 
}: { 
  data: typeof appBreakdown; 
  onNavigate: () => void 
}) => {
  const formatTime = (mins: number) => {
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  return (
    <View style={styles.breakdownSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{String(analyticsLabels.appBreakdown)}</Text>
        <TouchableOpacity onPress={onNavigate}>
          <Text style={styles.viewAllText}>{String(analyticsLabels.viewAllLink)}</Text>
        </TouchableOpacity>
      </View>
      {data.map((item) => {
        const itemPct = (item.usedMinutes / item.limitMinutes) * 100;
        let barColor = '#10B981';
        let badgeText = '';
        if (itemPct >= 90) {
          barColor = '#EF4444';
          badgeText = 'Critical Threshold Reached';
        } else if (itemPct >= 75) {
          barColor = '#F59E0B';
          badgeText = 'Approaching Daily Limit';
        }
        const IconComponent = 
          item.icon === 'instagram' ? Instagram :
          item.icon === 'gamepad-2' ? Gamepad2 :
          item.icon === 'youtube' ? Youtube :
          item.icon === 'book-open' ? BookOpen : AlertTriangle;

        return (
          <View key={item.id} style={styles.appCard}>
            <View style={styles.appTopRow}>
              <View style={[styles.iconCircle, { backgroundColor: item.color + '20' }]}>
                <IconComponent size={20} color={item.color} />
              </View>
              <View style={styles.appNameContainer}>
                <Text style={styles.appName}>{String(item.name)}</Text>
                <Text style={styles.appCategory}>{String(item.category)}</Text>
              </View>
              <Text style={styles.appTimeUsed}>{String(formatTime(item.usedMinutes))}</Text>
            </View>
            <View style={styles.appProgressContainer}>
              <View style={styles.appProgressBarBackground}>
                <View style={[styles.appProgressBarFill, { width: `${Math.min(itemPct, 100)}%`, backgroundColor: barColor }]} />
                <View style={styles.criticalMarker} />
              </View>
            </View>
            {!!badgeText && (
              <View style={[styles.warningBadge, { backgroundColor: itemPct >= 90 ? '#FEE2E2' : '#FEF9C3' }]}>
                <Text style={[styles.warningText, { color: itemPct >= 90 ? '#DC2626' : '#CA8A04' }]}>{String(badgeText)}</Text>
              </View>
            )}
            <View style={styles.appBottomRow}>
              <Text style={styles.mutedText}>{String(formatTime(item.usedMinutes))} used</Text>
              <Text style={styles.mutedText}>{String(formatTime(item.limitMinutes))} limit</Text>
            </View>
          </View>
        );
      })}
      <TouchableOpacity style={styles.viewAllButton} onPress={onNavigate}>
        <Text style={styles.viewAllButtonText}>{String(analyticsLabels.viewAllButton)}</Text>
      </TouchableOpacity>
    </View>
  );
});

// ─── MAIN SCREEN ─────────────────────────────────────────────────────────────

export default function AnalyticsScreen() {
  const navigation = useNavigation<any>();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Small delay to ensure navigation transition completes before rendering heavy UI
    const timer = setTimeout(() => setIsReady(true), 50);
    return () => clearTimeout(timer);
  }, []);

  const pct = useMemo(() => (todayUsage.usedMinutes / todayUsage.limitMinutes) * 100, []);
  
  const progressBarColor = useMemo(() => {
    if (pct > 90) return '#EF4444';
    if (pct >= 75) return '#F59E0B';
    return '#10B981';
  }, [pct]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ChevronLeft size={24} color="#0F172A" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle}>{String(analyticsLabels.headerTitle)}</Text>
          <Text style={styles.headerSubtitle}>{String(analyticsLabels.headerSubtitle)}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {!isReady ? (
          <View style={{ height: 300, justifyContent: 'center', alignItems: 'center' }}>
            {/* Optional: Add a subtle loading indicator or just empty space for a split second */}
          </View>
        ) : (
          <>
            {/* Today's Usage Section */}
            <View style={styles.usageCard}>
              <Text style={styles.usageTime}>{String(todayUsage.totalTime)}</Text>
              <Text style={styles.usageLabel}>{String(analyticsLabels.usageLabel)}</Text>
              <Text style={styles.limitLabel}>{String(analyticsLabels.limitLabel)}{String(todayUsage.dailyLimitLabel)}</Text>
              <View style={styles.progressContainer}>
                <View style={styles.progressBarBackground}>
                  <View style={[styles.progressBarFill, { width: `${Math.min(pct, 100)}%`, backgroundColor: progressBarColor }]} />
                </View>
              </View>
              <CountdownTimer />
            </View>

            <HourlyActivityChart data={hourlyChart} />

            {/* Alert Section */}
            <View style={styles.alertBox}>
              <View style={styles.alertHeader}>
                <Bell size={20} color="#F59E0B" style={styles.alertIcon} />
                <View style={styles.alertTextContainer}>
                  <Text style={styles.alertMessage}>{String(thresholdAlert.message)}</Text>
                  <Text style={styles.alertSubtext}>{String("You will receive a push notification at each threshold.")}</Text>
                </View>
              </View>
            </View>

            <AppBreakdownList 
              data={appBreakdown} 
              onNavigate={() => navigation.navigate('AddContentScreen')} 
            />

            {/* Quick Insights Section */}
            <View style={styles.insightsSection}>
              <Text style={styles.sectionTitle}>{String(analyticsLabels.quickInsights)}</Text>
              <View style={styles.insightsRow}>
                <View style={styles.insightWidget1}>
                  <Gamepad2 size={24} color={String(quickInsights.mostUsedCategory.color)} style={styles.insightIcon} />
                  <Text style={styles.insightLabel}>{String(analyticsLabels.mostUsedCategory)}</Text>
                  <Text style={styles.insightValue}>{String(quickInsights.mostUsedCategory.name)}</Text>
                  <Text style={styles.insightSubtext}>{String(quickInsights.mostUsedCategory.totalTime)}{String(analyticsLabels.todayAt)}</Text>
                </View>
                <View style={styles.insightWidget2}>
                  <BellRing size={24} color="#EF4444" style={styles.insightIcon} />
                  <Text style={styles.insightLabel}>{String(analyticsLabels.alertsTriggered)}</Text>
                  <Text style={styles.insightValueRed}>{String(quickInsights.alertsTriggered.count)}</Text>
                  <Text style={styles.insightSubtext}>{String(quickInsights.alertsTriggered.label)}</Text>
                </View>
              </View>
            </View>

            <View style={{ height: 100 }} />
          </>
        )}
      </ScrollView>

      {/* Bottom Nav Bar */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('DashboardScreen')}>
          <Home size={22} color="#94A3B8" />
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>
        <View style={styles.navItem}>
          <BarChart2 size={22} color="#4F46E5" />
          <Text style={[styles.navLabel, styles.activeNavText]}>Usage</Text>
        </View>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('SettingsScreen')}>
          <SettingsIcon size={22} color="#94A3B8" />
          <Text style={styles.navLabel}>Settings</Text>
        </TouchableOpacity>
      </View>
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
    borderBottomColor: '#F1F5F9' 
  },
  backButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  headerTitleContainer: { alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  headerSubtitle: { fontSize: 12, color: '#64748B', marginTop: 2 },
  scrollContent: { padding: 20, paddingBottom: 0 },
  usageCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, alignItems: 'center', marginBottom: 24, shadowColor: '#64748B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4 },
  usageTime: { fontSize: 48, fontWeight: '800', color: '#0F172A' },
  usageLabel: { fontSize: 16, fontWeight: '600', color: '#64748B', marginTop: 4 },
  limitLabel: { fontSize: 14, color: '#94A3B8', marginTop: 8 },
  progressContainer: { width: '100%', marginTop: 20, marginBottom: 16 },
  progressBarBackground: { height: 8, width: '100%', backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 4 },
  countdownContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 },
  countdownLabel: { fontSize: 14, fontWeight: '600', color: '#64748B', marginRight: 8 },
  countdownValue: { fontSize: 16, fontWeight: '700', color: '#4F46E5', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  chartSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#1E293B', marginBottom: 16 },
  chartScroll: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  chartContainer: { flexDirection: 'row', alignItems: 'flex-end', paddingBottom: 8 },
  barWrapper: { alignItems: 'center', marginRight: 16, width: 28 },
  barValue: { fontSize: 10, fontWeight: '600', color: '#64748B', marginBottom: 4 },
  barBase: { height: 120, width: 28, backgroundColor: '#F8FAFC', borderRadius: 6, justifyContent: 'flex-end', overflow: 'hidden' },
  barFill: { width: '100%', backgroundColor: '#6366F1', borderRadius: 6 },
  barLabel: { fontSize: 10, color: '#94A3B8', marginTop: 8, fontWeight: '500' },
  alertBox: { backgroundColor: '#FFFBEB', borderRadius: 16, borderLeftWidth: 4, borderLeftColor: '#F59E0B', padding: 16, marginBottom: 24 },
  alertHeader: { flexDirection: 'row' },
  alertIcon: { marginTop: 2, marginRight: 12 },
  alertTextContainer: { flex: 1 },
  alertMessage: { fontSize: 14, fontWeight: '700', color: '#92400E', marginBottom: 4 },
  alertSubtext: { fontSize: 12, color: '#B45309', lineHeight: 16 },
  breakdownSection: { marginBottom: 24 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  viewAllText: { fontSize: 14, color: '#4F46E5', fontWeight: '600' },
  appCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 16, marginBottom: 12, shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  appTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  appNameContainer: { flex: 1 },
  appName: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  appCategory: { fontSize: 12, color: '#64748B', marginTop: 2 },
  appTimeUsed: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
  appProgressContainer: { marginBottom: 12 },
  appProgressBarBackground: { height: 8, width: '100%', backgroundColor: '#F1F5F9', borderRadius: 4, position: 'relative', overflow: 'hidden' },
  appProgressBarFill: { height: '100%', borderRadius: 4 },
  criticalMarker: { position: 'absolute', left: '90%', width: 2, height: 16, backgroundColor: '#EF4444', top: -4 },
  warningBadge: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginBottom: 10 },
  warningText: { fontSize: 11, fontWeight: '700' },
  appBottomRow: { flexDirection: 'row', justifyContent: 'space-between' },
  mutedText: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },
  viewAllButton: { width: '100%', paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#6366F1', alignItems: 'center', marginTop: 8 },
  viewAllButtonText: { color: '#6366F1', fontWeight: '700', fontSize: 14 },
  insightsSection: { marginBottom: 24 },
  insightsRow: { flexDirection: 'row', gap: 8 },
  insightWidget1: { flex: 1, backgroundColor: '#FDF2F8', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#FBCFE8' },
  insightWidget2: { flex: 1, backgroundColor: '#FEF2F2', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#FECACA' },
  insightIcon: { marginBottom: 8 },
  insightLabel: { fontSize: 12, color: '#64748B', marginBottom: 4, fontWeight: '500' },
  insightValue: { fontSize: 18, fontWeight: '800', color: '#1E293B', marginBottom: 2 },
  insightValueRed: { fontSize: 22, fontWeight: '800', color: '#EF4444', marginBottom: 2 },
  insightSubtext: { fontSize: 11, color: '#64748B', fontWeight: '500' },
  bottomNav: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: '#FFFFFF', paddingVertical: 12, paddingHorizontal: 24, borderTopWidth: 1, borderTopColor: '#E2E8F0', justifyContent: 'space-between', paddingBottom: 24 },
  navItem: { alignItems: 'center', flex: 1 },
  navIcon: { fontSize: 20, marginBottom: 4, color: '#94A3B8' },
  navLabel: { fontSize: 12, fontWeight: '600', color: '#94A3B8' },
  activeNavText: { color: '#6366F1' },
});
