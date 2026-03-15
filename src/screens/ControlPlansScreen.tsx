import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  SafeAreaView, 
  Alert, 
  Switch,
  Keyboard,
  Platform,
  StatusBar
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { 
  Home, 
  BarChart2, 
  Settings as SettingsIcon, 
  Smartphone, 
  Monitor, 
  Laptop, 
  Tablet,
  Clock,
  Calendar,
  Shield,
  Zap,
  Bell,
  ChevronRight,
  Plus,
  ArrowLeft
} from 'lucide-react-native';

// Standard React Native app, likely no NativeWind setup shown in package.json
// Using StyleSheet for maximum compatibility

import { 
  planDetails, 
  devices as appDevices, 
  usageControls, 
  featureToggles,
  controlLabels,
  dashboardLabels
} from '../data/appData';

type PlanTier = 'Free' | 'Pro' | 'Elite';
type DeviceType = 'phone' | 'tablet' | 'laptop' | 'desktop';

interface Device {
  id: string;
  name: string;
  type: DeviceType;
  model: string;
  status: string;
  icon: string;
}

export default function ControlPlansScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();

  // Mock Data
  const [currentPlan, setCurrentPlan] = useState<PlanTier>(planDetails.currentPlan as PlanTier);

  // Handle Plan Sync from SubscriptionPlansScreen
  useEffect(() => {
    if (route.params?.activePlan) {
      setCurrentPlan(route.params.activePlan);
    }
  }, [route.params?.activePlan]);
  
  const devicesUsed = planDetails.deviceSlotsUsed;
  const devicesTotal = planDetails.deviceSlotsTotal;

  const [managedDevices] = useState<Device[]>(appDevices as Device[]);

  // Usage Controls State
  const [safeBrowsing, setSafeBrowsing] = useState(featureToggles.find(f => f.key === 'safeBrowsing')?.defaultValue ?? true);
  const [smartOverride, setSmartOverride] = useState(featureToggles.find(f => f.key === 'smartOverride')?.defaultValue ?? true);

  // Derived Values
  const progressPercentage = (devicesUsed / devicesTotal) * 100;
  const slotsRemaining = devicesTotal - devicesUsed;
  const isTopPlan = currentPlan === 'Elite';

  const getDeviceIcon = (iconName: string, color = "#64748B") => {
    switch(iconName) {
      case 'smartphone': return <Smartphone size={22} color={color} />;
      case 'monitor': return <Monitor size={22} color={color} />;
      case 'laptop': return <Laptop size={22} color={color} />;
      case 'tablet': return <Tablet size={22} color={color} />;
      default: return null;
    }
  };

  const handleSignOut = () => {
    Alert.alert(controlLabels.signOut, controlLabels.signOutConfirm, [
      { text: controlLabels.cancel, style: "cancel" },
      { 
        text: controlLabels.signOut, 
        style: "destructive", 
        onPress: () => {
          navigation.navigate('Login'); 
        } 
      }
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{controlLabels.headerTitle}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        <View style={styles.planCard}>
          <View style={styles.planCardHeader}>
            <Text style={styles.planTitle}>{currentPlan}{controlLabels.memberSuffix}</Text>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>{planDetails.status}</Text>
            </View>
          </View>
          <Text style={styles.planBenefits}>
            {planDetails.benefits}
          </Text>
        </View>

        <View style={styles.card}>
          <View style={styles.quotaHeader}>
            <Text style={styles.quotaLabel}>{controlLabels.deviceSlotsLabel}</Text>
            <Text style={styles.quotaValue}>{devicesUsed} / {devicesTotal}</Text>
          </View>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${progressPercentage}%` }]} />
          </View>
          <Text style={styles.quotaHint}>
            {slotsRemaining} {slotsRemaining === 1 ? controlLabels.slotRemaining : controlLabels.slotsRemaining}
          </Text>
        </View>

        <TouchableOpacity 
          style={[styles.primaryBtn, isTopPlan && styles.disabledBtn]}
          onPress={() => {
            Keyboard.dismiss();
            navigation.navigate('SubscriptionPlansScreen');
          }}
          disabled={isTopPlan}
        >
          <Text style={styles.primaryBtnText}>
            {isTopPlan ? controlLabels.upgradeBtnActive : controlLabels.upgradeBtn}
          </Text>
        </TouchableOpacity>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{controlLabels.managedDevicesTitle}</Text>
          <Text style={styles.sectionSubtitle}>{controlLabels.managedDevicesSubtitle}</Text>
        </View>

        {managedDevices.map(device => (
          <TouchableOpacity key={device.id} style={styles.deviceCard} onPress={() => Alert.alert(device.name)}>
            <View style={styles.deviceIconWrapper}>
              {getDeviceIcon(device.icon)}
            </View>
            <View style={styles.deviceInfo}>
              <Text style={styles.deviceName}>{device.name}</Text>
              <Text style={styles.deviceModel}>{device.model}</Text>
            </View>
            <View style={[styles.statusPill, device.status === 'Active' ? styles.onlinePill : styles.offlinePill]}>
              <Text style={[styles.statusText, device.status === 'Active' ? styles.onlineText : styles.offlineText]}>
                {device.status}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.addBtn} onPress={() => Alert.alert(controlLabels.pairingAlert)}>
          <Plus size={18} color="#64748B" style={{ marginRight: 8 }} />
          <Text style={styles.addBtnText}>{controlLabels.addNewDevice}</Text>
        </TouchableOpacity>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{controlLabels.usageControlsTitle}</Text>
        </View>

        {usageControls.map((control) => (
          <TouchableOpacity 
            key={control.id} 
            style={styles.row} 
            onPress={() => Alert.alert(control.title)}
          >
            <View style={styles.rowIconBox}>
              {control.icon === 'clock' ? <Clock size={20} color="#4F46E5" /> : <Calendar size={20} color="#4F46E5" />}
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>{control.title}</Text>
              <Text style={styles.rowSubtitle}>{control.description}</Text>
            </View>
            <ChevronRight size={20} color="#94A3B8" />
          </TouchableOpacity>
        ))}

        <View style={styles.spacer} />

        {featureToggles.map((toggle) => (
          <View key={toggle.id} style={styles.toggleRow}>
            <View style={styles.rowIconBox}>
              {toggle.key === 'safeBrowsing' ? <Shield size={20} color="#4F46E5" /> : <Zap size={20} color="#4F46E5" />}
            </View>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>{toggle.title}</Text>
              <Text style={styles.rowSubtitle}>{toggle.description}</Text>
            </View>
            <Switch 
              value={toggle.key === 'safeBrowsing' ? safeBrowsing : smartOverride} 
              onValueChange={toggle.key === 'safeBrowsing' ? setSafeBrowsing : setSmartOverride} 
              trackColor={{ false: "#E2E8F0", true: "#4F46E5" }} 
            />
          </View>
        ))}

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{controlLabels.accountTitle}</Text>
        </View>

        <TouchableOpacity style={styles.row} onPress={() => Alert.alert(controlLabels.notificationSettings)}>
          <View style={styles.rowIconBox}>
            <Bell size={20} color="#4F46E5" />
          </View>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>{controlLabels.notificationSettings}</Text>
          </View>
          <ChevronRight size={20} color="#94A3B8" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>{controlLabels.signOut}</Text>
        </TouchableOpacity>

      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('DashboardScreen')}>
          <Home size={22} color="#94A3B8" />
          <Text style={styles.navLabel}>{dashboardLabels.navHome}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('AnalyticsScreen')}>
          <BarChart2 size={22} color="#94A3B8" />
          <Text style={styles.navLabel}>{dashboardLabels.navUsage}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <SettingsIcon size={22} color="#4F46E5" />
          <Text style={[styles.navLabel, styles.activeNav]}>{dashboardLabels.navSettings}</Text>
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
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 12 : 12,
    paddingBottom: 15,
    borderBottomWidth: 1, 
    borderBottomColor: '#E2E8F0', 
    backgroundColor: '#FFF' 
  },
  backButton: { padding: 8 },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700', color: '#0F172A' },
  headerSpacer: { width: 40 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  
  planCard: { backgroundColor: '#4F46E5', borderRadius: 16, padding: 20, marginBottom: 20 },
  planCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  planTitle: { fontSize: 20, fontWeight: '800', color: '#FFF', marginRight: 10 },
  activeBadge: { backgroundColor: '#10B981', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 12 },
  activeBadgeText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },
  planBenefits: { color: '#E0E7FF', fontSize: 13 },

  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20 },
  quotaHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  quotaLabel: { fontWeight: '600', color: '#1E293B' },
  quotaValue: { fontWeight: '700' },
  progressBg: { height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden', marginBottom: 8 },
  progressFill: { height: '100%', backgroundColor: '#F59E0B' },
  quotaHint: { fontSize: 12, color: '#64748B' },

  primaryBtn: { backgroundColor: '#0F172A', padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 24 },
  primaryBtnText: { color: '#FFF', fontWeight: '700' },
  disabledBtn: { backgroundColor: '#94A3B8' },

  sectionHeader: { marginTop: 10, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '700', color: '#0F172A' },
  sectionSubtitle: { fontSize: 14, color: '#64748B' },

  deviceCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 12, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  deviceIconWrapper: { marginRight: 12 },
  deviceInfo: { flex: 1 },
  deviceName: { fontWeight: '600', color: '#1E293B' },
  deviceModel: { fontSize: 12, color: '#64748B' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  onlinePill: { backgroundColor: '#DCFCE7' },
  offlinePill: { backgroundColor: '#F1F5F9' },
  statusText: { fontSize: 11, fontWeight: '700' },
  onlineText: { color: '#15803D' },
  offlineText: { color: '#64748B' },

  addBtn: { flexDirection: 'row', padding: 16, borderStyle: 'dashed', borderWidth: 2, borderColor: '#CBD5E1', borderRadius: 12, alignItems: 'center', marginTop: 4, marginBottom: 24, justifyContent: 'center' },
  addBtnText: { fontWeight: '600', color: '#64748B' },

  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 16, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 16, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  rowIconBox: { marginRight: 12, width: 24, alignItems: 'center' },
  rowContent: { flex: 1 },
  rowTitle: { fontWeight: '600', color: '#1E293B' },
  rowSubtitle: { fontSize: 12, color: '#64748B' },
  spacer: { height: 10 },

  signOutBtn: { marginTop: 20, padding: 16, backgroundColor: '#FEF2F2', borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#FEE2E2' },
  signOutText: { color: '#EF4444', fontWeight: '700' },

  footer: { flexDirection: 'row', padding: 12, borderTopWidth: 1, borderTopColor: '#E2E8F0', backgroundColor: '#FFF', justifyContent: 'space-around', paddingBottom: 24 },
  navItem: { alignItems: 'center' },
  navLabel: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  activeNav: { color: '#4F46E5' }
});
