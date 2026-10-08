import * as Location from "expo-location";
import { Platform } from "react-native";

export type EmergencyLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: string;
};

/**
 * Request foreground location permission before active monitoring begins.
 * Permission failure must never prevent a SafeSeat monitoring session.
 */
export async function ensureEmergencyLocationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;

  try {
    const existing = await Location.getForegroundPermissionsAsync();
    if (existing.granted) return true;
    const requested = await Location.requestForegroundPermissionsAsync();
    return requested.granted;
  } catch (error) {
    console.warn("SafeSeat could not prepare location permission:", error);
    return false;
  }
}

/**
 * Obtain a fresh foreground position from the phone running SafeSeat.
 * Returns null on permission/GPS failure so SMS escalation can continue.
 */
export async function captureEmergencyLocation(): Promise<EmergencyLocation | null> {
  if (Platform.OS === "web") return null;

  try {
    const allowed = await ensureEmergencyLocationPermission();
    if (!allowed) return null;

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
      mayShowUserSettingsDialog: true,
    });

    const { latitude, longitude, accuracy } = position.coords;
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

    return {
      latitude,
      longitude,
      accuracy: Number.isFinite(accuracy ?? NaN) ? accuracy ?? undefined : undefined,
      timestamp: new Date(position.timestamp || Date.now()).toISOString(),
    };
  } catch (error) {
    console.warn("SafeSeat emergency GPS unavailable:", error);
    return null;
  }
}
