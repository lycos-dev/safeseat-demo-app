import AsyncStorage from "@react-native-async-storage/async-storage";
import { onAuthStateChanged } from "firebase/auth";
import { ReactNode, useEffect, useRef, useState } from "react";

import { auth } from "../firebase";
import {
  completeDiagnosticRequest,
  createEmergencyIncident,
  endCloudSessionForSeat,
  endCurrentCloudSession,
  ensureVehicleForDriver,
  syncAccountDirectory,
  syncHardwareStatus,
  syncMonitoringSession,
  subscribeToDiagnosticRequests,
  type CloudSyncProfile,
} from "../services/admin-cloud-sync";
import { useSafeSeatHub } from "./safeseat-hub-context";
import { useSeatSessions } from "./seat-session-context";
import { useUserPreferences } from "./user-preferences-context";

const SEAT_ASSIGNMENTS_KEY = "seatAssignments";
const IS_LOCKED_IN_KEY = "isLockedIn";
const HARDWARE_SEAT_KEY = "safeSeatHardwareSeatNo";
const HEARTBEAT_MS = 10_000;

async function runCloudStep<T>(label: string, task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`${label}: ${detail}`);
  }
}

type AssignmentMap = Record<number, CloudSyncProfile>;

export function SafeSeatCloudSyncProvider({ children }: { children: ReactNode }) {
  const { preferences } = useUserPreferences();
  const {
    connected,
    telemetryReady,
    status,
    rawSeatState,
    simulationActive,
  } = useSafeSeatHub();
  const { activeSessions } = useSeatSessions();
  const [authUid, setAuthUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const [vehicleProvisioned, setVehicleProvisioned] = useState(false);
  const lastSignatureRef = useRef("");
  const lastWriteAtRef = useRef(0);
  const lastEmergencySessionRef = useRef<string | null>(null);
  const writeQueueRef = useRef<Promise<void>>(Promise.resolve());
  const latestHubRef = useRef({ connected, status });

  useEffect(() => {
    latestHubRef.current = { connected, status };
  }, [connected, status]);

  useEffect(() => onAuthStateChanged(auth, (user) => {
    setAuthUid(user?.uid ?? null);
    if (!user) setVehicleProvisioned(false);
  }), []);

  useEffect(() => {
    if (!authUid) return;
    const syncDirectory = () => {
      void syncAccountDirectory({
        consent: preferences.consent,
        behavioralMonitoring: preferences.behavioralMonitoring,
        physiologicalMonitoring: preferences.physiologicalMonitoring,
        emergencyEscalation: preferences.emergencyEscalation,
      }).catch((error) => {
        console.warn("SafeSeat account directory sync deferred:", error);
      });
    };

    syncDirectory();
    const timer = setInterval(syncDirectory, 60_000);
    return () => clearInterval(timer);
  }, [
    authUid,
    preferences.behavioralMonitoring,
    preferences.consent,
    preferences.emergencyEscalation,
    preferences.physiologicalMonitoring,
  ]);

  useEffect(() => {
    if (!authUid) return;

    const run = async () => {
      const [rawLocked, rawAssignments, rawHardwareSeat] = await Promise.all([
        AsyncStorage.getItem(IS_LOCKED_IN_KEY),
        AsyncStorage.getItem(SEAT_ASSIGNMENTS_KEY),
        AsyncStorage.getItem(HARDWARE_SEAT_KEY),
      ]);

      const locked = rawLocked ? Boolean(JSON.parse(rawLocked)) : false;
      const assignments: AssignmentMap = rawAssignments ? JSON.parse(rawAssignments) : {};
      const hardwareSeatNo = rawHardwareSeat ? Number(JSON.parse(rawHardwareSeat)) : null;
      const profile = hardwareSeatNo ? assignments[hardwareSeatNo] : undefined;

      if (!hardwareSeatNo || !profile) {
        await endCurrentCloudSession();
        lastSignatureRef.current = "";
        lastEmergencySessionRef.current = null;
        setVehicleProvisioned(false);
        return;
      }

      const rawFusion = String(status?.system?.fusion_state || "").toUpperCase();
      const signature = JSON.stringify({
        locked,
        hardwareSeatNo,
        profileId: profile.id,
        sessionId: activeSessions[hardwareSeatNo]?.id ?? null,
        connected,
        telemetryReady,
        rawFusion,
        cameraRequested: Boolean(status?.system?.camera_verification_requested || status?.camera?.verification_requested || status?.camera?.request_active),
        cameraAvailable: status?.camera?.available,
        c1001: [status?.sensors?.c1001?.connected, status?.sensors?.c1001?.health],
        mlx: [status?.sensors?.mlx90614?.connected, status?.sensors?.mlx90614?.health],
        fsr: [status?.sensors?.fsr?.connected, status?.sensors?.fsr?.health],
        mpu: [status?.sensors?.mpu6050?.connected, status?.sensors?.mpu6050?.health],
      });
      const now = Date.now();
      if (signature === lastSignatureRef.current && now - lastWriteAtRef.current < HEARTBEAT_MS) return;
      lastSignatureRef.current = signature;
      lastWriteAtRef.current = now;

      // Provision the privacy-safe directory record before vehicle creation.
      // Firestore intentionally requires an ACTIVE mobile directory record before
      // a signed-in driver may create/update the shared vehicle document. Doing
      // this explicitly avoids a first-launch race between the two sync effects.
      if (!vehicleProvisioned) {
        await runCloudStep("account directory provisioning", () => syncAccountDirectory({
          consent: preferences.consent,
          behavioralMonitoring: preferences.behavioralMonitoring,
          physiologicalMonitoring: preferences.physiologicalMonitoring,
          emergencyEscalation: preferences.emergencyEscalation,
        }));
      }

      // A configured SafeSeat vehicle remains visible to Admin even when no
      // occupant session is currently locked in. This also keeps high-level
      // hardware health and Admin diagnostic requests available between trips.
      await runCloudStep("vehicle provisioning", () => ensureVehicleForDriver(hardwareSeatNo));
      setVehicleProvisioned(true);
      await runCloudStep("hardware status sync", () => syncHardwareStatus(status, connected));

      const linkedSession = activeSessions[hardwareSeatNo];
      if (!locked || !linkedSession) {
        await endCloudSessionForSeat(hardwareSeatNo).catch(() => undefined);
        lastEmergencySessionRef.current = null;
        return;
      }

      await runCloudStep("monitoring session sync", () => syncMonitoringSession({ sessionId: linkedSession.id, seatNo: hardwareSeatNo, profile, status }));

      // Researcher-only simulations never generate cloud incidents. Only an
      // authoritative Main Hub emergency may create a retained Admin event.
      if (!simulationActive && rawSeatState === "emergency") {
        const sessionId = linkedSession.id;
        if (lastEmergencySessionRef.current !== sessionId) {
          await runCloudStep("emergency incident sync", () => createEmergencyIncident({ sessionId, seatNo: hardwareSeatNo, profile, status }));
          lastEmergencySessionRef.current = sessionId;
        }
      }
    };

    writeQueueRef.current = writeQueueRef.current
      .catch(() => undefined)
      .then(run)
      .catch((error) => {
        // Cloud visibility is supplementary. Local monitoring must keep working
        // when the phone is attached to the Main Hub's local-only Wi-Fi AP.
        console.warn("SafeSeat Admin cloud sync deferred — check the named sync step and Firestore rules:", error);
      });
  }, [
    activeSessions,
    authUid,
    connected,
    preferences.behavioralMonitoring,
    preferences.consent,
    preferences.emergencyEscalation,
    preferences.physiologicalMonitoring,
    rawSeatState,
    simulationActive,
    status,
    telemetryReady,
    vehicleProvisioned,
  ]);

  useEffect(() => {
    if (!authUid || !vehicleProvisioned) return;
    return subscribeToDiagnosticRequests((requestId) => {
      const latest = latestHubRef.current;
      void completeDiagnosticRequest(requestId, latest.status, latest.connected).catch((error) => {
        console.warn("SafeSeat diagnostic response deferred:", error);
      });
    });
  }, [authUid, vehicleProvisioned]);

  return children;
}
