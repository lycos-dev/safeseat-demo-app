import { useEffect, useMemo, useRef, useState } from "react";

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
    simulationState,
    setSimulationState,
  } = useSafeSeatHub();
  const { activeSessions } = useSeatSessions();
  const [dismissedForCurrentEmergency, setDismissedForCurrentEmergency] = useState(false);
  const [presentationReady, setPresentationReady] = useState(false);
  const redisplayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emergencyActive = seatState === "emergency";

  useEffect(() => {
    // A dismissal applies only to the current continuous Emergency. Once the
    // Main Hub leaves EMERGENCY, the next independent event is allowed to show
    // the modal again.
    if (!emergencyActive) {
      if (redisplayTimerRef.current) {
        clearTimeout(redisplayTimerRef.current);
        redisplayTimerRef.current = null;
      }
      setDismissedForCurrentEmergency(false);
      setPresentationReady(false);
      return;
    }

    // Native iOS modal dismissal animations take longer than a single React
    // render. Waiting ~0.4s after screen-local sheets close avoids the
    // "attempt to present while another modal is dismissing" race.
    const timer = setTimeout(() => setPresentationReady(true), 420);
    return () => clearTimeout(timer);
  }, [emergencyActive]);

  useEffect(() => () => {
    if (redisplayTimerRef.current) clearTimeout(redisplayTimerRef.current);
  }, []);

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

  const handleClose = () => {
    // For a researcher-only Emergency, cancelling the modal also stops the
    // local simulation so it cannot remain latched behind the UI.
    if (simulationState === "emergency" && rawSeatState !== "emergency") {
      setSimulationState("off");
      return;
    }

    // A real hardware Emergency cannot be cleared by the phone. Let the user
    // dismiss the sheet briefly after verification, but bring it back if the
    // Main Hub still reports EMERGENCY. This prevents a stale dismissal from
    // making later emergency presentation appear broken.
    setDismissedForCurrentEmergency(true);
    if (redisplayTimerRef.current) clearTimeout(redisplayTimerRef.current);
    redisplayTimerRef.current = setTimeout(() => {
      redisplayTimerRef.current = null;
      setDismissedForCurrentEmergency(false);
    }, 2500);
  };

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
      onClose={handleClose}
    />
  );
}
