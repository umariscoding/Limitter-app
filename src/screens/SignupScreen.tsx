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
import { BaseButton, TextInput, Toast } from "../../components";
import { Image } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { signUp } from "../auth/firebaseAuthService";

const logo = require("../assets/logo.png");

const SignupScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const validatePassword = (pwd: string): string | null => {
    if (pwd.length < 8) return "Password must be at least 8 characters";
    if (!/[A-Z]/.test(pwd)) return "Password must include at least one uppercase letter";
    if (!/[a-z]/.test(pwd)) return "Password must include at least one lowercase letter";
    if (!/[0-9]/.test(pwd)) return "Password must include at least one number";
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(pwd)) return "Password must include at least one special character";
    return null;
  };

  const handleSignup = async () => {
    setError(null);
    if (!email || !password) { setError("Email and password are required"); return; }
    const passwordError = validatePassword(password);
    if (passwordError) { setError(passwordError); return; }
    if (password !== confirmPassword) { setError("Passwords do not match"); return; }

    Keyboard.dismiss();
    setIsLoading(true);

    try {
      await signUp(email.trim(), password, name.trim() || email.split("@")[0]);
      setShowToast(true);
      setTimeout(() => { navigation.navigate("VerifyEmail", { email: email.trim() }); }, 1500);
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/email-already-in-use") setError("An account with this email already exists");
      else if (code === "auth/weak-password") setError("Password is too weak. Use at least 8 characters with uppercase, lowercase, number, and special character.");
      else if (code === "auth/invalid-email") setError("Invalid email address");
      else setError(err?.message || "Signup failed");
    } finally { setIsLoading(false); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#059669" />
      <Toast visible={showToast} message="Account created! Check your email to verify." onHide={() => setShowToast(false)} type="success" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <LinearGradient colors={["#059669", "#10B981"]} style={styles.headerGradient}>
            <View style={styles.iconCircle}>
              <Image source={logo} style={styles.logoImg} resizeMode="contain" />
            </View>
            <Text style={styles.headerTitle}>Create Account</Text>
            <Text style={styles.headerSubtitle}>Start managing your screen time</Text>
          </LinearGradient>

          <View style={styles.formCard}>
            <TextInput label="Name" placeholder="Enter your name" value={name} onChangeText={setName} autoCapitalize="words" />
            <TextInput label="Email Address" placeholder="Enter your email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
            <TextInput label="Password" placeholder="Create a password" value={password} onChangeText={setPassword} secureTextEntry />
            <TextInput label="Confirm Password" placeholder="Repeat your password" value={confirmPassword} onChangeText={setConfirmPassword} secureTextEntry error={error || undefined} />

            <BaseButton variant="primary" fullWidth onPress={handleSignup} disabled={isLoading} style={styles.signupButton}>
              {isLoading ? "Creating account..." : "Create Account"}
            </BaseButton>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity onPress={() => navigation.navigate("Login")} activeOpacity={0.6}>
              <Text style={styles.loginText}>Sign In</Text>
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

  headerGradient: { alignItems: "center", paddingTop: 40, paddingBottom: 36 },
  iconCircle: { width: 64, height: 64, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", marginBottom: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)", overflow: "hidden" },
  logoImg: { width: 46, height: 46 },
  headerTitle: { fontSize: 26, fontWeight: "900", color: "#FFFFFF" },
  headerSubtitle: { fontSize: 14, color: "rgba(255,255,255,0.7)", marginTop: 4, fontWeight: "500" },

  formCard: { backgroundColor: "#FFFFFF", marginHorizontal: 20, marginTop: -16, borderRadius: 24, padding: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 5 },
  signupButton: { marginTop: 16, marginBottom: 8 },

  footer: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: "auto", paddingVertical: 24 },
  footerText: { color: "#64748B", fontSize: 14 },
  loginText: { color: "#10B981", fontWeight: "800", fontSize: 14 },
});

export default SignupScreen;
