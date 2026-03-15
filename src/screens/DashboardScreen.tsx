import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  SafeAreaView,
  Platform,
  StatusBar 
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { 
  Home, 
  BarChart2, 
  Settings as SettingsIcon, 
  Smartphone, 
  Gamepad2, 
  TrendingUp, 
  Film, 
  Laptop, 
  Monitor, 
  Tablet,
  Plus as PlusIcon
} from 'lucide-react-native';
import { userProfile, categories, devices, deviceLimit, dashboardLabels } from '../data/appData';
import { Toast } from '../../components';

export default function DashboardScreen() {
  const navigation = useNavigation<any>();
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    // Show welcome toast when user lands on dashboard
    setShowToast(true);
  }, []);

  const getIcon = (iconName: string, size = 20, color = "#0F172A") => {
    switch(iconName) {
      case 'smartphone': return <Smartphone size={size} color={color} />;
      case 'gamepad-2': return <Gamepad2 size={size} color={color} />;
      case 'trending-up': return <TrendingUp size={size} color={color} />;
      case 'film': return <Film size={size} color={color} />;
      case 'laptop': return <Laptop size={size} color={color} />;
      case 'monitor': return <Monitor size={size} color={color} />;
      case 'tablet': return <Tablet size={size} color={color} />;
      default: return null;
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <Toast 
        visible={showToast} 
        message={dashboardLabels.welcomeMessage} 
        onHide={() => setShowToast(false)} 
        type="success"
      />
      <View style={styles.headerContainer}>
        <Text style={styles.logoText}>{userProfile.appName}</Text>
        <View style={styles.headerRight}>
          <TouchableOpacity 
            activeOpacity={0.7}
            onPress={() => navigation.navigate('SubscriptionPlansScreen')}
          >
            <View style={styles.proBadge}>
              <Text style={styles.proBadgeText}>{userProfile.plan} Plan</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.addButton}
            onPress={() => navigation.navigate('AddContentScreen')}
          >
            <PlusIcon size={20} color="#FFFFFF" strokeWidth={3} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <TouchableOpacity 
          style={styles.overrideTracker}
          onPress={() => navigation.navigate('OverrideLogsScreen')}
        >
          <Text style={styles.overrideText}>
            {dashboardLabels.overridesUsedLabel}<Text style={styles.overrideBold}>{userProfile.overridesUsed} / {userProfile.overridesTotal}</Text>
          </Text>
        </TouchableOpacity>

        <View style={styles.timeCard}>
          <Text style={styles.timeLabel}>{dashboardLabels.totalUsageLabel}</Text>
          <Text style={styles.timeValue}>{userProfile.totalUsageToday}</Text>
        </View>

        <View style={styles.categoriesSection}>
          <Text style={styles.sectionTitle}>{dashboardLabels.categoriesTitle}</Text>
          
          <View style={styles.categoryCard}>
            {categories.map((category, index) => (
              <View 
                key={category.id} 
                style={[
                  styles.categoryRow, 
                  index === categories.length - 1 && styles.lastRow
                ]}
              >
                <View style={[styles.categoryIcon, { backgroundColor: category.color + '20' }]}>
                  {getIcon(category.icon, 20, category.color)}
                </View>
                <View style={styles.categoryInfo}>
                  <Text style={styles.categoryName}>{category.name}</Text>
                </View>
                <Text style={styles.categoryTime}>{category.time}</Text>
              </View>
            ))}
          </View>

          <TouchableOpacity 
            style={styles.viewDetailsBtn}
            onPress={() => navigation.navigate('ActivityScreen')}
          >
            <Text style={styles.viewDetailsText}>{dashboardLabels.viewDetails}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.devicesSection}>
          <View style={styles.sectionHeaderRow}>
            <View style={styles.sectionHeaderLeft}>
              <Text style={styles.sectionTitle}>{dashboardLabels.yourDevicesTitle}</Text>
              <Text style={styles.sectionSubtitle}>{deviceLimit.sharedLimitNote}</Text>
            </View>
            <TouchableOpacity onPress={() => navigation.navigate('ControlPlansScreen')}>
              <Text style={styles.manageAllText}>{dashboardLabels.manageAll}</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.infoBanner}>
            <Text style={styles.infoBannerText}>{deviceLimit.infoText}</Text>
          </View>

          {devices.map((device) => (
            <View key={device.id} style={styles.deviceCard}>
              <View style={styles.deviceHeader}>
                <View style={styles.deviceIconBox}>
                  {getIcon(device.icon, 20, "#64748B")}
                </View>
                <Text style={styles.deviceName}>{device.name}</Text>
                <View style={[
                  styles.statusBadge, 
                  device.status === 'Active' ? styles.statusActive : styles.statusLocked
                ]}>
                  <Text style={device.status === 'Active' ? styles.statusTextActive : styles.statusTextLocked}>
                    {device.status}
                  </Text>
                </View>
              </View>
              <View style={styles.deviceActions}>
                <TouchableOpacity 
                  style={[styles.actionBtn, device.status === 'Locked' && styles.actionBtnDisabled]} 
                  disabled={device.status === 'Locked'}
                  onPress={() => console.log('Lock ' + device.name)}
                >
                  <Text style={[styles.actionBtnText, device.status === 'Locked' && styles.actionBtnTextDisabled]}>{dashboardLabels.lockNow}</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.actionBtn, device.status === 'Active' && styles.actionBtnDisabled]} 
                  disabled={device.status === 'Active'}
                  onPress={() => navigation.navigate('ConfirmOverrideScreen')}
                >
                  <Text style={[styles.actionBtnText, device.status === 'Active' && styles.actionBtnTextDisabled]}>{dashboardLabels.unlock}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem}>
          <Home size={22} color="#4F46E5" />
          <Text style={[styles.navLabel, styles.activeNavText]}>{dashboardLabels.navHome}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => navigation.navigate('AnalyticsScreen')}
        >
          <BarChart2 size={22} color="#94A3B8" />
          <Text style={styles.navLabel}>{dashboardLabels.navUsage}</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.navItem}
          onPress={() => navigation.navigate('SettingsScreen')}
        >
          <SettingsIcon size={22} color="#94A3B8" />
          <Text style={styles.navLabel}>{dashboardLabels.navSettings}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 12 : 10,
    paddingBottom: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  logoText: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  proBadge: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  proBadgeText: {
    color: '#4F46E5',
    fontWeight: '700',
    fontSize: 12,
  },
  addButton: {
    backgroundColor: '#0F172A',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
    lineHeight: 22,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  overrideTracker: {
    backgroundColor: '#FEF2F2',
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  overrideText: {
    color: '#991B1B',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  overrideBold: {
    fontWeight: '800',
  },
  timeCard: {
    backgroundColor: '#4F46E5',
    padding: 24,
    borderRadius: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#4F46E5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  timeLabel: {
    color: '#E0E7FF',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  timeValue: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: '800',
  },
  categoriesSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
  },
  categoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  lastRow: {
    borderBottomWidth: 0,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  iconEmoji: {
    fontSize: 20,
  },
  categoryInfo: {
    flex: 1,
  },
  categoryName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#334155',
  },
  categoryTime: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  viewDetailsBtn: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 12,
  },
  viewDetailsText: {
    color: '#4F46E5',
    fontWeight: '700',
    fontSize: 15,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    justifyContent: 'space-between',
    paddingBottom: 24, // Safe area padding
  },
  navItem: {
    alignItems: 'center',
    flex: 1,
  },
  navIcon: {
    fontSize: 20,
    marginBottom: 4,
    color: '#94A3B8',
  },
  navLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
  },
  activeNavText: {
    color: '#4F46E5',
  },
  devicesSection: {
    marginTop: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  sectionHeaderLeft: {
    flex: 1,
    paddingRight: 10,
  },
  sectionSubtitle: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
    lineHeight: 16,
  },
  manageAllText: {
    color: '#4F46E5',
    fontWeight: '700',
    fontSize: 14,
    marginTop: 2,
  },
  infoBanner: {
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    marginBottom: 16,
  },
  infoBannerText: {
    color: '#1E3A8A',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  deviceCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  deviceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  deviceIconBox: {
    marginRight: 12,
  },
  deviceName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusActive: {
    backgroundColor: '#DCFCE7',
  },
  statusLocked: {
    backgroundColor: '#F1F5F9',
  },
  statusTextActive: {
    color: '#166534',
    fontSize: 12,
    fontWeight: '700',
  },
  statusTextLocked: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: '700',
  },
  deviceActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionBtnDisabled: {
    backgroundColor: '#F1F5F9',
    borderColor: '#F1F5F9',
  },
  actionBtnText: {
    color: '#334155',
    fontSize: 14,
    fontWeight: '600',
  },
  actionBtnTextDisabled: {
    color: '#94A3B8',
  },
});
