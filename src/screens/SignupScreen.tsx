import React, { useState } from "react";
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
} from "react-native";
import { BaseButton, TextInput, Toast } from "../../components";
import { Shield } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { signUp } from "../auth/firebaseAuthService";

const SignupScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSignup = async () => {
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!email || !password) {
      setError("Email and password are required");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    Keyboard.dismiss();
    setIsLoading(true);

    try {
      await signUp(
        email.trim(),
        password,
        name.trim() || email.split("@")[0],
      );
      setShowToast(true);
      setTimeout(() => {
        navigation.navigate("VerifyEmail", { email: email.trim() });
      }, 1500);
    } catch (err: any) {
      const code = err?.code || "";
      if (code === "auth/email-already-in-use") {
        setError("An account with this email already exists");
      } else if (code === "auth/weak-password") {
        setError("Password is too weak. Use at least 6 characters.");
      } else if (code === "auth/invalid-email") {
        setError("Invalid email address");
      } else {
        setError(err?.message || "Signup failed");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Toast
        visible={showToast}
        message="Account created! Check your email to verify."
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
            <Text style={styles.title}>Create Account</Text>
          </View>

          <View style={styles.formContainer}>
            <TextInput
              label="Name"
              placeholder="Enter your name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
            />
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
              secureTextEntry
            />
            <TextInput
              label="Confirm Password"
              placeholder="Repeat your password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              error={error || undefined}
            />

            <BaseButton
              variant="primary"
              fullWidth
              onPress={handleSignup}
              disabled={isLoading}
              style={styles.signupButton}
            >
              {isLoading ? "Creating account..." : "Create Account"}
            </BaseButton>
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate("Login")}
              activeOpacity={0.6}
            >
              <Text style={styles.loginText}>Login</Text>
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
  signupButton: { marginTop: 16, marginBottom: 24 },
  footer: {
    flexDirection: "row", justifyContent: "center", alignItems: "center",
    marginTop: "auto", paddingTop: 24,
  },
  footerText: { color: "#64748B", fontSize: 15 },
  loginText: { color: "#10B981", fontWeight: "800", fontSize: 15 },
});

export default SignupScreen;
