// utils/securitySession.ts
import { getLocalValue, setLocalValue, deleteLocalValue } from "@/services/local-storage";

const GRACE_PERIOD_MS = 15 * 60 * 1000; // 15 Minutes in milliseconds

export async function isSessionValid(): Promise<boolean> {
    try {
        const lastAuthTime = await getLocalValue("last_sudo_auth_timestamp");
        if (!lastAuthTime) return false;

        const timeElapsed = Date.now() - parseInt(lastAuthTime, 10);
        return timeElapsed < GRACE_PERIOD_MS;
    } catch {
        return false;
    }
}

export async function extendSession(): Promise<void> {
    await setLocalValue("last_sudo_auth_timestamp", Date.now().toString());
}

export async function clearSession(): Promise<void> {
    await deleteLocalValue("last_sudo_auth_timestamp");
}