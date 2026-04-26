import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useUser } from "../context/UserContext";
import { replaceDeviceAPI } from "../services/deviceService";
import {
  getOrCreateInstallationId,
  signOut as doSignOut,
} from "../auth/firebaseAuthService";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../config/firebase";
import { Smartphone, AlertTriangle, ArrowLeft, RefreshCw } from "lucide-react-native";

interface ExistingDevice {
  deviceId: string;
  deviceName: string;
  platform: string;
  lastSeenAt: any;
}

function getDeviceInfo() {
  const constants = Platform.constants as any;
  const brand = constants?.Brand || constants?.brand || "";
  const model = constants?.Model || constants?.model || "";
  let deviceName = "Mobile Device";
  if (Platform.OS === "android" && brand && model) {
    const brandCap = brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase();
    deviceName = model.toLowerCase().startsWith(brand.toLowerCase()) ? model : `${brandCap} ${model}`;
  } else if (Platform.OS === "ios") {
    deviceName = "iPhone";
  }
  return {
    platform: Platform.OS === "ios" ? "ios" : "android",
    deviceType: "phone",
    deviceName,
    osVersion: String(Platform.Version),
    appVersion: "1.0.0",
  };
}

export default function DeviceConflictScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { setAccountData } = useUser();
  const devices: ExistingDevice[] = route.params?.devices || [];
  const emailParam: string = route.params?.email || "";
  const passwordParam: string = route.params?.password || "";
  const [replacing, setReplacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleReplace = async (oldDeviceId: string) => {
    setError(null);
    setReplacing(true);
    try {
      await signInWithEmailAndPassword(auth, emailParam, passwordParam);
      const installationId = await getOrCreateInstallationId();
      const deviceInfo = getDeviceInfo();
      await replaceDeviceAPI(
        oldDeviceId,
        installationId,
        deviceInfo.platform,
        deviceInfo.deviceType,
        deviceInfo.deviceName,
        deviceInfo.osVersion,
        deviceInfo.appVersion,
      );
      const { refreshBootstrap } = await import("../services/bootstrapService");
      const accountData = await refreshBootstrap();
      setAccountData(accountData);
    } catch (err: any) {
      setError(err?.message || "Failed to replace device. Try again.");
    } finally {
      setReplacing(false);
    }
  };

  const handleBack = async () => {
    try {
      await doSignOut();
    } catch {}
    navigation.goBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#DC2626" />
      <LinearGradient colors={["#DC2626", "#EF4444"]} style={styles.header}>
        <View style={styles.iconCircle}>
          <AlertTriangle size={32} color="#FFFFFF" />
        </View>
        <Text style={styles.headerTitle}>Device Limit Reached</Text>
        <Text style={styles.headerSub}>
          Your plan allows 1 device. Another device is already registered.
        </Text>
      </LinearGradient>

      <View style={styles.content}>
        <Text style={styles.sectionTitle}>Registered Device</Text>
        {devices.map((d) => (
          <View key={d.deviceId} style={styles.deviceCard}>
            <View style={styles.deviceIconWrap}>
              <Smartphone size={22} color="#6366F1" />
            </View>
            <View style={styles.deviceInfo}>
              <Text style={styles.deviceName}>{d.deviceName}</Text>
              <Text style={styles.devicePlatform}>{d.platform}</Text>
            </View>
          </View>
        ))}

        <Text style={styles.helpText}>
          Lost your device? Replace it with this one. The old device will be signed out immediately.
        </Text>

        {error && <Text style={styles.errorText}>{error}</Text>}

        {devices.map((d) => (
          <TouchableOpacity
            key={`replace-${d.deviceId}`}
            style={[styles.replaceBtn, replacing && { opacity: 0.6 }]}
            disabled={replacing}
            onPress={() => handleReplace(d.deviceId)}
            activeOpacity={0.8}
          >
            {replacing ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <>
                <RefreshCw size={18} color="#FFFFFF" />
                <Text style={styles.replaceBtnText}>Replace with this device</Text>
              </>
            )}
          </TouchableOpacity>
        ))}

        <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.7}>
          <ArrowLeft size={18} color="#64748B" />
          <Text style={styles.backBtnText}>Go back to login</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F1F5F9" },
  header: { alignItems: "center", paddingTop: 40, paddingBottom: 32 },
  iconCircle: {
    width: 64, height: 64, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
    marginBottom: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.15)",
  },
  headerTitle: { fontSize: 22, fontWeight: "900", color: "#FFFFFF" },
  headerSub: { fontSize: 14, color: "rgba(255,255,255,0.8)", marginTop: 6, textAlign: "center", paddingHorizontal: 40, fontWeight: "500" },

  content: { padding: 20, flex: 1 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#94A3B8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 },
  deviceCard: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#FFFFFF", padding: 16, borderRadius: 16,
    borderWidth: 1, borderColor: "#E8ECF4", marginBottom: 12, gap: 14,
    shadowColor: "#64748B", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2,
  },
  deviceIconWrap: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: "#EEF2FF", alignItems: "center", justifyContent: "center",
  },
  deviceInfo: { flex: 1 },
  deviceName: { fontSize: 16, fontWeight: "700", color: "#0F172A" },
  devicePlatform: { fontSize: 13, color: "#94A3B8", marginTop: 2, textTransform: "capitalize" },

  helpText: { fontSize: 14, color: "#64748B", lineHeight: 20, marginTop: 8, marginBottom: 20 },
  errorText: { fontSize: 14, color: "#DC2626", fontWeight: "600", marginBottom: 12 },

  replaceBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: "#DC2626", paddingVertical: 16, borderRadius: 14, marginBottom: 12,
  },
  replaceBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },

  backBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    paddingVertical: 14, marginTop: 4,
  },
  backBtnText: { color: "#64748B", fontWeight: "600", fontSize: 15 },
});
