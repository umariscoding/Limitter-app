import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Home, Shield, BarChart2, Settings as SettingsIcon } from 'lucide-react-native';

type ActiveTab = 'home' | 'limits' | 'analytics' | 'settings';

interface BottomNavProps {
  active: ActiveTab;
}

const TABS: Array<{ key: ActiveTab; label: string; screen: string }> = [
  { key: 'home', label: 'Home', screen: 'DashboardScreen' },
  { key: 'limits', label: 'Limits', screen: 'PoliciesScreen' },
  { key: 'analytics', label: 'Analytics', screen: 'AnalyticsScreen' },
  { key: 'settings', label: 'Settings', screen: 'SettingsScreen' },
];

const TAB_ICONS: Record<ActiveTab, (color: string) => React.ReactNode> = {
  home: (color) => <Home size={22} color={color} />,
  limits: (color) => <Shield size={22} color={color} />,
  analytics: (color) => <BarChart2 size={22} color={color} />,
  settings: (color) => <SettingsIcon size={22} color={color} />,
};

const ACTIVE_COLOR = '#4F46E5';
const INACTIVE_COLOR = '#94A3B8';

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
            {TAB_ICONS[tab.key](color)}
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
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    justifyContent: 'space-around',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  },
  item: { alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 11, fontWeight: '600', marginTop: 4 },
});
