import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * SafeSeat local key/value storage.
 *
 * Native builds keep using Expo SecureStore for protected local values.
 * Web builds use AsyncStorage because the Expo SecureStore web adapter is not
 * available/reliable in the current Expo web runtime. This also prevents the
 * auth gate from failing before Firebase can restore the session.
 */
export async function getLocalValue(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    return AsyncStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

export async function setLocalValue(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteLocalValue(key: string): Promise<void> {
  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
