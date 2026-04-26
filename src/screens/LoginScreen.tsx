import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Keyboard,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation } from "@react-navigation/native";
import { useUser } from "../context/UserContext";
import { signIn } from "../auth/firebaseAuthService";
import { BaseButton, TextInput, Toast } from "../../components";
import { Image } from "react-native";

const logo = require("../assets/logo.png");

const LoginScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const { setAccountData } = useUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    setError(null);
    if (!email || !password) { setError("Email and password are required"); return; }
    Keyboard.dismiss();
    setIsLoading(true);

    try {
      const { accountData } = await signIn(email.trim(), password);
      setAccountData(accountData);
      setShowToast(true);
    } catch (err: any) {
      const code = err?.code || "";
      const message = err?.message || "";
      if (code === "device/limit-reached") {
        navigation.navigate("DeviceConflict", { devices: err.devices || [], email: email.trim(), password });
        return;
      } else if (message.toLowerCase().includes("email not verified") || message.toLowerCase().includes("verification")) {
        navigation.navigate("VerifyEmail", { email: email.trim() });
        return;
      } else if (code === "auth/invalid-credential" || code === "auth/wrong-password") {
        setError("Invalid email or password");
      } else if (code === "auth/user-not-found") {
        setError("No account found with this email");
      } else if (code === "auth/too-many-requests") {
        setError("Too many attempts. Try again later.");
      } else {
        setError(message || "Login failed");
      }
    } finally { setIsLoading(false); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#059669" />
      <Toast visible={showToast} message="Logged in successfully" onHide={() => setShowToast(false)} type="success" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <LinearGradient colors={["#059669", "#10B981"]} style={styles.headerGradient}>
            <View style={styles.iconCircle}>
              <Image source={logo} style={styles.logoImg} resizeMode="contain" />
            </View>
            <Text style={styles.appName}>Limitter</Text>
            <Text style={styles.tagline}>Take control of your screen time</Text>
          </LinearGradient>

          <View style={styles.formCard}>
            <Text style={styles.formTitle}>Welcome back</Text>

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
              secureTextEntry
              error={error || undefined}
            />

            <TouchableOpacity
              style={styles.forgotContainer}
              onPress={() => navigation.navigate("ForgotPassword")}
              activeOpacity={0.6}
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>

            <BaseButton
              variant="primary"
              fullWidth
              onPress={handleLogin}
              disabled={isLoading}
              style={styles.loginButton}
            >
              {isLoading ? "Signing in..." : "Sign In"}
            </BaseButton>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate("Signup")} activeOpacity={0.6}>
              <Text style={styles.signUpText}>Create one</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1 },

  headerGradient: { alignItems: "center", paddingTop: 48, paddingBottom: 40 },
  iconCircle: { width: 72, height: 72, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", marginBottom: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", overflow: "hidden" },
  logoImg: { width: 52, height: 52 },
  appName: { fontSize: 32, fontWeight: "900", color: "#FFFFFF", letterSpacing: -0.5 },
  tagline: { fontSize: 14, color: "rgba(255,255,255,0.7)", marginTop: 6, fontWeight: "500" },

  formCard: { backgroundColor: "#FFFFFF", marginHorizontal: 20, marginTop: -20, borderRadius: 24, padding: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 5 },
  formTitle: { fontSize: 22, fontWeight: "800", color: "#0F172A", marginBottom: 24 },
  forgotContainer: { alignSelf: "flex-end", marginTop: -8, marginBottom: 24, padding: 4 },
  forgotText: { color: "#10B981", fontWeight: "700", fontSize: 13 },
  loginButton: { marginBottom: 8 },

  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: "auto", paddingVertical: 24 },
  footerText: { color: "#64748B", fontSize: 14 },
  signUpText: { color: "#10B981", fontWeight: "800", fontSize: 14 },
});

export default LoginScreen;
