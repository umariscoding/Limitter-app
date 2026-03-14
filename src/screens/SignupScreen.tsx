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
  Keyboard,
} from 'react-native';
import { BaseButton, TextInput, Icon, Toast } from '../../components';
import { useNavigation } from '@react-navigation/native';

interface SignupScreenProps {
  onSignup?: (email: string, pass: string) => void;
  onNavigateToLogin?: () => void;
}

const SignupScreen: React.FC<SignupScreenProps> = ({
  onSignup,
  onNavigateToLogin,
}) => {
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);

  const handleSignup = () => {
    // Reset error
    setError(null);

    // 4. Validation: Check that Password and Confirm Password match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Prevent submission if empty (basic check)
    if (!email || !password) {
      return;
    }

    // Dismiss keyboard
    Keyboard.dismiss();

    // Show Success Toast
    setShowToast(true);

    // Provide some feedback to the app logic if needed
    if (onSignup) {
      onSignup(email, password);
    }

    // Auto navigate to login after 1.5s
    setTimeout(() => {
      navigation.navigate('Login');
    }, 1500);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Toast 
        visible={showToast} 
        message="Account Created Successfully!" 
        onHide={() => setShowToast(false)} 
        type="success"
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* 1. Screen Layout: App Icon & Title */}
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Icon size={48}>🛡️</Icon>
            </View>
            <Text style={styles.title}>Create Account</Text>
          </View>

          {/* 2. Fields: Email, Password, Confirm Password */}
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
            <TextInput
              label="Password"
              placeholder="Create a password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={true}
            />
            <TextInput
              label="Confirm Password"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry={true}
              error={error || undefined} // 4. Validation: Show error message if passwords don't match
            />

            {/* 3. Button: Create Account */}
            <BaseButton
              variant="primary"
              fullWidth
              onPress={handleSignup}
              style={styles.signupButton}
            >
              Create Account
            </BaseButton>
          </View>

          {/* 4. Navigation: Already have an account? Login */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?{" "}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Login')} activeOpacity={0.6}>
              <Text style={styles.loginText}>Login</Text>
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
    marginBottom: 20,
    alignSelf: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#0F172A',
    textAlign: 'center',
  },
  formContainer: {
    width: '100%',
  },
  signupButton: {
    marginTop: 16,
    marginBottom: 24,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 24,
  },
  footerText: {
    color: '#64748B',
    fontSize: 15,
  },
  loginText: {
    color: '#10B981', // Figma Teal
    fontWeight: '800',
    fontSize: 15,
  },
});

export default SignupScreen;
