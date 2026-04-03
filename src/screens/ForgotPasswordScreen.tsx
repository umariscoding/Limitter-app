import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BaseButton, TextInput, Toast } from "../../components";
import { Shield } from "lucide-react-native";
import { useNavigation } from "@react-navigation/native";
import { resetPassword } from "../auth/firebaseAuthService";

const ForgotPasswordScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const [email, setEmail] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [isLoading, setIsLoading] = useState(false);

  const handleSendEmail = async () => {
    if (!email) { setToastMessage("Please enter your email address"); setToastType("error"); setShowToast(true); return; }
    setIsLoading(true);
    try {
      await resetPassword(email.trim());
      setToastType("success");
      setToastMessage("Password reset email sent!");
      setShowToast(true);
    } catch (err: any) {
      setToastType("error");
      setToastMessage(err?.message || "Failed to send reset email");
      setShowToast(true);
    } finally { setIsLoading(false); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4338CA" />
      <Toast visible={showToast} message={toastMessage} onHide={() => setShowToast(false)} type={toastType} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <LinearGradient colors={["#4338CA", "#6366F1"]} style={styles.headerGradient}>
            <View style={styles.iconCircle}>
              <Shield size={32} color="#FFFFFF" />
            </View>
            <Text style={styles.headerTitle}>Reset Password</Text>
            <Text style={styles.headerSubtitle}>We'll send you a link to reset your password</Text>
          </LinearGradient>

          <View style={styles.formCard}>
            <TextInput
              label="Email Address"
              placeholder="Enter your email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <BaseButton variant="primary" fullWidth onPress={handleSendEmail} disabled={isLoading} style={styles.actionBtn}>
              {isLoading ? "Sending..." : "Send Reset Email"}
            </BaseButton>
          </View>

          <View style={styles.footer}>
            <TouchableOpacity onPress={() => navigation.navigate("Login")} activeOpacity={0.6}>
              <Text style={styles.backText}>Back to Sign In</Text>
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
  iconCircle: { width: 64, height: 64, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", marginBottom: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  headerTitle: { fontSize: 26, fontWeight: "900", color: "#FFFFFF" },
  headerSubtitle: { fontSize: 14, color: "rgba(255,255,255,0.7)", marginTop: 6, fontWeight: "500", textAlign: "center", paddingHorizontal: 40 },
  formCard: { backgroundColor: "#FFFFFF", marginHorizontal: 20, marginTop: -16, borderRadius: 24, padding: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 5 },
  actionBtn: { marginTop: 16, marginBottom: 8 },
  footer: { justifyContent: "center", alignItems: "center", marginTop: "auto", paddingVertical: 24 },
  backText: { color: "#6366F1", fontWeight: "800", fontSize: 14 },
});

export default ForgotPasswordScreen;
