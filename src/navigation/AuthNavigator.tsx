import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen, SignupScreen, ForgotPasswordScreen } from '../screens';

export type AuthStackParamList = {
  Login: undefined;
  Signup: undefined;
  ForgotPassword: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

const AuthNavigator = ({ onLoginSuccess }: { onLoginSuccess: () => void }) => {
  return (
    <Stack.Navigator
      initialRouteName="Login"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: '#FFFFFF' },
      }}
    >
      <Stack.Screen name="Login">
        {(props) => (
          <LoginScreen
            onNavigateToSignUp={() => props.navigation.navigate('Signup')}
            onForgotPassword={() => props.navigation.navigate('ForgotPassword')}
            onLogin={(email) => {
              console.log('Login success:', email);
              onLoginSuccess();
            }}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="Signup">
        {(props) => (
          <SignupScreen
            onNavigateToLogin={() => props.navigation.navigate('Login')}
            onSignup={(email) => console.log('Signup attempt:', email)}
          />
        )}
      </Stack.Screen>

      <Stack.Screen name="ForgotPassword">
        {(props) => (
          <ForgotPasswordScreen
            onNavigateBack={() => props.navigation.navigate('Login')}
            onSendEmail={(email) => console.log('Reset attempt:', email)}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
};

export default AuthNavigator;
