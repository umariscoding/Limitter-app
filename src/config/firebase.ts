import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  initializeAuth,
  getAuth,
  // @ts-ignore – Expo/RN compatible persistence
  getReactNativePersistence,
  type Auth,
} from "firebase/auth";
import { getDatabase } from "firebase/database";
import AsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyCRcKOOzsp_nX8auUOhAFR-UVhGqIgmOjU",
  authDomain: "test-ext-ad0b2.firebaseapp.com",
  projectId: "test-ext-ad0b2",
  storageBucket: "test-ext-ad0b2.firebasestorage.app",
  messagingSenderId: "642984588666",
  appId: "1:642984588666:web:dd1fcd739567df3a4d92c3",
  measurementId: "G-B0MC8CDXCK",
  databaseURL: "https://test-ext-ad0b2-default-rtdb.firebaseio.com",
};

let app: FirebaseApp;
let auth: Auth;

if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
  auth = initializeAuth(app, {
    persistence: getReactNativePersistence(AsyncStorage),
  });
} else {
  app = getApp();
  auth = getAuth(app);
}

const realtimeDB = getDatabase(app);

export { app, auth, realtimeDB };
