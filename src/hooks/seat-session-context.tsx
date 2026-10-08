import AsyncStorage from "@react-native-async-storage/async-storage";
import { collection, deleteDoc, doc, getDocs, setDoc } from "firebase/firestore";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { auth, db } from "../firebase";
import type { SafeSeatStatusPayload } from "../services/safeseat-hub";
import { ensureEmergencyLocationPermission } from "../services/emergency-location";
import { useSafeSeatHub } from "./safeseat-hub-context";

const IS_LOCKED_IN_KEY = "isLockedIn";
const SEAT_ASSIGNMENTS_KEY = "seatAssignments";
const HARDWARE_SEAT_KEY = "safeSeatHardwareSeatNo";
const SEAT_CONSENTS_KEY = "seatSessionConsents";
const STORAGE_VERSION = 1;
const SAMPLE_INTERVAL_MS = 5_000;
const MAX_SAMPLES_PER_SESSION = 1_200;
const MAX_HISTORY_ITEMS = 100;
const HISTORY_RETENTION_DAYS = 30;
const HISTORY_RETENTION_MS = HISTORY_RETENTION_DAYS * 24 * 60 * 60 * 1000;

const SEAT_LABELS: Record<number, string> = {
  1: "Driver",
  2: "Front Passenger",
  3: "Rear Left",
  4: "Rear Center",
  5: "Rear Right",
};

export type SeatSessionProfile = {
  id: string;
  name: string;
  photoURL?: string;
  icon?: string;
  isAccountOwner?: boolean;
  isGuest?: boolean;
  sessionOnly?: boolean;
};

export type MovementActivity = "Stable" | "Movement detected" | "Verification active" | "Unavailable";
export type SessionCameraState = "Standby" | "Verifying" | "Unavailable";
export type SessionFusionState = "NORMAL" | "SUSPECTED" | "MONITORING" | "VERIFYING" | "EMERGENCY" | "ANALYZING";

export type SeatSessionSample = {
  timestamp: number;
  heartRateBpm?: number;
  respirationRateBpm?: number;
  surfaceTemperatureC?: number;
  occupied?: boolean;
  movementActivity: MovementActivity;
  cameraVerification: SessionCameraState;
  fusionState: SessionFusionState;
};

export type SeatSessionEvent = {
  timestamp: number;
  type: "start" | "movement" | "verification" | "verification_complete" | "warning" | "emergency" | "recovery" | "end" | "system";
  title: string;
  detail?: string;
};

export type NumericSummary = {
  average: number;
  minimum: number;
  maximum: number;
};

export type SeatSessionSummary = {
  heartRate?: NumericSummary;
  respirationRate?: NumericSummary;
  surfaceTemperature?: NumericSummary;
  movementEvents: number;
  verificationEvents: number;
  warningEvents: number;
  emergencyEvents: number;
  activityLabel: string;
};

export type SeatSessionRecord = {
  schemaVersion: number;
  id: string;
  seatNo: number;
  seatLabel: string;
  occupant: {
    profileId: string;
    displayName: string;
    type: "account" | "profile" | "guest";
  };
  hardwareLinked: boolean;
  startedAt: number;
  endedAt?: number;
  samples: SeatSessionSample[];
  events: SeatSessionEvent[];
  summary?: SeatSessionSummary;
};

type StartSessionInput = {
  assignments: Record<number, SeatSessionProfile>;
  hardwareSeatNo: number | null;
  consents: Record<number, "confirmed" | "declined">;
};

type EndSeatResult = {
  session: SeatSessionRecord | null;
  remainingSeatNos: number[];
};

type SeatSessionContextValue = {
  loaded: boolean;
  activeSessions: Record<number, SeatSessionRecord>;
  recentCompleted: Record<number, SeatSessionRecord>;
  history: SeatSessionRecord[];
  startSeatSessions: (input: StartSessionInput) => Promise<void>;
  endSeatSession: (seatNo: number) => Promise<EndSeatResult>;
  endAllSeatSessions: () => Promise<SeatSessionRecord[]>;
  dismissCompletedSeat: (seatNo: number) => Promise<void>;
  clearRecentCompleted: () => Promise<void>;
  deleteSession: (id: string) => Promise<void>;
  clearSessionHistory: () => Promise<void>;
  refreshHistoryFromCloud: () => Promise<void>;
  getSessionById: (id: string) => SeatSessionRecord | undefined;
};

const SeatSessionContext = createContext<SeatSessionContextValue | null>(null);

function storageKey(kind: "active" | "history" | "recent") {
  const uid = auth.currentUser?.uid ?? "anonymous";
  return `safeSeatSeatSessions:${STORAGE_VERSION}:${uid}:${kind}`;
}


function historyControlKey(kind: "deletedIds" | "clearAll") {
  const uid = auth.currentUser?.uid ?? "anonymous";
  return `safeSeatSeatSessions:${STORAGE_VERSION}:${uid}:${kind}`;
}

function isExpiredSession(session: SeatSessionRecord, now = Date.now()) {
  const timestamp = session.endedAt ?? session.startedAt;
  return timestamp < now - HISTORY_RETENTION_MS;
}

function occupantType(profile: SeatSessionProfile): "account" | "profile" | "guest" {
  if (profile.isGuest || profile.sessionOnly) return "guest";
  if (profile.isAccountOwner || profile.id === auth.currentUser?.uid) return "account";
  return "profile";
}

function occupantDisplayName(profile: SeatSessionProfile) {
  if (profile.isAccountOwner) return "Me";
  if (profile.isGuest || profile.sessionOnly) return "Guest";
  return profile.name?.trim() || "Saved profile";
}

function sessionIdForSeat(seatNo: number) {
  const uid = (auth.currentUser?.uid ?? "LOCAL").replace(/[^A-Za-z0-9]/g, "").slice(0, 8).toUpperCase();
  return `SS-${Date.now()}-${uid}-S${seatNo}`;
}

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function numericSummary(values: Array<number | undefined>, decimals = 1): NumericSummary | undefined {
  const actual = values.filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (actual.length === 0) return undefined;
  return {
    average: round(actual.reduce((sum, value) => sum + value, 0) / actual.length, decimals),
    minimum: round(Math.min(...actual), decimals),
    maximum: round(Math.max(...actual), decimals),
  };
}

function summarizeSession(session: SeatSessionRecord): SeatSessionSummary {
  const movementEvents = session.events.filter((event) => event.type === "movement").length;
  const verificationEvents = session.events.filter((event) => event.type === "verification").length;
  const warningEvents = session.events.filter((event) => event.type === "warning").length;
  const emergencyEvents = session.events.filter((event) => event.type === "emergency").length;
  const stableSamples = session.samples.filter((sample) => sample.movementActivity === "Stable").length;
  const usableActivitySamples = session.samples.filter((sample) => sample.movementActivity !== "Unavailable").length;
  const stableShare = usableActivitySamples > 0 ? stableSamples / usableActivitySamples : 0;

  let activityLabel = "No movement data";
  if (usableActivitySamples > 0) {
    if (verificationEvents > 0) activityLabel = "Verification occurred";
    else if (movementEvents > 0 && stableShare < 0.8) activityLabel = "Movement observed";
    else activityLabel = "Mostly stable";
  }

  return {
    heartRate: numericSummary(session.samples.map((sample) => sample.heartRateBpm), 0),
    respirationRate: numericSummary(session.samples.map((sample) => sample.respirationRateBpm), 1),
    surfaceTemperature: numericSummary(session.samples.map((sample) => sample.surfaceTemperatureC), 1),
    movementEvents,
    verificationEvents,
    warningEvents,
    emergencyEvents,
    activityLabel,
  };
}

function toFusionState(status: SafeSeatStatusPayload | null): SessionFusionState {
  if (!status?.telemetry_ready || !status.system?.fusion_valid) return "ANALYZING";
  const raw = String(status.system?.fusion_state ?? "").trim().toUpperCase();
  if (raw === "EMERGENCY" || raw.includes("EMERG")) return "EMERGENCY";
  if (raw === "WARNING" || raw === "SUSPECTED" || raw.includes("WARN")) return "SUSPECTED";
  if (raw === "WATCH") return "MONITORING";
  if (raw === "SAFE" || raw === "NORMAL" || raw === "CLEAR" || raw === "CLEARED") return "NORMAL";
  return "ANALYZING";
}

function toCameraState(status: SafeSeatStatusPayload | null, connected: boolean): SessionCameraState {
  // Camera availability never changes Fusion severity. Passenger history only
  // records whether a visual-confirmation cycle was requested/in progress.
  if (!connected || !status) return "Standby";
  if (
    status.system?.camera_verification_requested ||
    status.camera?.verification_requested ||
    status.camera?.request_active ||
    String(status.camera?.user_verification_state ?? "").toUpperCase() === "IN_PROGRESS"
  ) return "Verifying";
  return "Standby";
}

function toMovementActivity(status: SafeSeatStatusPayload | null, connected: boolean): MovementActivity {
  if (!connected || !status) return "Unavailable";
  const rawMotion = String(status.system?.motion_context ?? "").trim().toLowerCase();
  const movement = Boolean(
    status.sensors?.c1001?.motion_artifact_active ||
    status.system?.evidence?.motion_artifact_possible ||
    rawMotion.includes("motion") ||
    rawMotion.includes("moving") ||
    rawMotion.includes("movement"),
  );
  return movement ? "Movement detected" : "Stable";
}

function buildSample(status: SafeSeatStatusPayload | null, connected: boolean): SeatSessionSample {
  const c1001 = status?.sensors?.c1001;
  const vitalsTrusted = Boolean(
    connected &&
    status?.telemetry_ready &&
    c1001?.connected &&
    !c1001?.stale &&
    c1001?.trusted_vitals,
  );
  const hr = vitalsTrusted && typeof c1001?.heart_rate_bpm === "number" && Number.isFinite(c1001.heart_rate_bpm)
    ? Math.round(c1001.heart_rate_bpm)
    : undefined;
  const rr = vitalsTrusted && typeof c1001?.respiration_rate_bpm === "number" && Number.isFinite(c1001.respiration_rate_bpm)
    ? round(c1001.respiration_rate_bpm, 1)
    : undefined;

  const mlx = status?.sensors?.mlx90614;
  const surfaceTemp = connected && mlx?.connected && mlx?.valid !== false && typeof mlx?.object_temperature_c === "number" && Number.isFinite(mlx.object_temperature_c)
    ? round(mlx.object_temperature_c, 1)
    : undefined;

  return {
    timestamp: Date.now(),
    ...(hr !== undefined ? { heartRateBpm: hr } : {}),
    ...(rr !== undefined ? { respirationRateBpm: rr } : {}),
    ...(surfaceTemp !== undefined ? { surfaceTemperatureC: surfaceTemp } : {}),
    ...(typeof status?.sensors?.fsr?.occupied === "boolean" ? { occupied: status.sensors.fsr.occupied } : {}),
    movementActivity: toMovementActivity(status, connected),
    cameraVerification: toCameraState(status, connected),
    fusionState: toFusionState(status),
  };
}

function transitionEvents(previous: SeatSessionSample | undefined, next: SeatSessionSample): SeatSessionEvent[] {
  const events: SeatSessionEvent[] = [];
  if (!previous) return events;

  if (previous.movementActivity !== next.movementActivity && next.movementActivity === "Movement detected") {
    events.push({ timestamp: next.timestamp, type: "movement", title: "Movement detected", detail: "SafeSeat observed a change in movement activity." });
  }
  if (previous.cameraVerification !== "Verifying" && next.cameraVerification === "Verifying") {
    events.push({ timestamp: next.timestamp, type: "verification", title: "Visual confirmation requested", detail: "Event-triggered visual confirmation started. No image or video is stored in session history." });
  }
  if (previous.cameraVerification === "Verifying" && next.cameraVerification !== "Verifying") {
    events.push({ timestamp: next.timestamp, type: "verification_complete", title: "Visual confirmation completed", detail: "The visual-confirmation cycle ended. Detailed posture results remain researcher/report evidence only." });
  }

  if (previous.fusionState !== next.fusionState) {
    if (next.fusionState === "SUSPECTED") {
      events.push({ timestamp: next.timestamp, type: "warning", title: "Unusual pattern detected", detail: "SafeSeat entered a warning state and continued monitoring." });
    } else if (next.fusionState === "EMERGENCY") {
      events.push({ timestamp: next.timestamp, type: "emergency", title: "Emergency state", detail: "Persistent multisensor evidence reached the emergency state." });
    } else if (next.fusionState === "MONITORING" && (previous.fusionState === "SUSPECTED" || previous.fusionState === "EMERGENCY")) {
      events.push({ timestamp: next.timestamp, type: "recovery", title: "Recovery monitoring", detail: "Alert evidence cleared and SafeSeat continued checking before returning to normal." });
    } else if (next.fusionState === "NORMAL" && (previous.fusionState === "SUSPECTED" || previous.fusionState === "MONITORING" || previous.fusionState === "VERIFYING" || previous.fusionState === "EMERGENCY")) {
      events.push({ timestamp: next.timestamp, type: "recovery", title: "Normal monitoring restored", detail: "The monitored state returned to normal." });
    }
  }
  return events;
}

function sanitizeForFirestore<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

async function bestEffortCloudSave(session: SeatSessionRecord) {
  const user = auth.currentUser;
  if (!user || !session.endedAt) return;
  try {
    await setDoc(doc(db, "users", user.uid, "tripHistory", session.id), sanitizeForFirestore(session), { merge: true });
  } catch (error) {
    console.warn("SafeSeat private session history cloud sync deferred:", error);
  }
}

function normalizeSession(value: any): SeatSessionRecord | null {
  if (!value || typeof value !== "object" || typeof value.id !== "string" || typeof value.seatNo !== "number") return null;
  return {
    schemaVersion: Number(value.schemaVersion) || STORAGE_VERSION,
    id: value.id,
    seatNo: value.seatNo,
    seatLabel: typeof value.seatLabel === "string" ? value.seatLabel : (SEAT_LABELS[value.seatNo] ?? `Seat ${value.seatNo}`),
    occupant: value.occupant,
    hardwareLinked: Boolean(value.hardwareLinked),
    startedAt: Number(value.startedAt) || Date.now(),
    endedAt: value.endedAt ? Number(value.endedAt) : undefined,
    samples: Array.isArray(value.samples) ? value.samples : [],
    events: Array.isArray(value.events) ? value.events : [],
    summary: value.summary,
  };
}

export function SeatSessionProvider({ children }: { children: ReactNode }) {
  const { connected, status } = useSafeSeatHub();
  const [loaded, setLoaded] = useState(false);
  const [activeSessions, setActiveSessions] = useState<Record<number, SeatSessionRecord>>({});
  const [recentCompleted, setRecentCompleted] = useState<Record<number, SeatSessionRecord>>({});
  const [history, setHistory] = useState<SeatSessionRecord[]>([]);
  const activeRef = useRef<Record<number, SeatSessionRecord>>({});
  const historyRef = useRef<SeatSessionRecord[]>([]);
  const recentRef = useRef<Record<number, SeatSessionRecord>>({});
  const deletedHistoryIdsRef = useRef<Set<string>>(new Set());
  const pendingClearAllRef = useRef(false);
  const lastSampleAtRef = useRef<Record<number, number>>({});
  const lastSampleSignatureRef = useRef<Record<number, string>>({});

  const persistActive = useCallback(async (value: Record<number, SeatSessionRecord>) => {
    activeRef.current = value;
    setActiveSessions(value);
    await AsyncStorage.setItem(storageKey("active"), JSON.stringify(value));
  }, []);

  const persistHistory = useCallback(async (value: SeatSessionRecord[]) => {
    const limited = value
      .filter((session) => !isExpiredSession(session))
      .slice(0, MAX_HISTORY_ITEMS);
    historyRef.current = limited;
    setHistory(limited);
    await AsyncStorage.setItem(storageKey("history"), JSON.stringify(limited));
  }, []);

  const persistDeletedHistoryIds = useCallback(async () => {
    const ids = Array.from(deletedHistoryIdsRef.current);
    if (ids.length > 0) {
      await AsyncStorage.setItem(historyControlKey("deletedIds"), JSON.stringify(ids));
    } else {
      await AsyncStorage.removeItem(historyControlKey("deletedIds"));
    }
  }, []);

  const persistPendingClearAll = useCallback(async () => {
    if (pendingClearAllRef.current) {
      await AsyncStorage.setItem(historyControlKey("clearAll"), JSON.stringify(true));
    } else {
      await AsyncStorage.removeItem(historyControlKey("clearAll"));
    }
  }, []);

  const persistRecent = useCallback(async (value: Record<number, SeatSessionRecord>) => {
    recentRef.current = value;
    setRecentCompleted(value);
    await AsyncStorage.setItem(storageKey("recent"), JSON.stringify(value));
  }, []);

  const refreshHistoryFromCloud = useCallback(async () => {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const snapshot = await getDocs(collection(db, "users", user.uid, "tripHistory"));

      if (pendingClearAllRef.current) {
        await Promise.all(snapshot.docs.map((item) => deleteDoc(item.ref)));
        pendingClearAllRef.current = false;
        deletedHistoryIdsRef.current.clear();
        await Promise.all([
          persistHistory([]),
          persistRecent({}),
          persistDeletedHistoryIds(),
          persistPendingClearAll(),
        ]);
        return;
      }

      const now = Date.now();
      const expiredIds = new Set<string>();
      snapshot.docs.forEach((item) => {
        const normalized = normalizeSession(item.data());
        if (normalized && isExpiredSession(normalized, now)) expiredIds.add(item.id);
      });

      expiredIds.forEach((id) => deletedHistoryIdsRef.current.add(id));
      const suppressedIds = new Set(deletedHistoryIdsRef.current);

      const deleteTargets = snapshot.docs.filter(
        (item) => suppressedIds.has(item.id),
      );

      if (deleteTargets.length > 0) {
        try {
          await Promise.all(deleteTargets.map((item) => deleteDoc(item.ref)));
          deleteTargets.forEach((item) => deletedHistoryIdsRef.current.delete(item.id));
          await persistDeletedHistoryIds();
        } catch (error) {
          // Keep the tombstones locally so a cloud record never reappears in
          // the UI while deletion is waiting for connectivity.
          await persistDeletedHistoryIds();
          console.warn("SafeSeat private history deletion will retry:", error);
        }
      }

      const cloud = snapshot.docs
        .filter((item) => !suppressedIds.has(item.id) && !expiredIds.has(item.id))
        .map((item) => normalizeSession(item.data()))
        .filter((item): item is SeatSessionRecord => item !== null && Boolean(item.endedAt) && !isExpiredSession(item));

      const merged = new Map<string, SeatSessionRecord>();
      historyRef.current
        .filter((item) => !deletedHistoryIdsRef.current.has(item.id) && !isExpiredSession(item))
        .forEach((item) => merged.set(item.id, item));
      cloud.forEach((item) => merged.set(item.id, item));

      const next = Array.from(merged.values())
        .sort((a, b) => (b.endedAt ?? b.startedAt) - (a.endedAt ?? a.startedAt));
      await persistHistory(next);
    } catch (error) {
      console.warn("SafeSeat private session history refresh deferred:", error);
    }
  }, [persistDeletedHistoryIds, persistHistory, persistPendingClearAll, persistRecent]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [rawActive, rawHistory, rawRecent, rawDeletedIds, rawClearAll, rawLocked, rawAssignments, rawHardwareSeat, rawConsents] = await Promise.all([
          AsyncStorage.getItem(storageKey("active")),
          AsyncStorage.getItem(storageKey("history")),
          AsyncStorage.getItem(storageKey("recent")),
          AsyncStorage.getItem(historyControlKey("deletedIds")),
          AsyncStorage.getItem(historyControlKey("clearAll")),
          AsyncStorage.getItem(IS_LOCKED_IN_KEY),
          AsyncStorage.getItem(SEAT_ASSIGNMENTS_KEY),
          AsyncStorage.getItem(HARDWARE_SEAT_KEY),
          AsyncStorage.getItem(SEAT_CONSENTS_KEY),
        ]);
        if (cancelled) return;

        let active: Record<number, SeatSessionRecord> = rawActive ? JSON.parse(rawActive) : {};
        const deletedIds = new Set<string>(rawDeletedIds ? JSON.parse(rawDeletedIds) : []);
        const pendingClearAll = rawClearAll ? Boolean(JSON.parse(rawClearAll)) : false;
        deletedHistoryIdsRef.current = deletedIds;
        pendingClearAllRef.current = pendingClearAll;

        const savedHistory: SeatSessionRecord[] = pendingClearAll
          ? []
          : (rawHistory ? JSON.parse(rawHistory) : [])
              .filter((item: SeatSessionRecord) => !deletedIds.has(item.id) && !isExpiredSession(item));
        const savedRecent: Record<number, SeatSessionRecord> = pendingClearAll
          ? {}
          : Object.fromEntries(
              Object.entries(rawRecent ? JSON.parse(rawRecent) : {})
                .filter(([, item]) => {
                  const session = item as SeatSessionRecord;
                  return !deletedIds.has(session.id) && !isExpiredSession(session);
                }),
            ) as Record<number, SeatSessionRecord>;

        // Migration path from builds that only had the global isLockedIn flag.
        const locked = rawLocked ? Boolean(JSON.parse(rawLocked)) : false;
        if (locked && Object.keys(active).length === 0) {
          const assignments: Record<number, SeatSessionProfile> = rawAssignments ? JSON.parse(rawAssignments) : {};
          const consents: Record<number, "confirmed" | "declined"> = rawConsents ? JSON.parse(rawConsents) : {};
          const hardwareSeatNo = rawHardwareSeat ? Number(JSON.parse(rawHardwareSeat)) : null;
          const now = Date.now();
          active = {};
          Object.entries(assignments).forEach(([seatString, profile]) => {
            const seatNo = Number(seatString);
            const eligible = Boolean(profile.isAccountOwner || consents[seatNo] === "confirmed");
            if (!eligible) return;
            const id = sessionIdForSeat(seatNo);
            active[seatNo] = {
              schemaVersion: STORAGE_VERSION,
              id,
              seatNo,
              seatLabel: SEAT_LABELS[seatNo] ?? `Seat ${seatNo}`,
              occupant: {
                profileId: profile.id,
                displayName: occupantDisplayName(profile),
                type: occupantType(profile),
              },
              hardwareLinked: seatNo === hardwareSeatNo,
              startedAt: now,
              samples: [],
              events: [{ timestamp: now, type: "system", title: "Session restored", detail: "SafeSeat restored this active seat after an app update or restart." }],
            };
          });
          await AsyncStorage.setItem(storageKey("active"), JSON.stringify(active));
        }

        activeRef.current = active;
        historyRef.current = savedHistory;
        recentRef.current = savedRecent;
        setActiveSessions(active);
        setHistory(savedHistory);
        setRecentCompleted(savedRecent);

        // Physically rewrite the filtered local stores so expired/deleted
        // completed sessions are not merely hidden from the UI.
        await Promise.all([
          AsyncStorage.setItem(storageKey("history"), JSON.stringify(savedHistory)),
          AsyncStorage.setItem(storageKey("recent"), JSON.stringify(savedRecent)),
        ]);

        setLoaded(true);
        void refreshHistoryFromCloud();
      } catch (error) {
        console.warn("SafeSeat session history could not be restored:", error);
        if (!cancelled) setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [refreshHistoryFromCloud]);

  const startSeatSessions = useCallback(async ({ assignments, hardwareSeatNo, consents }: StartSessionInput) => {
    // Ask for foreground GPS permission as monitoring begins, not during an
    // emergency. Denial/failure never blocks the monitoring session.
    if (assignments[1]?.isAccountOwner) {
      await ensureEmergencyLocationPermission().catch(() => false);
    }

    const now = Date.now();
    const next: Record<number, SeatSessionRecord> = { ...activeRef.current };
    const nextRecent = { ...recentRef.current };

    Object.entries(assignments).forEach(([seatString, profile]) => {
      const seatNo = Number(seatString);
      const eligible = Boolean(profile.isAccountOwner || consents[seatNo] === "confirmed");
      if (!eligible || next[seatNo]) return;
      const id = sessionIdForSeat(seatNo);
      next[seatNo] = {
        schemaVersion: STORAGE_VERSION,
        id,
        seatNo,
        seatLabel: SEAT_LABELS[seatNo] ?? `Seat ${seatNo}`,
        occupant: {
          profileId: profile.id,
          displayName: occupantDisplayName(profile),
          type: occupantType(profile),
        },
        hardwareLinked: seatNo === hardwareSeatNo,
        startedAt: now,
        samples: [],
        events: [{ timestamp: now, type: "start", title: "Session started", detail: seatNo === hardwareSeatNo ? "Live SafeSeat monitoring started for this seat." : "Passenger session started. No SafeSeat sensor is linked to this seat in the current prototype." }],
      };
      delete nextRecent[seatNo];
    });

    await Promise.all([persistActive(next), persistRecent(nextRecent)]);
  }, [persistActive, persistRecent]);

  const finalizeSeat = useCallback(async (seatNo: number): Promise<EndSeatResult> => {
    const current = activeRef.current[seatNo];
    if (!current) return { session: null, remainingSeatNos: Object.keys(activeRef.current).map(Number) };

    const endedAt = Date.now();
    const ended: SeatSessionRecord = {
      ...current,
      endedAt,
      events: [...current.events, { timestamp: endedAt, type: "end" as const, title: "Session ended", detail: "This seat's session was saved while other active seats can continue monitoring." }].slice(-100),
    };
    ended.summary = summarizeSession(ended);

    const nextActive = { ...activeRef.current };
    delete nextActive[seatNo];
    const nextRecent = { ...recentRef.current, [seatNo]: ended };
    const nextHistory = [ended, ...historyRef.current.filter((item) => item.id !== ended.id)];

    await Promise.all([
      persistActive(nextActive),
      persistRecent(nextRecent),
      persistHistory(nextHistory),
    ]);
    void bestEffortCloudSave(ended);
    return { session: ended, remainingSeatNos: Object.keys(nextActive).map(Number) };
  }, [persistActive, persistHistory, persistRecent]);

  const endSeatSession = useCallback(async (seatNo: number) => finalizeSeat(seatNo), [finalizeSeat]);

  const endAllSeatSessions = useCallback(async () => {
    const seatNos = Object.keys(activeRef.current).map(Number);
    const ended: SeatSessionRecord[] = [];
    for (const seatNo of seatNos) {
      const result = await finalizeSeat(seatNo);
      if (result.session) ended.push(result.session);
    }
    return ended;
  }, [finalizeSeat]);

  const dismissCompletedSeat = useCallback(async (seatNo: number) => {
    const next = { ...recentRef.current };
    delete next[seatNo];
    await persistRecent(next);
  }, [persistRecent]);

  const clearRecentCompleted = useCallback(async () => {
    await persistRecent({});
  }, [persistRecent]);


  const deleteSession = useCallback(async (id: string) => {
    const user = auth.currentUser;
    deletedHistoryIdsRef.current.add(id);

    const nextHistory = historyRef.current.filter((item) => item.id !== id);
    const nextRecent = Object.fromEntries(
      Object.entries(recentRef.current).filter(([, item]) => item.id !== id),
    ) as Record<number, SeatSessionRecord>;

    await Promise.all([
      persistHistory(nextHistory),
      persistRecent(nextRecent),
      persistDeletedHistoryIds(),
    ]);

    if (!user) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "tripHistory", id));
      deletedHistoryIdsRef.current.delete(id);
      await persistDeletedHistoryIds();
    } catch (error) {
      console.warn("SafeSeat session deletion will retry when cloud access returns:", error);
    }
  }, [persistDeletedHistoryIds, persistHistory, persistRecent]);

  const clearSessionHistory = useCallback(async () => {
    const user = auth.currentUser;
    pendingClearAllRef.current = true;

    historyRef.current.forEach((item) => deletedHistoryIdsRef.current.add(item.id));
    Object.values(recentRef.current).forEach((item) => deletedHistoryIdsRef.current.add(item.id));

    await Promise.all([
      persistHistory([]),
      persistRecent({}),
      persistDeletedHistoryIds(),
      persistPendingClearAll(),
    ]);

    if (!user) return;

    try {
      const snapshot = await getDocs(collection(db, "users", user.uid, "tripHistory"));
      await Promise.all(snapshot.docs.map((item) => deleteDoc(item.ref)));
      pendingClearAllRef.current = false;
      deletedHistoryIdsRef.current.clear();
      await Promise.all([
        persistDeletedHistoryIds(),
        persistPendingClearAll(),
      ]);
    } catch (error) {
      console.warn("SafeSeat clear-history cloud deletion will retry:", error);
    }
  }, [persistDeletedHistoryIds, persistHistory, persistPendingClearAll, persistRecent]);

  useEffect(() => {
    if (!loaded || !status) return;
    const linkedEntry = Object.values(activeRef.current).find((session) => session.hardwareLinked);
    if (!linkedEntry) return;

    const now = Date.now();
    const nextSample = buildSample(status, connected);
    const importantSignature = `${nextSample.fusionState}|${nextSample.cameraVerification}|${nextSample.movementActivity}`;
    const lastAt = lastSampleAtRef.current[linkedEntry.seatNo] ?? 0;
    const importantChanged = lastSampleSignatureRef.current[linkedEntry.seatNo] !== importantSignature;
    if (!importantChanged && now - lastAt < SAMPLE_INTERVAL_MS) return;

    lastSampleAtRef.current[linkedEntry.seatNo] = now;
    lastSampleSignatureRef.current[linkedEntry.seatNo] = importantSignature;

    const current = activeRef.current[linkedEntry.seatNo];
    if (!current) return;
    const previous = current.samples[current.samples.length - 1];
    const samples = [...current.samples, nextSample].slice(-MAX_SAMPLES_PER_SESSION);
    const events = [...current.events, ...transitionEvents(previous, nextSample)].slice(-100);
    const updated: SeatSessionRecord = { ...current, samples, events };
    const next = { ...activeRef.current, [linkedEntry.seatNo]: updated };
    void persistActive(next).catch((error) => console.warn("SafeSeat live session sample could not be saved:", error));
  }, [connected, loaded, persistActive, status]);

  const getSessionById = useCallback((id: string) => {
    const active = Object.values(activeRef.current).find((item) => item.id === id);
    if (active) return active;
    const recent = Object.values(recentRef.current).find((item) => item.id === id);
    if (recent) return recent;
    return historyRef.current.find((item) => item.id === id);
  }, []);

  const value = useMemo<SeatSessionContextValue>(() => ({
    loaded,
    activeSessions,
    recentCompleted,
    history,
    startSeatSessions,
    endSeatSession,
    endAllSeatSessions,
    dismissCompletedSeat,
    clearRecentCompleted,
    deleteSession,
    clearSessionHistory,
    refreshHistoryFromCloud,
    getSessionById,
  }), [
    activeSessions,
    clearRecentCompleted,
    clearSessionHistory,
    deleteSession,
    dismissCompletedSeat,
    endAllSeatSessions,
    endSeatSession,
    getSessionById,
    history,
    loaded,
    recentCompleted,
    refreshHistoryFromCloud,
    startSeatSessions,
  ]);

  return <SeatSessionContext.Provider value={value}>{children}</SeatSessionContext.Provider>;
}

export function useSeatSessions() {
  const value = useContext(SeatSessionContext);
  if (!value) throw new Error("useSeatSessions must be used inside SeatSessionProvider");
  return value;
}

export function formatSessionDuration(startedAt: number, endedAt = Date.now()) {
  const totalSeconds = Math.max(0, Math.floor((endedAt - startedAt) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours > 0) return `${hours}h ${remainingMinutes}m`;
  if (minutes > 0) return `${minutes} min`;
  return `${Math.max(1, totalSeconds)} sec`;
}
