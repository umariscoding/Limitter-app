import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, StatusBar } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute } from "@react-navigation/native";
import { BaseButton, Toast } from "../../components";
import { Mail } from "lucide-react-native";
import axiosService from "../services/axiosService";
import { API } from "../config/config";

const VerifyEmailScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const email = route.params?.email || "";
  const [isResending, setIsResending] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");

  const handleResend = async () => {
    if (!email) return;
    setIsResending(true);
    try {
      await axiosService.post(API.ResendVerification, { email });
      setToastMessage("Verification email sent!");
      setToastType("success");
      setShowToast(true);
    } catch (err: any) {
      setToastMessage(err?.message || "Failed to resend. Try again.");
      setToastType("error");
      setShowToast(true);
    } finally { setIsResending(false); }
  };

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle="light-content" backgroundColor="#4338CA" />
      <Toast visible={showToast} message={toastMessage} onHide={() => setShowToast(false)} type={toastType} />

      <LinearGradient colors={["#4338CA", "#6366F1"]} style={s.headerGradient}>
        <View style={s.iconCircle}>
          <Mail size={32} color="#FFFFFF" />
        </View>
        <Text style={s.headerTitle}>Verify Your Email</Text>
      </LinearGradient>

      <View style={s.card}>
        <Text style={s.subtitle}>We've sent a verification link to</Text>
        <Text style={s.email}>{email}</Text>
        <Text style={s.instructions}>
          Check your inbox and tap the link to verify your account. Once verified, you can sign in.
        </Text>

        <BaseButton variant="primary" fullWidth onPress={() => navigation.navigate("Login")} style={{ marginBottom: 16 }}>
          Go to Sign In
        </BaseButton>

        <TouchableOpacity onPress={handleResend} disabled={isResending} activeOpacity={0.6} style={s.resendBtn}>
          <Text style={s.resendText}>
            {isResending ? "Sending..." : "Didn't receive it? Resend email"}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F1F5F9' },
  headerGradient: { alignItems: "center", paddingTop: 60, paddingBottom: 40 },
  iconCircle: { width: 72, height: 72, borderRadius: 24, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center", marginBottom: 16, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)" },
  headerTitle: { fontSize: 26, fontWeight: "900", color: "#FFFFFF" },
  card: { backgroundColor: "#FFFFFF", marginHorizontal: 20, marginTop: -16, borderRadius: 24, padding: 28, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.08, shadowRadius: 24, elevation: 5 },
  subtitle: { fontSize: 15, color: '#64748B', textAlign: 'center' },
  email: { fontSize: 16, fontWeight: '700', color: '#6366F1', marginTop: 4, marginBottom: 20 },
  instructions: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
  resendBtn: { padding: 8 },
  resendText: { color: '#6366F1', fontWeight: '700', fontSize: 14 },
});

export default VerifyEmailScreen;
