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

function getDeviceInfo() {
  return {
    platform: Platform.OS === "ios" ? ("ios" as const) : ("android" as const),
    deviceType: "phone" as const,
    deviceName: `${Platform.OS} ${Platform.Version}`,
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

  const accountData = await axiosService.post(API.SetupAccount, {
    email,
    displayName,
    device: { installationId, ...deviceInfo },
  });

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
  return user.getIdToken(false);
}

export async function signOut() {
  try {
    await axiosService.post(API.Logout);
  } catch { /* silenced */ }
  await fbSignOut(auth);
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(auth, email);
}

export function onAuthStateChanged(callback: (user: User | null) => void) {
  return fbOnAuthStateChanged(auth, callback);
}
