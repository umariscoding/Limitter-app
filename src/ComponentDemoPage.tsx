import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert as RNAlert, SafeAreaView, TouchableOpacity } from 'react-native';
import {
  BaseButton,
  TextInput,
  BaseModal,
  RadioGroup,
  Alert,
  Icon
} from '../components';

const ComponentDemoPage: React.FC = () => {
  const [textValue, setTextValue] = useState('');
  const [usernameValue, setUsernameValue] = useState('');
  const [passwordValue, setPasswordValue] = useState('');
  const [radioValue, setRadioValue] = useState('option1');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const radioOptions = [
    { label: 'Visa ending in 4242', value: 'option1', description: 'Expires 12/26' },
    { label: 'Mastercard ending in 1234', value: 'option2', description: 'Expires 08/25' },
    { label: 'Add New Card', value: 'option3', disabled: true },
  ];

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
        <Text style={{ fontSize: 24, fontWeight: 'bold', marginBottom: 20 }}>UI Library Test</Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Buttons</Text>
          <View style={styles.row}>
            <BaseButton variant="primary" style={styles.flex1}>Primary</BaseButton>
            <BaseButton variant="secondary" style={styles.flex1}>Secondary</BaseButton>
          </View>
          <BaseButton variant="outline" fullWidth style={{ marginTop: 10 }}>Outline Full Width</BaseButton>
          <BaseButton variant="danger" fullWidth style={{ marginTop: 10 }}>Danger Button</BaseButton>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inputs</Text>
          <TextInput
            label="Name"
            placeholder="Enter name"
            value={textValue}
            onChangeText={setTextValue}
          />
          <TextInput
            label="Username"
            placeholder="Enter username"
            value={usernameValue}
            onChangeText={setUsernameValue}
          />
          <TextInput
            label="Password"
            placeholder="Enter password"
            value={passwordValue}
            onChangeText={setPasswordValue}
            secureTextEntry={true}
          />
          
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Radio Group</Text>
          <RadioGroup
            options={radioOptions}
            value={radioValue}
            onChange={setRadioValue}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Alerts</Text>
          <Alert variant="info" title="Info">This is an info alert.</Alert>
          <Alert variant="warning" title="Warning" style={{ marginTop: 10 }}>This is a warning alert.</Alert>
          <Alert variant="success" title="Success" style={{ marginTop: 10 }}>This is a success alert.</Alert>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Icons</Text>
          <View style={styles.row}>
            <Icon size="lg">🔒</Icon>
            <Icon size="lg">🧠</Icon>
            <Icon size="lg" style={{ color: 'blue' }}></Icon>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Modal</Text>
          <BaseButton variant="outline" onPress={() => setIsModalOpen(true)}>Open Test Modal</BaseButton>
          <BaseModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            title="Test Modal"
          >
            <Text>Modal content is working!</Text>
            <BaseButton variant="primary" onPress={() => setIsModalOpen(false)} style={{ marginTop: 20 }}>Close</BaseButton>
          </BaseModal>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  section: {
    marginBottom: 30,
    backgroundColor: '#F9FAFB',
    padding: 15,
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    marginBottom: 15,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  flex1: {
    flex: 1,
  }
});

export default ComponentDemoPage;
