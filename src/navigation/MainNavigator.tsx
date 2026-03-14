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
  SubscriptionPlansScreen
} from '../screens';

const Stack = createNativeStackNavigator();

const MainNavigator = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="DashboardScreen" component={DashboardScreen} />
      <Stack.Screen name="AddContentScreen" component={AddContentScreen} />
      <Stack.Screen name="ActivityScreen" component={ActivityScreen} />
      <Stack.Screen name="UsageScreen" component={UsageScreen} />
      <Stack.Screen name="SettingsScreen" component={SettingsScreen} />
      <Stack.Screen name="ControlPlansScreen" component={ControlPlansScreen} />
      <Stack.Screen name="OverrideLogsScreen" component={OverrideLogsScreen} />
      <Stack.Screen name="Login" component={LoginScreen} />
      <Stack.Screen name="SubscriptionPlansScreen" component={SubscriptionPlansScreen} />
    </Stack.Navigator>
  );
};

export default MainNavigator;
