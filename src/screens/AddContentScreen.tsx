import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, SafeAreaView, Alert, Platform, StatusBar } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { managedContent } from '../data/appData';

type ContentItem = {
  id: string;
  name: string;
  category: string;
  icon: string;
  status: string;
};

export default function AddContentScreen() {
  const navigation = useNavigation<any>();

  const [contentList, setContentList] = useState<ContentItem[]>(managedContent);

  const toggleStatus = (id: string) => {
    setContentList((prev) => 
      prev.map((item) => 
        item.id === id 
          ? { ...item, status: item.status === 'Active' ? 'Inactive' : 'Active' } 
          : item
      )
    );
  };

  const handleAddNew = () => {
    Alert.alert('Coming Soon', 'This feature is under development.');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Managed Content</Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Content */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {contentList.map((item) => (
          <View key={item.id} style={styles.contentCard}>
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>{item.icon}</Text>
            </View>
            <View style={styles.infoContainer}>
              <Text style={styles.name}>{item.name}</Text>
              <Text style={styles.category}>{item.category}</Text>
            </View>
            <TouchableOpacity 
              style={[styles.toggleBtn, item.status === 'Active' ? styles.toggleActive : styles.toggleInactive]}
              onPress={() => toggleStatus(item.id)}
            >
              <Text style={[styles.toggleText, item.status === 'Active' ? styles.toggleTextActive : styles.toggleTextInactive]}>
                {item.status}
              </Text>
            </TouchableOpacity>
          </View>
        ))}

        <TouchableOpacity style={styles.addButton} onPress={handleAddNew}>
          <Text style={styles.addButtonText}>+ Add New App / Website</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Bottom Nav */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('DashboardScreen')}>
          <Text style={styles.navIcon}>🏠</Text>
          <Text style={styles.navLabel}>Home</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('UsageScreen')}>
          <Text style={styles.navIcon}>📊</Text>
          <Text style={styles.navLabel}>Usage</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.navItem} onPress={() => navigation.navigate('SettingsScreen')}>
          <Text style={styles.navIcon}>⚙️</Text>
          <Text style={styles.navLabel}>Settings</Text>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight || 0) + 12 : 12,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    padding: 8,
    marginRight: 10,
  },
  backButtonText: {
    fontSize: 24,
    color: '#0F172A',
    fontWeight: '600',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  scrollContent: {
    padding: 20,
  },
  contentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#94A3B8',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 22,
  },
  infoContainer: {
    flex: 1,
  },
  name: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  category: {
    fontSize: 13,
    color: '#64748B',
  },
  toggleBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  toggleActive: {
    backgroundColor: '#DCFCE7',
    borderColor: '#BBF7D0',
  },
  toggleInactive: {
    backgroundColor: '#F1F5F9',
    borderColor: '#E2E8F0',
  },
  toggleText: {
    fontSize: 13,
    fontWeight: '700',
  },
  toggleTextActive: {
    color: '#166534',
  },
  toggleTextInactive: {
    color: '#64748B',
  },
  addButton: {
    backgroundColor: '#4F46E5',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    marginBottom: 20,
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    justifyContent: 'space-between',
    paddingBottom: 24,
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
});
