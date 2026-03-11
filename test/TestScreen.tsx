import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert as RNAlert } from 'react-native';
import {
  BaseButton,
  TextInput,
  PasswordInput,
  BaseModal,
  RadioGroup,
  Alert
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
    { label: 'Option 1', value: 'option1' },
    { label: 'Option 2', value: 'option2' },
    { label: 'Option 3', value: 'option3' },
  ];

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.pageTitle}>UI Components Test</Text>
      
      <View style={styles.card}>
        
        {/* TextInput Test */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>TEXT INPUT</Text>
          <TextInput
            label="Test Input"
            placeholder="Type here..."
            value={textValue}
            onChangeText={setTextValue}
          />
        </View>

        {/* PasswordInput Test */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>PASSWORD INPUT</Text>
          <PasswordInput
            label="Test Password"
            value={passwordValue}
            onChangeText={setPasswordValue}
          />
        </View>

        {/* RadioGroup Test */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>RADIO GROUP</Text>
          <RadioGroup
            options={radioOptions}
            value={radioValue}
            onChange={(value) => setRadioValue(value)}
          />
        </View>

        {/* Alert Test */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ALERT</Text>
          <Alert
            variant="warning"
            title="Test Alert"
          >
            This is a warning message.
          </Alert>
        </View>

        {/* BaseButton Test */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>BUTTON</Text>
          <BaseButton
            variant="primary"
            size="md"
            fullWidth
            onPress={() => RNAlert.alert("Button clicked!")}
          >
            Click Me
          </BaseButton>
        </View>

        {/* BaseModal Test */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>MODAL</Text>
          <BaseButton
            variant="outline"
            onPress={() => setIsModalOpen(true)}
          >
            Open Modal
          </BaseButton>
          
          <BaseModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            title="Sample Modal"
          >
            <View style={{ paddingVertical: 10 }}>
              <Text style={{ color: '#4b5563', marginBottom: 10 }}>This is some sample text inside the BaseModal.</Text>
              <Text style={{ color: '#9ca3af', fontStyle: 'italic', fontSize: 12 }}>You can close this modal using the cross or dim backdrop.</Text>
            </View>
            <View style={{ marginTop: 24, alignItems: 'flex-end' }}>
              <BaseButton 
                variant="primary" 
                onPress={() => setIsModalOpen(false)} 
              >
                Close Modal
              </BaseButton>
            </View>
          </BaseModal>
        </View>

      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    padding: 24,
    paddingBottom: 60,
  },
  pageTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 24,
  },
  card: {
    backgroundColor: '#ffffff',
    padding: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    elevation: 2,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9ca3af',
    marginBottom: 12,
  },
});

export default TestScreen;
