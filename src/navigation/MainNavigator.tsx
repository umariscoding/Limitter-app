import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import {
  DashboardScreen,
  AddContentScreen,
  ActivityScreen,
  UsageScreen,
  SettingsScreen,
  ControlPlansScreen,
  OverrideLogsScreen,
  LoginScreen,
  SignupScreen,
  ForgotPasswordScreen,
  SubscriptionPlansScreen,
  AnalyticsScreen,
  ConfirmOverrideScreen,
} from '../screens';

const Stack = createNativeStackNavigator();

const MainNavigator = () => {
  return (
    <Stack.Navigator 
      initialRouteName="Login" 
      screenOptions={{ headerShown: false, animation: 'fade_from_bottom' }}
    >
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="Signup" component={SignupScreen} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <Stack.Screen name="DashboardScreen" component={DashboardScreen} />
      <Stack.Screen name="AddContentScreen" component={AddContentScreen} />
      <Stack.Screen name="ActivityScreen" component={ActivityScreen} />
      <Stack.Screen name="UsageScreen" component={UsageScreen} />
      <Stack.Screen name="AnalyticsScreen" component={AnalyticsScreen} options={{ animation: 'none' }} />
      <Stack.Screen name="SettingsScreen" component={SettingsScreen} />
      <Stack.Screen name="ControlPlansScreen" component={ControlPlansScreen} />
      <Stack.Screen name="OverrideLogsScreen" component={OverrideLogsScreen} />
      <Stack.Screen 
        name="SubscriptionPlansScreen" 
        component={SubscriptionPlansScreen} 
        options={{ animation: 'none' }}
      />
      <Stack.Screen name="ConfirmOverrideScreen" component={ConfirmOverrideScreen} />
    </Stack.Navigator>
  );
};

export default MainNavigator;
