import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signOut as fbSignOut,
  onAuthStateChanged as fbOnAuthStateChanged,
  updateProfile,
  type User,
} from "firebase/auth";
import { auth } from "../config/firebase";
import axiosService from "../services/axiosService";
import { API } from "../config/config";
import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const INSTALLATION_ID_KEY = "@limitter_installation_id";

export async function getOrCreateInstallationId(): Promise<string> {
  let id = await AsyncStorage.getItem(INSTALLATION_ID_KEY);
  if (!id) {
    id =
      Date.now().toString(36) +
      Math.random().toString(36).substring(2, 10);
    await AsyncStorage.setItem(INSTALLATION_ID_KEY, id);
  }
  return id;
}

function getDeviceName(): string {
  if (Platform.OS === "android") {
    const constants = Platform.constants as any;
    const brand = constants?.Brand || constants?.brand || "";
    const model = constants?.Model || constants?.model || "";
    if (brand && model) {
      const brandCap = brand.charAt(0).toUpperCase() + brand.slice(1).toLowerCase();
      return model.toLowerCase().startsWith(brand.toLowerCase())
        ? model
        : `${brandCap} ${model}`;
    }
    return "Android Phone";
  }
  return "iPhone";
}

function getDeviceInfo() {
  return {
    platform: Platform.OS === "ios" ? ("ios" as const) : ("android" as const),
    deviceType: "phone" as const,
    deviceName: getDeviceName(),
    osVersion: String(Platform.Version),
    appVersion: "1.0.0",
  };
}

export async function signUp(
  email: string,
  password: string,
  displayName: string,
) {
  const credential = await createUserWithEmailAndPassword(auth, email, password);

  if (displayName) {
    await updateProfile(credential.user, { displayName });
  }

  const installationId = await getOrCreateInstallationId();
  const deviceInfo = getDeviceInfo();

  try {
    await axiosService.post(API.SetupAccount, {
      email,
      displayName,
      device: { installationId, ...deviceInfo },
    });
  } catch (setupError) {
    await credential.user.delete();
    throw setupError;
  }

  await sendEmailVerification(credential.user);
  await fbSignOut(auth);

  return { firebaseUser: null, accountData: null };
}

export async function signIn(email: string, password: string) {
  const credential = await signInWithEmailAndPassword(auth, email, password);

  if (!credential.user.emailVerified) {
    await sendEmailVerification(credential.user);
    await fbSignOut(auth);
    const err: any = new Error("Email not verified. We've sent a verification link to your email.");
    err.code = "auth/email-not-verified";
    throw err;
  }

  const installationId = await getOrCreateInstallationId();
  const deviceInfo = getDeviceInfo();

  const accountData = await axiosService.post(API.SetupAccount, {
    email,
    displayName: credential.user.displayName || email.split("@")[0],
    device: { installationId, ...deviceInfo },
  });

  return { firebaseUser: credential.user, accountData };
}

export async function bootstrap() {
  return await axiosService.get<any>(API.Bootstrap);
}

export async function getIdToken(): Promise<string | null> {
  const user = auth.currentUser;
  if (!user) return null;
  return user.getIdToken(true);
}

const SESSION_STORAGE_KEYS = [
  "@limitter_current_device_id",
  "@limitter_cached_policies",
  "limitter_unflushed_sessions",
  "@limitter_usage_queue",
];

export async function clearSessionData() {
  await AsyncStorage.multiRemove(SESSION_STORAGE_KEYS);
}

export async function signOut() {
  try {
    await axiosService.post(API.Logout);
  } catch { /* silenced */ }
  await clearSessionData();
  await fbSignOut(auth);
}

export async function updateDisplayName(name: string) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  // Firestore is the durable source of truth (CLAUDE.md §2.2). Persist there
  // first so that the profile endpoint — which reads from Firestore — returns
  // the new name on refresh. Firebase Auth is updated afterwards to keep the
  // auth-provider record in sync for any consumer that reads user.displayName
  // directly (tokens, ID claims, etc.).
  await axiosService.patch(API.AccountProfile, { displayName: name });
  await updateProfile(user, { displayName: name });
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(auth, email);
}

export function onAuthStateChanged(callback: (user: User | null) => void) {
  return fbOnAuthStateChanged(auth, callback);
}
