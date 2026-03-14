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
import { useNavigation } from '@react-navigation/native';
import { BaseButton, TextInput, Icon, Toast } from '../../components';

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = () => {
    if (!email || !password) return;
    
    // Dismiss keyboard instantly
    Keyboard.dismiss();
    
    // Instant Navigation with Stack Reset
    navigation.reset({
      index: 0,
      routes: [{ name: 'DashboardScreen' }],
    });

    if (onLogin) {
      onLogin(email, password);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
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
              style={styles.loginButton}
            >
              Login
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
