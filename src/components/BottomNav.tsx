import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Home, Shield, BarChart2, Settings as SettingsIcon } from 'lucide-react-native';
import { FileText } from 'lucide-react-native';
type ActiveTab = 'home' | 'limits' | 'analytics' | 'settings' | 'overrides';

interface BottomNavProps {
  active: ActiveTab;
}

const TABS: Array<{ key: ActiveTab; label: string; screen: string }> = [
  { key: 'home', label: 'Home', screen: 'DashboardScreen' },
  { key: 'limits', label: 'Limits', screen: 'PoliciesScreen' },
  { key: 'analytics', label: 'Analytics', screen: 'AnalyticsScreen' },
  { key: 'settings', label: 'Settings', screen: 'SettingsScreen' },
  { key: 'overrides', label: 'Overrides', screen: 'OverrideLogsScreen' },
];

const TAB_ICONS: Record<ActiveTab, (color: string) => React.ReactNode> = {
  home: (color) => <Home size={22} color={color} />,
  limits: (color) => <Shield size={22} color={color} />,
  analytics: (color) => <BarChart2 size={22} color={color} />,
  settings: (color) => <SettingsIcon size={22} color={color} />,
  overrides: (color) => <FileText size={22} color={color} />,
};

const ACTIVE_COLOR = '#000000';
const INACTIVE_COLOR = '#000000';

export default function BottomNav({ active }: BottomNavProps) {
  const navigation = useNavigation<any>();

  return (
    <View style={styles.container}>
      {TABS.map(tab => {
        const isActive = tab.key === active;
        const color = isActive ? ACTIVE_COLOR : INACTIVE_COLOR;

        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.item}
            onPress={isActive ? undefined : () => navigation.navigate(tab.screen)}
            activeOpacity={isActive ? 1 : 0.7}
          >
            <View style={[styles.iconWrap, isActive && styles.iconWrapActive]}>
              {TAB_ICONS[tab.key](color)}
            </View>
            <Text style={[styles.label, { color }]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingTop: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    justifyContent: 'space-around',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 8,
  },
  item: { alignItems: 'center', justifyContent: 'center', paddingVertical: 4 },
  iconWrap: {
    width: 40,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: '#EEF2FF',
  },
  label: { fontSize: 11, fontWeight: '600', marginTop: 2 },
});
