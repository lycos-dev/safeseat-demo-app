import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApps, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  // @ts-expect-error - getReactNativePersistence exists in the RN bundle but isn't typed in the Firebase web SDK definitions
  getReactNativePersistence,
  initializeAuth,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { Platform } from "react-native";

// Firebase web config comes from EXPO_PUBLIC_* variables (see .env.example).
// Fallbacks keep the app from crashing at import time (auth/invalid-api-key)
// when no .env file is present; real sign-in still requires the real values.
const PROJECT_ID = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "safeseat-app";

// Firebase Web configuration is public client configuration, not a server secret.
// Environment variables remain the preferred override, while these known SafeSeat
// values keep exported Web/Vercel builds functional even when Vercel has not been
// given a local .env file.
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyBqQgglCpUg1hFxt6lM2BI2f5YI3mewlDA",
  authDomain:
    process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "safeseat-app.firebaseapp.com",
  projectId: PROJECT_ID,
  storageBucket:
    process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "safeseat-app.firebasestorage.app",
  messagingSenderId:
    process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "1088522406363",
  appId:
    process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:1088522406363:web:0f8fbe44e9fdb259497ffe",
  measurementId:
    process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-M33YE7MLY8",
};

// 1. Safe instance initialization
const app =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// 2. Safe, crash-resistant Auth instance generation
const getClientAuth = () => {
  // Try to initialize Auth with the correct persistence first.
  // If it's already been initialized (e.g. during Fast Refresh), this throws,
  // and we fall back to grabbing the existing instance instead.
  try {
    if (Platform.OS === "web") {
      return initializeAuth(app, {
        persistence: browserLocalPersistence,
      });
    } else {
      return initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage),
      });
    }
  } catch (error) {
    return getAuth(app);
  }
};

export const auth = getClientAuth();
export const db = getFirestore(app);
export default app;
