import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar, Platform, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '../context/UserContext';

import { dashboardLabels } from '../data/appData';
import { Home, BarChart2, Settings as SettingsIcon } from 'lucide-react-native';

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { logout } = useUser();

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: () => {
          logout();
          navigation.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          });
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.content}>
        <Text style={styles.title}>Settings Screen (Placeholder)</Text>
        <TouchableOpacity style={styles.btn} onPress={() => navigation.navigate('DashboardScreen')}>
          <Text style={styles.btnText}>Go to Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutBtnText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('DashboardScreen')}>
          <Home size={22} color="#94A3B8" />
          <Text style={styles.navLabel}>{dashboardLabels.navHome}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('AnalyticsScreen')}>
          <BarChart2 size={22} color="#94A3B8" />
          <Text style={styles.navLabel}>{dashboardLabels.navUsage}</Text>
        </TouchableOpacity>
        <View style={styles.navItem}>
          <SettingsIcon size={22} color="#6366F1" />
          <Text style={[styles.navLabel, styles.activeNavText]}>{dashboardLabels.navSettings}</Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 20, fontWeight: '700', marginBottom: 20, color: '#1E293B' },
  btn: { padding: 12, backgroundColor: '#4F46E5', borderRadius: 8 },
  btnText: { color: '#FFF', fontWeight: 'bold' },
  signOutBtn: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#FEE2E2',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  signOutBtnText: {
    color: '#B91C1C',
    fontWeight: '700',
  },
  bottomNav: { flexDirection: 'row', backgroundColor: '#FFFFFF', paddingVertical: 12, paddingHorizontal: 24, borderTopWidth: 1, borderTopColor: '#E2E8F0', justifyContent: 'space-between', paddingBottom: Platform.OS === 'ios' ? 24 : 12 },
  navItem: { alignItems: 'center', flex: 1 },
  navIcon: { fontSize: 20, marginBottom: 4, color: '#94A3B8' },
  navLabel: { fontSize: 12, fontWeight: '600', color: '#94A3B8' },
  activeNavText: { color: '#6366F1' },
});
