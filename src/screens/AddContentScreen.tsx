import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { managedContent, addContentLabels } from '../data/appData';
import {
  Smartphone,
  Gamepad2,
  Film,
  TrendingUp,
  ArrowLeft
} from 'lucide-react-native';
import SideDrawer from '../components/SideDrawer';
import HamburgerButton from '../components/HamburgerButton';

type ContentItem = {
  id: string;
  name: string;
  category: string;
  icon: string;
  status: string;
};

export default function AddContentScreen() {
  const navigation = useNavigation<any>();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [contentList, setContentList] = useState<ContentItem[]>(managedContent);

  const getIcon = (iconName: string, size = 22, color = "#0F172A") => {
    switch(iconName) {
      case 'smartphone': return <Smartphone size={size} color={color} />;
      case 'gamepad-2': return <Gamepad2 size={size} color={color} />;
      case 'film': return <Film size={size} color={color} />;
      case 'trending-up': return <TrendingUp size={size} color={color} />;
      default: return null;
    }
  };

  const toggleStatus = (id: string) => {
    setContentList((prev) => 
      prev.map((item) => 
        item.id === id 
          ? { ...item, status: item.status === 'Active' ? 'Inactive' : 'Active' } 
          : item
      )
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <ArrowLeft size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{addContentLabels.headerTitle}</Text>
        <HamburgerButton onPress={() => setDrawerOpen(true)} />
      </View>

      {/* Content */}
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {contentList.map((item) => (
          <View key={item.id} style={styles.contentCard}>
            <View style={styles.iconContainer}>
              {getIcon(item.icon, 22, "#4F46E5")}
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

        <TouchableOpacity style={[styles.addButton, styles.addButtonDisabled]} disabled activeOpacity={0.6}>
          <Text style={styles.addButtonText}>{addContentLabels.addNew} (Coming Soon)</Text>
        </TouchableOpacity>
        <View style={{ height: 20 }} />
      </ScrollView>
      <SideDrawer visible={drawerOpen} active="home" onClose={() => setDrawerOpen(false)} />
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
  addButtonDisabled: {
    opacity: 0.5,
    backgroundColor: '#94A3B8',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});
