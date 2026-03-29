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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { useUser } from "../context/UserContext";
import { signIn } from "../auth/firebaseAuthService";
import { BaseButton, TextInput, Toast } from "../../components";
import { Shield } from "lucide-react-native";

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
    if (!email || !password) {
      setError("Email and password are required");
      return;
    }
    Keyboard.dismiss();
    setIsLoading(true);

    try {
      const { accountData } = await signIn(email.trim(), password);
      setAccountData(accountData);
      setShowToast(true);
    } catch (err: any) {
      const code = err?.code || "";
      const message = err?.message || "";
      console.log("🔑 LoginScreen: Error:", err);
      if (message.toLowerCase().includes("email not verified") || message.toLowerCase().includes("verification")) {
        // Email not verified — redirect to verify screen
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
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Toast
        visible={showToast}
        message="Logged in successfully"
        onHide={() => setShowToast(false)}
        type="success"
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Shield size={48} color="#4F46E5" />
            </View>
            <Text style={styles.title}>Login</Text>
          </View>

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
              secureTextEntry
              error={error || undefined}
            />

            <TouchableOpacity
              style={styles.forgotPasswordContainer}
              onPress={() => navigation.navigate("ForgotPassword")}
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
              {isLoading ? "Signing in..." : "Login"}
            </BaseButton>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account? </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("Signup")}
              activeOpacity={0.6}
            >
              <Text style={styles.signUpText}>Create one</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingBottom: 40 },
  header: { alignItems: "center", marginTop: 40, marginBottom: 48 },
  iconContainer: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: "#F1F5F9",
    alignItems: "center", justifyContent: "center", marginBottom: 20,
  },
  title: { fontSize: 28, fontWeight: "900", color: "#0F172A", textAlign: "center" },
  formContainer: { width: "100%" },
  forgotPasswordContainer: { alignSelf: "flex-end", marginTop: -8, marginBottom: 32, padding: 4 },
  forgotPasswordText: { color: "#10B981", fontWeight: "700", fontSize: 14 },
  loginButton: { marginBottom: 24 },
  footer: {
    flexDirection: "row", justifyContent: "center", alignItems: "center",
    marginTop: "auto", paddingTop: 24,
  },
  footerText: { color: "#64748B", fontSize: 15 },
  signUpText: { color: "#10B981", fontWeight: "800", fontSize: 15 },
});

export default LoginScreen;
