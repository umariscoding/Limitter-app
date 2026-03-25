import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
    } finally {
      setIsResending(false);
    }
  };

  return (
    <SafeAreaView style={s.container}>
      <Toast visible={showToast} message={toastMessage} onHide={() => setShowToast(false)} type={toastType} />
      <View style={s.content}>
        <View style={s.iconWrap}>
          <Mail size={48} color="#4F46E5" />
        </View>
        <Text style={s.title}>Verify Your Email</Text>
        <Text style={s.subtitle}>We've sent a verification link to</Text>
        <Text style={s.email}>{email}</Text>
        <Text style={s.instructions}>
          Please check your inbox and tap the link to verify your account. Once verified, you can log in.
        </Text>

        <BaseButton variant="primary" fullWidth onPress={() => navigation.navigate("Login")} style={{ marginBottom: 20 }}>
          Go to Login
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
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 },
  iconWrap: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  title: { fontSize: 26, fontWeight: '900', color: '#0F172A', marginBottom: 12 },
  subtitle: { fontSize: 15, color: '#64748B', textAlign: 'center' },
  email: { fontSize: 16, fontWeight: '700', color: '#4F46E5', marginTop: 4, marginBottom: 20 },
  instructions: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 22, marginBottom: 40 },
  resendBtn: { padding: 8 },
  resendText: { color: '#10B981', fontWeight: '700', fontSize: 14 },
});

export default VerifyEmailScreen;
