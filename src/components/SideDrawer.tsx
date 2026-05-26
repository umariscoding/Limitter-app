import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import {
  Home,
  Shield,
  BarChart2,
  Settings as SettingsIcon,
  FileText,
  X,
} from 'lucide-react-native';

type ActiveTab = 'home' | 'limits' | 'analytics' | 'settings' | 'overrides';

interface SideDrawerProps {
  visible: boolean;
  active: ActiveTab;
  onClose: () => void;
}

const DRAWER_WIDTH = Dimensions.get('window').width * 0.75;

const TABS: Array<{ key: ActiveTab; label: string; screen: string }> = [
  { key: 'home', label: 'Home', screen: 'DashboardScreen' },
  { key: 'limits', label: 'Limits', screen: 'PoliciesScreen' },
  { key: 'analytics', label: 'Analytics', screen: 'AnalyticsScreen' },
  { key: 'settings', label: 'Settings', screen: 'SettingsScreen' },
  { key: 'overrides', label: 'Overrides', screen: 'OverrideLogsScreen' },
];

const TAB_ICONS: Record<ActiveTab, (color: string, size: number) => React.ReactNode> = {
  home: (color, size) => <Home size={size} color={color} />,
  limits: (color, size) => <Shield size={size} color={color} />,
  analytics: (color, size) => <BarChart2 size={size} color={color} />,
  settings: (color, size) => <SettingsIcon size={size} color={color} />,
  overrides: (color, size) => <FileText size={size} color={color} />,
};

export default function SideDrawer({ visible, active, onClose }: SideDrawerProps) {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const slideAnim = useRef(new Animated.Value(-DRAWER_WIDTH)).current;
  const overlayAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -DRAWER_WIDTH,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(overlayAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  if (!visible) return null;

  const handleNav = (screen: string) => {
    onClose();
    setTimeout(() => navigation.navigate(screen), 150);
  };

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <TouchableWithoutFeedback onPress={onClose}>
        <Animated.View style={[styles.overlay, { opacity: overlayAnim }]} />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[
          styles.drawer,
          {
            width: DRAWER_WIDTH,
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 12,
            transform: [{ translateX: slideAnim }],
          },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.brandText}>Limitter</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <X size={22} color="#64748B" />
          </TouchableOpacity>
        </View>

        <View style={styles.navList}>
          {TABS.map(tab => {
            const isActive = tab.key === active;
            return (
              <TouchableOpacity
                key={tab.key}
                style={[styles.navItem, isActive && styles.navItemActive]}
                onPress={() => (isActive ? onClose() : handleNav(tab.screen))}
                activeOpacity={0.7}
              >
                {TAB_ICONS[tab.key](isActive ? '#059669' : '#334155', 22)}
                <Text style={[styles.navLabel, isActive && styles.navLabelActive]}>
                  {tab.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 2, height: 0 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
      },
      android: {
        elevation: 16,
      },
    }),
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  brandText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#059669',
  },
  navList: {
    gap: 4,
  },
  navItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  navItemActive: {
    backgroundColor: '#F0FDF4',
  },
  navLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#334155',
  },
  navLabelActive: {
    color: '#059669',
    fontWeight: '600',
  },
});
