import AsyncStorage from "@react-native-async-storage/async-storage";
import { getApps, initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  getReactNativePersistence,
  initializeAuth,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { Platform } from "react-native";

// SafeSeat Firebase public web configuration. These values are public Firebase
// client configuration (security is enforced by Firestore/Auth rules).
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "AIzaSyBqQgglCpUg1hFxt6lM2BI2f5YI3mewlDA",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "safeseat-app.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "safeseat-app",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "safeseat-app.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "1088522406363",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:1088522406363:web:0f8fbe44e9fdb259497ffe",
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-M33YE7MLY8",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

function getNativePersistenceStorage() {
  // SafeSeat currently pins AsyncStorage 2.2.x, whose default export is the
  // persistence object expected by Firebase Auth.
  return AsyncStorage && typeof AsyncStorage.getItem === "function" ? AsyncStorage : null;
}

function getClientAuth() {
  // Fast Refresh can run this module more than once. In that case Firebase
  // reports "already initialized" and the existing instance is the correct one.
  try {
    if (Platform.OS === "web") {
      return initializeAuth(app, { persistence: browserLocalPersistence });
    }

    const storage = getNativePersistenceStorage();
    if (typeof getReactNativePersistence === "function" && storage) {
      return initializeAuth(app, {
        persistence: getReactNativePersistence(storage),
      });
    }
  } catch (error) {
    // Only suppress the expected duplicate-initialization case. Any genuine
    // configuration error should still surface clearly rather than producing
    // a misleading "missing default export" route cascade.
    const message = error instanceof Error ? error.message : String(error);
    if (!/already initialized|already exists/i.test(message)) throw error;
  }

  return getAuth(app);
}

export const auth = getClientAuth();
export const db = getFirestore(app);
export default app;
