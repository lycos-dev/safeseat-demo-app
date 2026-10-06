// utils/securitySession.ts
import * as LocalStore from "@/services/local-store";

const GRACE_PERIOD_MS = 15 * 60 * 1000; // 15 Minutes in milliseconds

export async function isSessionValid(): Promise<boolean> {
    try {
        const lastAuthTime = await LocalStore.getItemAsync("last_sudo_auth_timestamp");
        if (!lastAuthTime) return false;

        const timeElapsed = Date.now() - parseInt(lastAuthTime, 10);
        return timeElapsed < GRACE_PERIOD_MS;
    } catch {
        return false;
    }
}

export async function extendSession(): Promise<void> {
    await LocalStore.setItemAsync("last_sudo_auth_timestamp", Date.now().toString());
}

export async function clearSession(): Promise<void> {
    await LocalStore.deleteItemAsync("last_sudo_auth_timestamp");
}