import React, { useState } from 'react';
import { loginAPI } from '../api/api.js';
import {
  View,
  Text,
  Alert,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useUser } from '../context/UserContext';
import { BaseButton, TextInput, Toast } from '../../components';
import { Shield } from 'lucide-react-native';

interface LoginScreenProps {
  onLogin?: (email: string, pass: string) => void;
  onNavigateToSignUp?: () => void;
  onForgotPassword?: () => void;
}

const LoginScreen: React.FC<LoginScreenProps> = ({
  onLogin,
  onNavigateToSignUp,
  onForgotPassword,
}) => {
  const navigation = useNavigation<any>();
  const { login: loginUser } = useUser();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setError(null);

    if (!email || !password) {
      setError('Email and password are required');
      return;
    }
    
    Keyboard.dismiss();
    setIsLoading(true);

    try {
      const response = await loginAPI(email.trim(), password);
      console.log('✅ Login API response:', response);

      if (!response) {
        setError('❌ No response from backend - server may be down');
        console.error('No response received');
        return;
      }

      const isSuccess = response?.success === true || response?.data;

      if (!isSuccess) {
        setError(response?.message || 'Login failed - check credentials');
        console.warn('Login failed:', response?.message);
        return;
      }

      // ✅ Save user data to context
      const userData = response.data || response;
      loginUser({
        uid: userData.uid,
        email: userData.email,
        name: userData.name || 'User',
        plan: userData.plan || 'free',
        overrides_left: userData.overrides_left || 3,
        idToken: userData.idToken,
      });

      setShowToast(true);

      if (onLogin) {
        onLogin(email, password);
      }

      setTimeout(() => {
        navigation.reset({
          index: 0,
          routes: [{ name: 'DashboardScreen' }],
        });
      }, 700);
    } catch (apiError: any) {
      console.error('❌ Login catch error:', apiError);
      console.error('❌ Error type:', apiError?.constructor?.name);
      console.error('❌ Error message:', apiError?.message);
      
      const errorMsg = apiError?.message || 'Login request failed';
      
      let displayError = errorMsg;
      
      if (errorMsg.includes('JSON')) {
        displayError = '⚠️ Backend Error: Backend is not returning valid JSON.\n\nCheck:\n1. Is backend running?\n2. Is ngrok tunnel active?\n3. Are there backend errors?';
      } else if (errorMsg.includes('Network')) {
        displayError = '🌐 Network Error:\n\nCheck:\n1. Is backend running? (node index.js)\n2. Is ngrok active? (ngrok http 3000)\n3. Is ngrok URL correct in config.ts?';
      } else if (errorMsg.includes('timeout')) {
        displayError = '⏱️ Timeout: Backend not responding\n\nStart backend:\nnode index.js';
      } else if (errorMsg.includes('HTTP 5')) {
        displayError = '💥 Server Error 5xx\n\nBackend crashed. Check backend logs';
      } else if (errorMsg.includes('HTTP 401') || errorMsg.includes('unauthorized')) {
        displayError = '🔐 Wrong credentials\n\nCheck email and password';
      } else if (errorMsg.includes('HTTP 404')) {
        displayError = '❌ Backend not found (404)\n\nCheck:\n1. Backend running?\n2. ngrok URL correct?';
      }
      
      setError(displayError);
      console.error('Final error shown to user:', displayError);
      
      Alert.alert('❌ Login Failed', displayError);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Toast
        visible={showToast}
        message="Login API success"
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
              <Shield size={48} color="#4F46E5" />
            </View>
            <Text style={styles.title}>Login</Text>
          </View>

          {/* 2. Input Fields: Email & Password */}
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
              placeholder="Enter your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={true}
              error={error || undefined}
            />

            {/* 3. Actions: Forgot Password & Login Button */}
            <TouchableOpacity 
              style={styles.forgotPasswordContainer}
              onPress={() => navigation.navigate('ForgotPassword')}
              activeOpacity={0.6}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            <BaseButton
              variant="primary"
              fullWidth
              onPress={handleLogin}
              disabled={isLoading}
              style={styles.loginButton}
            >
              {isLoading ? 'Testing API...' : 'Login'}
            </BaseButton>
          </View>

          {/* 4. Navigation: Bottom Link */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account?{" "}</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Signup')} activeOpacity={0.6}>
              <Text style={styles.signUpText}>Create one</Text>
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
    backgroundColor: '#F1F5F9', // Light gray background for icon
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
  forgotPasswordContainer: {
    alignSelf: 'flex-end',
    marginTop: -8,
    marginBottom: 32,
    padding: 4,
  },
  forgotPasswordText: {
    color: '#10B981', // Figma Teal
    fontWeight: '700',
    fontSize: 14,
  },
  loginButton: {
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
  signUpText: {
    color: '#10B981', // Figma Teal
    fontWeight: '800',
    fontSize: 15,
  },
});

export default LoginScreen;
