import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { BaseButton, TextInput, Toast } from '../../components';
import { Shield } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

interface ForgotPasswordScreenProps {
  onSendEmail?: (email: string) => void;
  onNavigateBack?: () => void;
}

const ForgotPasswordScreen: React.FC<ForgotPasswordScreenProps> = ({
  onSendEmail,
  onNavigateBack,
}) => {
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error'>('success');

  const handleSendEmail = () => {
    if (!email) {
      setToastMessage('Please enter your email address');
      setToastType('error');
      setShowToast(true);
      return;
    }

    setToastType('success');
    setToastMessage('Verification email sent!');
    setShowToast(true);
    
    if (onSendEmail) {
      onSendEmail(email);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Toast 
        visible={showToast} 
        message={toastMessage} 
        onHide={() => setShowToast(false)} 
        type={toastType}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Shield size={48} color="#4F46E5" />
            </View>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              Enter your email address and we'll send you a link to reset your password.
            </Text>
          </View>

          {/* Form */}
          <View style={styles.formContainer}>
            <TextInput
              label="Email Address"
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />

            <BaseButton
              variant="primary"
              fullWidth
              onPress={handleSendEmail}
              style={styles.actionButton}
            >
              Send Verification Email
            </BaseButton>
          </View>

          {/* Navigation Back */}
          <View style={styles.footer}>
            <TouchableOpacity onPress={() => navigation.navigate('Login')} activeOpacity={0.6}>
              <Text style={styles.backText}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  flex: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingBottom: 40,
  },
  header: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 48,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    alignSelf: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  formContainer: {
    width: '100%',
  },
  actionButton: {
    marginTop: 16,
    marginBottom: 24,
  },
  footer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 24,
  },
  backText: {
    color: '#10B981',
    fontWeight: '800',
    fontSize: 15,
  },
});

export default ForgotPasswordScreen;
