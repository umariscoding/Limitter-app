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

// Standard React Native app, likely no NativeWind setup shown in package.json
// Using StyleSheet for maximum compatibility

import { 
  planDetails, 
  devices as appDevices, 
  usageControls, 
  featureToggles 
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

  const handleSignOut = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Sign Out", 
        style: "destructive", 
        onPress: () => {
          // Clear any auth logic here
          navigation.navigate('Login'); // Based on AuthNavigator.tsx screen name
        } 
      }
    ]);
  };


  return (
    <SafeAreaView style={styles.container}>
      {/* 1. Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Control & Plans</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* 2. Plan Card */}
        <View style={styles.planCard}>
          <View style={styles.planCardHeader}>
            <Text style={styles.planTitle}>{currentPlan} Member</Text>
            <View style={styles.activeBadge}>
              <Text style={styles.activeBadgeText}>{planDetails.status}</Text>
            </View>
          </View>
          <Text style={styles.planBenefits}>
            {planDetails.benefits}
          </Text>
        </View>

        {/* 3. Device Progress */}
        <View style={styles.card}>
          <View style={styles.quotaHeader}>
            <Text style={styles.quotaLabel}>Device Slots Used</Text>
            <Text style={styles.quotaValue}>{devicesUsed} / {devicesTotal}</Text>
          </View>
          <View style={styles.progressBg}>
            <View style={[styles.progressFill, { width: `${progressPercentage}%` }]} />
          </View>
          <Text style={styles.quotaHint}>{slotsRemaining} slot{slotsRemaining !== 1 ? 's' : ''} remaining</Text>
        </View>

        {/* 4. Action Buttons */}
        <TouchableOpacity 
          style={[styles.primaryBtn, isTopPlan && styles.disabledBtn]}
          onPress={() => {
            Keyboard.dismiss();
            navigation.navigate('SubscriptionPlansScreen');
          }}
          disabled={isTopPlan}
        >
          <Text style={styles.primaryBtnText}>
            {isTopPlan ? "Top Plan Active ✓" : "Upgrade to Elite"}
          </Text>
        </TouchableOpacity>

        {/* 5. Managed Devices */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Managed Devices</Text>
          <Text style={styles.sectionSubtitle}>Tap a device to manage it</Text>
        </View>

        {managedDevices.map(device => (
          <TouchableOpacity key={device.id} style={styles.deviceCard} onPress={() => Alert.alert(device.name)}>
            <Text style={styles.deviceIcon}>{device.icon}</Text>
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

        <TouchableOpacity style={styles.addBtn} onPress={() => Alert.alert("Pairing...")}>
          <Text style={styles.addBtnText}>+ Add New Device</Text>
        </TouchableOpacity>

        {/* 6. Usage Controls */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Usage Controls</Text>
        </View>

        {usageControls.map((control) => (
          <TouchableOpacity 
            key={control.id} 
            style={styles.row} 
            onPress={() => Alert.alert(control.title)}
          >
            <Text style={styles.rowIcon}>{control.icon === 'clock' ? '⏰' : '📅'}</Text>
            <View style={styles.rowContent}>
              <Text style={styles.rowTitle}>{control.title}</Text>
              <Text style={styles.rowSubtitle}>{control.description}</Text>
            </View>
            <Text style={styles.chevron}>→</Text>
          </TouchableOpacity>
        ))}

        <View style={styles.spacer} />

        {featureToggles.map((toggle) => (
          <View key={toggle.id} style={styles.toggleRow}>
            <Text style={styles.rowIcon}>{toggle.key === 'safeBrowsing' ? '🛡️' : '⚡'}</Text>
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

        {/* 7. Account */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Account</Text>
        </View>

        <TouchableOpacity style={styles.row} onPress={() => Alert.alert("Notifications")}>
          <Text style={styles.rowIcon}>🔔</Text>
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Notification Settings</Text>
          </View>
          <Text style={styles.chevron}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* Footer Nav */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('DashboardScreen')}>
          <Text style={styles.navEmoji}>🏠</Text>
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('UsageScreen')}>
          <Text style={styles.navEmoji}>📊</Text>
          <Text style={styles.navLabel}>Usage</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem}>
          <Text style={[styles.navEmoji, styles.activeNav]}>⚙️</Text>
          <Text style={[styles.navLabel, styles.activeNav]}>Settings</Text>
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
  backText: { fontSize: 24, fontWeight: 'bold' },
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
  deviceIcon: { fontSize: 24, marginRight: 12 },
  deviceInfo: { flex: 1 },
  deviceName: { fontWeight: '600', color: '#1E293B' },
  deviceModel: { fontSize: 12, color: '#64748B' },
  statusPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  onlinePill: { backgroundColor: '#DCFCE7' },
  offlinePill: { backgroundColor: '#F1F5F9' },
  statusText: { fontSize: 11, fontWeight: '700' },
  onlineText: { color: '#15803D' },
  offlineText: { color: '#64748B' },

  addBtn: { padding: 16, borderStyle: 'dashed', borderWidth: 2, borderColor: '#CBD5E1', borderRadius: 12, alignItems: 'center', marginTop: 4, marginBottom: 24 },
  addBtnText: { fontWeight: '600', color: '#64748B' },

  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 16, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF', padding: 16, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
  rowIcon: { fontSize: 20, marginRight: 12 },
  rowContent: { flex: 1 },
  rowTitle: { fontWeight: '600', color: '#1E293B' },
  rowSubtitle: { fontSize: 12, color: '#64748B' },
  chevron: { color: '#94A3B8', fontSize: 18 },
  spacer: { height: 10 },

  signOutBtn: { marginTop: 20, padding: 16, backgroundColor: '#FEF2F2', borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#FEE2E2' },
  signOutText: { color: '#EF4444', fontWeight: '700' },

  footer: { flexDirection: 'row', padding: 12, borderTopWidth: 1, borderTopColor: '#E2E8F0', backgroundColor: '#FFF', justifyContent: 'space-around', paddingBottom: 24 },
  navItem: { alignItems: 'center' },
  navEmoji: { fontSize: 20, color: '#94A3B8' },
  navLabel: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  activeNav: { color: '#4F46E5' }
});
