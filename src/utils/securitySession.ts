// utils/securitySession.ts
import * as SecureStore from "expo-secure-store";

const GRACE_PERIOD_MS = 15 * 60 * 1000; // 15 Minutes in milliseconds

export async function isSessionValid(): Promise<boolean> {
    try {
        const lastAuthTime = await SecureStore.getItemAsync("last_sudo_auth_timestamp");
        if (!lastAuthTime) return false;

        const timeElapsed = Date.now() - parseInt(lastAuthTime, 10);
        return timeElapsed < GRACE_PERIOD_MS;
    } catch {
        return false;
    }
}

export async function extendSession(): Promise<void> {
    await SecureStore.setItemAsync("last_sudo_auth_timestamp", Date.now().toString());
}

export async function clearSession(): Promise<void> {
    await SecureStore.deleteItemAsync("last_sudo_auth_timestamp");
}