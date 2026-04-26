import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { ActivityIndicator, View } from "react-native";
import { useUser } from "../context/UserContext";
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
  DailyLimitsGraphScreen,
  VerifyEmailScreen,
  PoliciesScreen,
  DeviceConflictScreen,
} from "../screens";
import BuyOverridesScreen from '../screens/BuyOverridesScreen';

const Stack = createNativeStackNavigator();

const screenOptions = { headerShown: false, animation: "fade_from_bottom" as const };

const MainNavigator = () => {
  const { isAuthenticated, isLoading } = useUser();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FFF" }}>
        <ActivityIndicator size="large" color="#4F46E5" />
      </View>
    );
  }

  return (
    <Stack.Navigator screenOptions={screenOptions}>
      {!isAuthenticated ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
          <Stack.Screen name="DeviceConflict" component={DeviceConflictScreen} />

        </>
      ) : (
        <>
          <Stack.Screen name="DashboardScreen" component={DashboardScreen} />
          <Stack.Screen name="AddContentScreen" component={AddContentScreen} />
          <Stack.Screen name="ActivityScreen" component={ActivityScreen} />
          <Stack.Screen name="UsageScreen" component={UsageScreen} />
          <Stack.Screen name="AnalyticsScreen" component={AnalyticsScreen} options={{ animation: "none" }} />
          <Stack.Screen name="SettingsScreen" component={SettingsScreen} />
          <Stack.Screen name="ControlPlansScreen" component={ControlPlansScreen} />
          <Stack.Screen name="OverrideLogsScreen" component={OverrideLogsScreen} />
          <Stack.Screen name="SubscriptionPlansScreen" component={SubscriptionPlansScreen} options={{ animation: "none" }} />
          <Stack.Screen name="ConfirmOverrideScreen" component={ConfirmOverrideScreen} />
          <Stack.Screen name="DailyLimitsGraphScreen" component={DailyLimitsGraphScreen} />
          <Stack.Screen name="PoliciesScreen" component={PoliciesScreen} />
          <Stack.Screen
            name="BuyOverrides"
            component={BuyOverridesScreen}
            options={{ headerShown: false }}
          />

        </>
      )}
    </Stack.Navigator>
  );
};

export default MainNavigator;
