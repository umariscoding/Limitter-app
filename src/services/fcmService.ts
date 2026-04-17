import { PermissionsAndroid, Platform } from "react-native";
import messaging, {
  FirebaseMessagingTypes,
} from "@react-native-firebase/messaging";
import { registerFcmTokenAPI } from "./billingApi";

export type FcmMessageType =
  | "subscription_updated"
  | "credits_updated"
  | "subscription_revoked";

export type FcmOnRefresh = (type: FcmMessageType) => Promise<void> | void;

const BILLING_TYPES = new Set<FcmMessageType>([
  "subscription_updated",
  "credits_updated",
  "subscription_revoked",
]);

let tokenRefreshSub: (() => void) | null = null;
let foregroundSub: (() => void) | null = null;
let backgroundHandlerRegistered = false;

async function requestAndroidPermission(): Promise<boolean> {
  if (Platform.OS !== "android") return true;
  try {
    const apiLevel =
      typeof Platform.Version === "number"
        ? Platform.Version
        : parseInt(String(Platform.Version || "0"), 10);
    if (apiLevel < 33) return true;

    const result = await PermissionsAndroid.request(
      "android.permission.POST_NOTIFICATIONS" as any,
    );
    return result === PermissionsAndroid.RESULTS.GRANTED;
  } catch (err: any) {
    console.warn(`[fcmService] permission request failed: ${err?.message || err}`);
    return false;
  }
}

async function handleDataMessage(
  message: FirebaseMessagingTypes.RemoteMessage,
  onRefresh: FcmOnRefresh,
): Promise<void> {
  const type = message?.data?.type as FcmMessageType | undefined;
  if (!type || !BILLING_TYPES.has(type)) return;
  try {
    await onRefresh(type);
  } catch (err: any) {
    console.warn(`[fcmService] onRefresh handler failed: ${err?.message || err}`);
  }
}

export async function initFcm(
  deviceId: string,
  onRefresh: FcmOnRefresh,
): Promise<void> {
  if (Platform.OS !== "android") return;

  const granted = await requestAndroidPermission();
  if (!granted) {
    console.warn("[fcmService] POST_NOTIFICATIONS permission denied");
  }

  try {
    await messaging().registerDeviceForRemoteMessages();
  } catch {}

  try {
    const token = await messaging().getToken();
    if (token && deviceId) {
      try {
        await registerFcmTokenAPI(deviceId, token);
      } catch (err: any) {
        console.warn(`[fcmService] token registration failed: ${err?.message || err}`);
      }
    }
  } catch (err: any) {
    console.warn(`[fcmService] getToken failed: ${err?.message || err}`);
  }

  if (tokenRefreshSub) tokenRefreshSub();
  tokenRefreshSub = messaging().onTokenRefresh(async (newToken) => {
    if (!newToken || !deviceId) return;
    try {
      await registerFcmTokenAPI(deviceId, newToken);
    } catch (err: any) {
      console.warn(`[fcmService] onTokenRefresh registration failed: ${err?.message || err}`);
    }
  });

  if (foregroundSub) foregroundSub();
  foregroundSub = messaging().onMessage(async (message) => {
    await handleDataMessage(message, onRefresh);
  });

  if (!backgroundHandlerRegistered) {
    messaging().setBackgroundMessageHandler(async (message) => {
      await handleDataMessage(message, () => {});
    });
    backgroundHandlerRegistered = true;
  }
}

export function endFcm(): void {
  if (tokenRefreshSub) {
    tokenRefreshSub();
    tokenRefreshSub = null;
  }
  if (foregroundSub) {
    foregroundSub();
    foregroundSub = null;
  }
}
