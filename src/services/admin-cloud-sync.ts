import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

import { auth, db } from "../firebase";
import type { SafeSeatStatusPayload } from "./safeseat-hub";

export type CloudSyncProfile = {
  id: string;
  name: string;
  isAccountOwner?: boolean;
  isGuest?: boolean;
  sessionOnly?: boolean;
};

export type CloudSyncPreferences = {
  consent: boolean;
  behavioralMonitoring: boolean;
  physiologicalMonitoring: boolean;
  emergencyEscalation: boolean;
};

export type CloudSeatState = "safe" | "warning" | "emergency" | "unknown";
export type AdminFusionState = "NORMAL" | "SUSPECTED" | "VERIFYING" | "EMERGENCY" | "CLEARED";
export type AdminModuleStatus = "operational" | "degraded" | "offline" | "standby";

const ACTIVE_CLOUD_SESSION_KEY = "safeSeatActiveCloudSessionId"; // legacy single-session key
const ACTIVE_CLOUD_SESSIONS_KEY = "safeSeatActiveCloudSessionsV2";

export const SAFESEAT_CLOUD_VEHICLE = {
  id: (process.env.EXPO_PUBLIC_SAFESEAT_VEHICLE_ID || "SS-CAV-8151").trim(),
  plate: (process.env.EXPO_PUBLIC_SAFESEAT_VEHICLE_PLATE || "CAV 8151").trim(),
  label: (process.env.EXPO_PUBLIC_SAFESEAT_VEHICLE_LABEL || "Toyota Vios Lumina Jade").trim(),
  hubId: (process.env.EXPO_PUBLIC_SAFESEAT_HUB_ID || "SAFESEAT-MAIN-HUB").trim(),
} as const;

const SEAT_LABELS: Record<number, string> = {
  1: "Driver",
  2: "Front Passenger",
  3: "Left Rear",
  4: "Center Rear",
  5: "Right Rear",
};

function compactUid(uid: string) {
  return uid.replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase();
}

export function cloudSeatLabel(seatNo: number) {
  return SEAT_LABELS[seatNo] ?? `Seat ${seatNo}`;
}

function normalizeHealth(connected: boolean | undefined, health: string | undefined): AdminModuleStatus {
  if (!connected) return "offline";
  const value = String(health || "").trim().toUpperCase();
  if (value === "UNAVAILABLE" || value === "OFFLINE" || value === "DISCONNECTED") return "offline";
  if (value === "DEGRADED" || value === "WARMING_UP" || value === "STALE") return "degraded";
  return "operational";
}

function cameraModuleState(status: SafeSeatStatusPayload | null, connected: boolean): AdminModuleStatus {
  if (!connected || status?.camera?.available === false || status?.camera?.connected === false) return "offline";
  if (status?.camera?.stale || status?.camera?.camera_ready === false || status?.camera?.model_ready === false) return "degraded";
  if (status?.camera?.verification_requested || status?.camera?.request_active || status?.camera?.busy || status?.camera?.session_active) return "operational";
  return "standby";
}

export function toAdminFusionState(status: SafeSeatStatusPayload | null): AdminFusionState {
  const raw = String(status?.system?.fusion_state || "").trim().toUpperCase();
  if (!raw) return "NORMAL";
  if (raw === "SAFE" || raw === "NORMAL" || raw === "CLEAR" || raw === "CLEARED") return "NORMAL";
  if (raw === "EMERGENCY" || raw.includes("EMERG")) return "EMERGENCY";
  // Camera verification is corroboration only and never replaces Fusion.
  if (raw === "WARNING" || raw === "WATCH" || raw === "SUSPECTED" || raw.includes("WARN")) return "SUSPECTED";
  return "SUSPECTED";
}

export function toAdminCameraState(status: SafeSeatStatusPayload | null): "Standby" | "Verifying" | "Unavailable" {
  if (!status?.camera || status.camera.available === false || status.camera.connected === false) return "Unavailable";
  if (status.system?.camera_verification_requested || status.camera.verification_requested || status.camera.request_active || status.camera.busy) return "Verifying";
  return "Standby";
}

function postureFromStatus(status: SafeSeatStatusPayload | null) {
  const value = String(status?.camera?.posture || "").trim().toLowerCase().replace(/[_-]+/g, " ");
  if (!value) return "Not requested";
  if (value.includes("upright") || value === "normal") return "Upright";
  if (value.includes("forward")) return "Leaning Forward";
  if (value.includes("back")) return "Leaning Backward";
  if (value.includes("left")) return "Leaning Left";
  if (value.includes("right")) return "Leaning Right";
  return "Unknown";
}

function occupantFields(uid: string, sessionId: string, seatNo: number, profile: CloudSyncProfile) {
  if (profile.isGuest || profile.sessionOnly) {
    return {
      occupantType: "guest" as const,
      guestSessionId: `${sessionId}-GUEST-${seatNo}`,
      guestDisplayName: profile.name?.trim() || "Guest",
    };
  }

  if (profile.isAccountOwner || profile.id === uid) {
    return {
      occupantType: "registered" as const,
      occupantUserId: uid,
    };
  }

  return {
    occupantType: "profile" as const,
    profileOwnerUid: uid,
    profileId: profile.id,
    profileDisplayName: profile.name?.trim() || "Saved profile",
  };
}

export async function syncAccountDirectory(preferences: CloudSyncPreferences) {
  const user = auth.currentUser;
  if (!user) return;

  let name = user.displayName?.trim() || "SafeSeat Driver";
  let email = user.email?.trim() || "";
  try {
    const userSnap = await getDoc(doc(db, "users", user.uid));
    if (userSnap.exists()) {
      const data = userSnap.data();
      if (typeof data.name === "string" && data.name.trim()) name = data.name.trim();
      if (typeof data.email === "string" && data.email.trim()) email = data.email.trim();
    }
  } catch (error) {
    console.warn("SafeSeat cloud sync could not read the private user profile:", error);
  }

  let accountStatus: "ACTIVE" | "DISABLED" = "ACTIVE";
  try {
    const directorySnap = await getDoc(doc(db, "account_directory", user.uid));
    if (directorySnap.exists() && directorySnap.data().status === "DISABLED") accountStatus = "DISABLED";
  } catch (error) {
    console.warn("SafeSeat cloud sync could not read the Admin-safe directory record:", error);
  }

  await setDoc(doc(db, "account_directory", user.uid), {
    name,
    email,
    operatorId: `DRV-${compactUid(user.uid)}`,
    role: "Driver",
    status: accountStatus,
    consent: {
      dataSharing: Boolean(preferences.consent),
      healthMonitoring: Boolean(preferences.behavioralMonitoring || preferences.physiologicalMonitoring),
      emergencyEscalation: Boolean(preferences.emergencyEscalation),
    },
    lastActive: serverTimestamp(),
    updatedAt: serverTimestamp(),
    provisioningStatus: "MOBILE_SYNC",
  }, { merge: true });
}

export async function ensureVehicleForDriver(seatNo: number) {
  const user = auth.currentUser;
  if (!user) return;

  await setDoc(doc(db, "vehicles", SAFESEAT_CLOUD_VEHICLE.id), {
    ownerUid: user.uid,
    plate: SAFESEAT_CLOUD_VEHICLE.plate,
    label: SAFESEAT_CLOUD_VEHICLE.label,
    driverId: user.uid,
    monitoredSeat: cloudSeatLabel(seatNo),
    hubId: SAFESEAT_CLOUD_VEHICLE.hubId,
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function syncHardwareStatus(status: SafeSeatStatusPayload | null, connected: boolean) {
  const user = auth.currentUser;
  if (!user) return;

  const mainHub: AdminModuleStatus = !connected
    ? "offline"
    : status?.telemetry_ready
      ? "operational"
      : "degraded";
  const c1001 = normalizeHealth(status?.sensors?.c1001?.connected, status?.sensors?.c1001?.health);
  const mlx90614 = normalizeHealth(status?.sensors?.mlx90614?.connected, status?.sensors?.mlx90614?.health);
  const fsr = normalizeHealth(status?.sensors?.fsr?.connected, status?.sensors?.fsr?.health);
  const mpu6050 = normalizeHealth(status?.sensors?.mpu6050?.connected, status?.sensors?.mpu6050?.health);
  const camera = cameraModuleState(status, connected);
  const states = [mainHub, c1001, mlx90614, fsr, mpu6050, camera];
  const overallStatus: AdminModuleStatus = mainHub === "offline"
    ? "offline"
    : states.some((value) => value === "offline" || value === "degraded")
      ? "degraded"
      : "operational";

  // This document is a complete, privacy-minimized snapshot. Replace it
  // rather than merging so legacy/experimental fields cannot make the
  // current write fail safeHardware() validation in Firestore rules.
  await setDoc(doc(db, "hardware_status", SAFESEAT_CLOUD_VEHICLE.id), {
    ownerUid: user.uid,
    vehicleId: SAFESEAT_CLOUD_VEHICLE.id,
    overallStatus,
    mainHub,
    c1001,
    mlx90614,
    backrestFsr: fsr,
    cushionFsr: fsr,
    mpu6050,
    camera,
    lastSeen: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

async function readActiveCloudSessionMap(): Promise<Record<number, string>> {
  const raw = await AsyncStorage.getItem(ACTIVE_CLOUD_SESSIONS_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<number, string>;
  } catch {
    return {};
  }
}

async function writeActiveCloudSessionMap(value: Record<number, string>) {
  if (Object.keys(value).length === 0) {
    await AsyncStorage.removeItem(ACTIVE_CLOUD_SESSIONS_KEY);
    return;
  }
  await AsyncStorage.setItem(ACTIVE_CLOUD_SESSIONS_KEY, JSON.stringify(value));
}

export async function getActiveCloudSessionId(seatNo?: number) {
  const map = await readActiveCloudSessionMap();
  if (seatNo && map[seatNo]) return map[seatNo];
  const first = Object.values(map)[0];
  if (first) return first;
  return AsyncStorage.getItem(ACTIVE_CLOUD_SESSION_KEY);
}

export async function syncMonitoringSession(args: {
  sessionId: string;
  seatNo: number;
  profile: CloudSyncProfile;
  status: SafeSeatStatusPayload | null;
}) {
  const user = auth.currentUser;
  if (!user) return null;

  const sessionId = args.sessionId;
  const occupant = occupantFields(user.uid, sessionId, args.seatNo, args.profile);

  await setDoc(doc(db, "monitoring_sessions", sessionId), {
    ownerUid: user.uid,
    vehicleId: SAFESEAT_CLOUD_VEHICLE.id,
    seat: cloudSeatLabel(args.seatNo),
    ...occupant,
    fusionState: toAdminFusionState(args.status),
    cameraState: toAdminCameraState(args.status),
    active: true,
    lastUpdate: serverTimestamp(),
    updatedAt: serverTimestamp(),
  }, { merge: true });

  const map = await readActiveCloudSessionMap();
  if (map[args.seatNo] !== sessionId) {
    map[args.seatNo] = sessionId;
    await writeActiveCloudSessionMap(map);
  }
  // Remove the legacy single-session pointer once V2 seat-scoped sync succeeds.
  await AsyncStorage.removeItem(ACTIVE_CLOUD_SESSION_KEY);
  return sessionId;
}

export async function endCloudSessionForSeat(seatNo: number, explicitSessionId?: string) {
  const user = auth.currentUser;
  if (!user) return;
  const map = await readActiveCloudSessionMap();
  const sessionId = explicitSessionId || map[seatNo];
  if (!sessionId) return;

  await updateDoc(doc(db, "monitoring_sessions", sessionId), {
    active: false,
    fusionState: "CLEARED",
    cameraState: "Standby",
    lastUpdate: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  if (map[seatNo] === sessionId) {
    delete map[seatNo];
    await writeActiveCloudSessionMap(map);
  }
}

export async function endCurrentCloudSession() {
  const user = auth.currentUser;
  if (!user) return;

  const map = await readActiveCloudSessionMap();
  for (const [seatString, sessionId] of Object.entries(map)) {
    try {
      await endCloudSessionForSeat(Number(seatString), sessionId);
    } catch (error) {
      console.warn("SafeSeat could not close a seat-scoped Admin session:", error);
    }
  }

  const legacySessionId = await AsyncStorage.getItem(ACTIVE_CLOUD_SESSION_KEY);
  if (legacySessionId) {
    try {
      await updateDoc(doc(db, "monitoring_sessions", legacySessionId), {
        active: false,
        fusionState: "CLEARED",
        cameraState: "Standby",
        lastUpdate: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      console.warn("SafeSeat could not close the legacy Admin session:", error);
    } finally {
      await AsyncStorage.removeItem(ACTIVE_CLOUD_SESSION_KEY);
    }
  }
}

export async function createEmergencyIncident(args: {
  sessionId: string;
  seatNo: number;
  profile: CloudSyncProfile;
  status: SafeSeatStatusPayload | null;
}) {
  const user = auth.currentUser;
  if (!user) return null;

  const incidentId = `${args.sessionId}-EMERGENCY`;
  const incidentRef = doc(db, "incidents", incidentId);
  const existing = await getDoc(incidentRef);
  if (existing.exists()) return incidentId;

  const occupant = occupantFields(user.uid, args.sessionId, args.seatNo, args.profile);
  const now = new Date().toISOString();
  const verificationRequested = Boolean(
    args.status?.system?.camera_verification_requested ||
    args.status?.camera?.verification_requested ||
    args.status?.camera?.request_active,
  );

  await setDoc(incidentRef, {
    ownerUid: user.uid,
    vehicleId: SAFESEAT_CLOUD_VEHICLE.id,
    seat: cloudSeatLabel(args.seatNo),
    ...occupant,
    category: "SafeSeat emergency escalation",
    triggerSummary: verificationRequested
      ? "Multi-sensor anomaly evidence persisted; event-based posture verification was requested before escalation."
      : "SafeSeat sensor-fusion reached an emergency state from locally derived evidence.",
    posture: postureFromStatus(args.status),
    stateAtPeak: "EMERGENCY",
    status: "ESCALATED",
    resolution: "Awaiting administrator review.",
    smsEscalated: false,
    timeline: [
      {
        time: now,
        title: "Emergency state received",
        description: "The Main Hub reported an authoritative emergency fusion state for the monitored seat.",
      },
      ...(verificationRequested ? [{
        time: now,
        title: "Camera verification context",
        description: "Event-based posture verification participated as supporting evidence; no image or video was uploaded.",
      }] : []),
    ],
    occurredAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  return incidentId;
}

export function subscribeToDiagnosticRequests(onPending: (requestId: string) => void) {
  const user = auth.currentUser;
  if (!user) return () => undefined;

  const diagnosticsQuery = query(
    collection(db, "diagnostic_requests"),
    where("vehicleId", "==", SAFESEAT_CLOUD_VEHICLE.id),
  );

  return onSnapshot(diagnosticsQuery, (snapshot) => {
    snapshot.docs.forEach((request) => {
      if (request.data().status === "PENDING") onPending(request.id);
    });
  }, (error) => {
    console.warn("SafeSeat diagnostic request listener deferred:", error);
  });
}

export async function completeDiagnosticRequest(
  requestId: string,
  status: SafeSeatStatusPayload | null,
  connected: boolean,
) {
  const user = auth.currentUser;
  if (!user) return;

  const mainHub: AdminModuleStatus = !connected
    ? "offline"
    : status?.telemetry_ready
      ? "operational"
      : "degraded";
  const result = mainHub === "operational" ? "operational" : mainHub === "offline" ? "offline" : "degraded";

  // Refresh the detailed module-level health record first; the diagnostic
  // request itself stores only the high-level privacy-safe result.
  await syncHardwareStatus(status, connected);
  await updateDoc(doc(db, "diagnostic_requests", requestId), {
    status: "COMPLETE",
    result,
    completedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function markCurrentIncidentSmsEscalated(sessionId?: string) {
  const resolvedSessionId = sessionId || await getActiveCloudSessionId();
  if (!resolvedSessionId || !auth.currentUser) return;
  try {
    await updateDoc(doc(db, "incidents", `${resolvedSessionId}-EMERGENCY`), {
      smsEscalated: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn("SafeSeat could not update the Admin incident SMS status:", error);
  }
}
