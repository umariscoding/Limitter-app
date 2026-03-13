import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert as RNAlert, SafeAreaView } from 'react-native';
import {
  BaseButton,
  TextInput,
  BaseModal,
  RadioGroup,
  Alert,
  Icon
} from '../components';

const TestScreen: React.FC = () => {
  // State for Inputs
  const [textValue, setTextValue] = useState('');
  const [passwordValue, setPasswordValue] = useState('');
  const [radioValue, setRadioValue] = useState('option1');
  
  // State for Modal
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Radio Options
  const radioOptions = [
    { label: 'Visa ending in 4242', value: 'option1', description: 'Expires 12/26' },
    { label: 'Mastercard ending in 1234', value: 'option2', description: 'Expires 08/25' },
    { label: 'Add New Card', value: 'option3', disabled: true },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.pageTitle}>Component Library</Text>
          <Text style={styles.pageSubtitle}>Testing UI Elements for AppGuard2</Text>
        </View>

        {/* Buttons Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>BUTTONS</Text>
          <View style={styles.componentCard}>
            <View style={styles.row}>
              <BaseButton variant="primary" style={styles.flex1} onPress={() => RNAlert.alert("Primary Action")}>
                Primary
              </BaseButton>
              <BaseButton variant="secondary" style={styles.flex1}>
                Secondary
              </BaseButton>
            </View>
            <View style={styles.row}>
              <BaseButton variant="outline" style={styles.flex1}>
                Outline
              </BaseButton>
              <BaseButton variant="danger" style={styles.flex1}>
                Danger
              </BaseButton>
            </View>
            <BaseButton variant="ghost" fullWidth>
              Ghost Variant (Text only)
            </BaseButton>
            <BaseButton variant="primary" isLoading fullWidth>
              Loading State
            </BaseButton>
          </View>
        </View>

        {/* Inputs Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>INPUTS</Text>
          <View style={styles.componentCard}>
            <TextInput
              label="Standard Input"
              placeholder="e.g. John Doe"
              value={textValue}
              onChangeText={setTextValue}
            />
            <TextInput
              label="Input with Error"
              value="Invalid email"
              error="Please enter a valid email address"
            />
            <TextInput
              label="Password Field"
              placeholder="Enter your password"
              value={passwordValue}
              onChangeText={setPasswordValue}
              secureTextEntry={true}
            />
          </View>
        </View>

        {/* Radio Group Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>RADIO SELECTORS</Text>
          <View style={styles.componentCard}>
            <RadioGroup
              options={radioOptions}
              value={radioValue}
              onChange={(value) => setRadioValue(value)}
            />
          </View>
        </View>

        {/* Alerts Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>ALERTS & FEEDBACK</Text>
          <View style={styles.componentCard}>
            <Alert variant="info" title="Information" style={styles.mb12}>
              This is a standard informational message for the user.
            </Alert>
            <Alert variant="warning" title="Security Warning" style={styles.mb12}>
              Your device has 30 mins of homework time left.
            </Alert>
            <Alert variant="success" title="Success">
              Payment confirmed successfully!
            </Alert>
          </View>
        </View>

        {/* Icons Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>ICONS</Text>
          <View style={[styles.componentCard, styles.row, { justifyContent: 'space-around' }]}>
            <Icon size="sm">🔒</Icon>
            <Icon size="md">⚡</Icon>
            <Icon size="lg">🧠</Icon>
            <Icon size={32} style={{ color: '#2563eb' }}></Icon>
            <Icon size={32} style={{ color: '#ea4335' }}>G</Icon>
          </View>
        </View>

        {/* Modal Section */}
        <View style={styles.section}>
          <Text style={styles.sectionHeader}>MODALS</Text>
          <View style={styles.componentCard}>
            <BaseButton
              variant="outline"
              fullWidth
              onPress={() => setIsModalOpen(true)}
            >
              Preview Modal
            </BaseButton>
            
            <BaseModal
              isOpen={isModalOpen}
              onClose={() => setIsModalOpen(false)}
              title="Override Configuration"
              subtitle="Configure how long you want to unlock the device."
              headerLabel="System Settings"
            >
              <View style={{ gap: 16 }}>
                <Text style={styles.modalText}>
                  This is a preview of the BaseModal component. It supports titles, subtitles, and custom header labels.
                </Text>
                <TextInput label="Quick Adjust (mins)" placeholder="30" />
                <View style={styles.row}>
                  <BaseButton variant="outline" style={styles.flex1} onPress={() => setIsModalOpen(false)}>
                    Cancel
                  </BaseButton>
                  <BaseButton variant="primary" style={styles.flex1} onPress={() => setIsModalOpen(false)}>
                    Save
                  </BaseButton>
                </View>
              </View>
            </BaseModal>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>AppGuard2 • v2.0.0</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 60,
  },
  header: {
    marginBottom: 32,
    marginTop: 10,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#0f172a',
    letterSpacing: -0.5,
  },
  pageSubtitle: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 4,
  },
  section: {
    marginBottom: 28,
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    letterSpacing: 1.5,
    marginBottom: 12,
    paddingLeft: 4,
  },
  componentCard: {
    backgroundColor: '#ffffff',
    padding: 18,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  flex1: {
    flex: 1,
  },
  mb12: {
    marginBottom: 12,
  },
  modalText: {
    fontSize: 14,
    color: '#475569',
    lineHeight: 20,
  },
  footer: {
    marginTop: 20,
    alignItems: 'center',
    opacity: 0.5,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
});

export default TestScreen;
