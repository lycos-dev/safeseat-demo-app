import { useEffect, useMemo, useState } from "react";

import EmergencyModal from "@/components/emergency-modal";
import type { SeatVitals } from "@/components/seat-card";
import { useSafeSeatHub } from "@/hooks/safeseat-hub-context";
import { useSeatSessions } from "@/hooks/seat-session-context";

/**
 * App-wide Emergency presentation.
 *
 * This lives above the tab navigator so a Main Hub EMERGENCY is not tied to
 * the Home screen. The current hardware-linked monitoring session supplies the
 * occupant/seat identity used by the existing EmergencyModal.
 */
export default function GlobalEmergencyOverlay() {
  const {
    connected,
    telemetryReady,
    status,
    seatState,
    rawSeatState,
    emergencyAlertAcknowledged,
    acknowledgeEmergencyAlert,
  } = useSafeSeatHub();
  const { activeSessions } = useSeatSessions();
  const [dismissedForCurrentEmergency, setDismissedForCurrentEmergency] = useState(false);
  const [presentationReady, setPresentationReady] = useState(false);

  const emergencyActive = seatState === "emergency";

  useEffect(() => {
    // A dismissal applies only to the current continuous Emergency. Once the
    // Main Hub leaves EMERGENCY, the next independent event is allowed to show
    // the modal again.
    if (!emergencyActive) {
      setDismissedForCurrentEmergency(false);
      setPresentationReady(false);
      return;
    }

    // Give screen-local sheets (especially Live Readings) one render cycle to
    // dismiss before presenting the native Emergency modal. This avoids the
    // iOS/React Native multiple-Modal race that originally left EMERGENCY only
    // visible in the background.
    const timer = setTimeout(() => setPresentationReady(true), 120);
    return () => clearTimeout(timer);
  }, [emergencyActive]);

  const linkedSession = useMemo(() => {
    const sessions = Object.values(activeSessions);
    return sessions.find((session) => session.hardwareLinked) ?? sessions[0];
  }, [activeSessions]);

  const vitals = useMemo<SeatVitals>(() => {
    const c1001 = status?.sensors?.c1001;
    const qualityTrusted = Boolean(
      connected &&
      telemetryReady &&
      c1001?.connected &&
      !c1001?.stale &&
      c1001?.trusted_vitals
    );

    const heartRateBpm =
      qualityTrusted &&
      typeof c1001?.heart_rate_bpm === "number" &&
      Number.isFinite(c1001.heart_rate_bpm)
        ? Math.round(c1001.heart_rate_bpm)
        : null;

    const respirationRateBpm =
      qualityTrusted &&
      typeof c1001?.respiration_rate_bpm === "number" &&
      Number.isFinite(c1001.respiration_rate_bpm)
        ? Math.round(c1001.respiration_rate_bpm * 10) / 10
        : null;

    return {
      trusted: qualityTrusted && heartRateBpm !== null && respirationRateBpm !== null,
      heartRateBpm,
      respirationRateBpm,
      statusLabel: !c1001?.connected
        ? "UNAVAILABLE"
        : qualityTrusted
          ? "LIVE"
          : "REACQUIRING",
    };
  }, [connected, status?.sensors?.c1001, telemetryReady]);

  if (!emergencyActive || !presentationReady || dismissedForCurrentEmergency || !linkedSession) return null;

  const displayName = linkedSession.occupant.displayName === "Me"
    ? "You"
    : linkedSession.occupant.displayName || "Passenger";

  return (
    <EmergencyModal
      visible
      seat={linkedSession.seatNo}
      id={linkedSession.occupant.profileId}
      name={displayName}
      isAccountOwner={linkedSession.occupant.type === "account"}
      vitals={vitals}
      alertAcknowledged={emergencyAlertAcknowledged}
      onAcknowledgeAlert={acknowledgeEmergencyAlert}
      isRealEmergency={rawSeatState === "emergency"}
      onClose={() => setDismissedForCurrentEmergency(true)}
    />
  );
}
