import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY_PREFIX = "safeseat_emergency_sms_event_v1:";

function storageKey(sessionId: string) {
  return `${KEY_PREFIX}${sessionId}`;
}

function makeEventId(sessionId: string) {
  const cleanSession = sessionId.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 80);
  return `emg-${cleanSession}-${Date.now()}`;
}

/**
 * Persist the event id so a component remount/app refresh during the SAME
 * emergency cannot create a second SMS cycle.
 */
export async function getOrCreateEmergencyEventId(sessionId: string): Promise<string> {
  const key = storageKey(sessionId);
  const existing = await AsyncStorage.getItem(key);
  if (existing) return existing;

  const created = makeEventId(sessionId);
  await AsyncStorage.setItem(key, created);
  return created;
}

/** Clear only after the authoritative Main Hub emergency has ended. */
export async function clearEmergencyEventId(sessionId?: string | null): Promise<void> {
  if (!sessionId) return;
  await AsyncStorage.removeItem(storageKey(sessionId));
}
