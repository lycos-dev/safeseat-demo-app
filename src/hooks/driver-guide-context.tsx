import AsyncStorage from "@react-native-async-storage/async-storage";
import { useUserPreferences } from "@/hooks/user-preferences-context";
import { auth } from "@/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { usePathname, useRouter } from "expo-router";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const IS_LOCKED_IN_KEY = "isLockedIn";
const GUIDE_KEY_PREFIX = "safeseat_driver_guide_completed";

export type DriverGuideStepId =
  | "welcome"
  | "dashboard"
  | "seats"
  | "assign"
  | "consent"
  | "sensor"
  | "start"
  | "alerts"
  | "complete";

export type DriverGuideStep = {
  id: DriverGuideStepId;
  eyebrow: string;
  title: string;
  body: string;
  actionHint?: string;
  placement: "top" | "center" | "bottom";
};

export const DRIVER_GUIDE_STEPS: Record<DriverGuideStepId, DriverGuideStep> = {
  welcome: {
    id: "welcome",
    eyebrow: "WELCOME TO SAFESEAT",
    title: "Set up your first trip with us",
    body: "This guide uses the real SafeSeat screens. You’ll tap the actual controls, assign a real seat, confirm consent when needed, and start monitoring when SafeSeat is ready.",
    placement: "center",
  },
  dashboard: {
    id: "dashboard",
    eyebrow: "STEP 1 · HOME",
    title: "Start from the cabin dashboard",
    body: "Home separates the Driver from passenger seats. All five seats stay visible. Only the linked seat receives live readings.",
    actionHint: "Tap the Seats tab below to continue.",
    placement: "top",
  },
  seats: {
    id: "seats",
    eyebrow: "STEP 2 · SEATS",
    title: "Choose a seat",
    body: "Tap the actual seat you want to set up on the car. SafeSeat will guide you based on what is already assigned there.",
    actionHint: "Tap a seat on the car to continue.",
    placement: "top",
  },
  assign: {
    id: "assign",
    eyebrow: "STEP 3 · ASSIGN PERSON",
    title: "Choose who is sitting there",
    body: "Select a real saved profile (or Guest for a passenger seat), then use the Assign button.",
    actionHint: "If the assignment sheet is closed, tap that seat again. The guide continues after you save the assignment.",
    placement: "top",
  },
  consent: {
    id: "consent",
    eyebrow: "STEP 4 · CONSENT",
    title: "Confirm passenger consent",
    body: "Passenger monitoring needs consent for this trip. The logged-in account owner in the Driver seat skips this extra step.",
    actionHint: "If the consent sheet is closed, tap that seat again. Then tap Confirm Consent.",
    placement: "top",
  },
  sensor: {
    id: "sensor",
    eyebrow: "STEP 5 · SAFESEAT SENSOR",
    title: "Link the monitored seat",
    body: "Tap the SafeSeat Sensor card, then choose which assigned seat has the SafeSeat hardware installed. If you assigned yourself as Driver, no extra consent is required; passenger seats will ask for consent when applicable.",
    actionHint: "Choose a seat from the sensor selector to continue.",
    placement: "top",
  },
  start: {
    id: "start",
    eyebrow: "STEP 6 · START",
    title: "Start monitoring when READY",
    body: "The button at the bottom only becomes available when the linked seat is assigned, consent is ready, and SafeSeat is online.",
    actionHint: "Tap Start Monitoring to continue.",
    placement: "top",
  },
  alerts: {
    id: "alerts",
    eyebrow: "STEP 7 · LIVE STATUS",
    title: "Check a seat’s live status",
    body: "Only the linked seat shows live safety readings. Other assigned seats show Not monitored, Consent needed, or Declined.",
    actionHint: "Tap the highlighted monitored seat on Home to view its details.",
    placement: "top",
  },
  complete: {
    id: "complete",
    eyebrow: "GUIDE COMPLETE",
    title: "You’re ready to use SafeSeat",
    body: "You just used the real trip flow: Seats → assignment → consent when needed → sensor link → Start Monitoring → live seat status.",
    placement: "center",
  },
};

type SeatTapOutcome = "assign" | "consent" | "sensor";

type DriverGuideContextValue = {
  active: boolean;
  step: DriverGuideStep | null;
  stepId: DriverGuideStepId | null;
  selectedSeatNo: number | null;
  isStep: (id: DriverGuideStepId) => boolean;
  startGuide: () => void;
  beginInteractiveGuide: () => void;
  exitGuide: () => Promise<void>;
  finishGuide: () => Promise<void>;
  recordTabOpened: (tab: "home" | "assign" | "everyone" | "settings") => void;
  recordSeatTapped: (seatNo: number, outcome: SeatTapOutcome) => void;
  recordAssignmentSaved: (seatNo: number, needsConsent: boolean) => void;
  recordConsentConfirmed: (seatNo: number) => void;
  recordSensorSelected: (seatNo: number, needsConsent?: boolean) => void;
  recordMonitoringStarted: () => void;
  recordLiveSeatOpened: (seatNo: number) => void;
};

const DriverGuideContext = createContext<DriverGuideContextValue | null>(null);

export function DriverGuideProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { prototypeIndicator } = useUserPreferences();
  const pathname = usePathname();
  const [uid, setUid] = useState<string | null>(auth.currentUser?.uid ?? null);
  const [stepId, setStepId] = useState<DriverGuideStepId | null>(null);
  const [selectedSeatNo, setSelectedSeatNo] = useState<number | null>(null);
  const [initialCheckDone, setInitialCheckDone] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setUid(user?.uid ?? null);
      if (!user) {
        setStepId(null);
        setSelectedSeatNo(null);
        setInitialCheckDone(false);
      }
    });
  }, []);

  const completionKey = useMemo(
    () => (uid ? `${GUIDE_KEY_PREFIX}:${uid}` : null),
    [uid],
  );

  useEffect(() => {
    if (!uid || !completionKey || initialCheckDone) return;

    let cancelled = false;
    void (async () => {
      try {
        const [completed, locked] = await Promise.all([
          AsyncStorage.getItem(completionKey),
          AsyncStorage.getItem(IS_LOCKED_IN_KEY),
        ]);
        if (cancelled) return;
        setInitialCheckDone(true);
        const monitoringActive = locked ? JSON.parse(locked) === true : false;
        if (completed !== "true" && !monitoringActive) {
          setStepId("welcome");
        }
      } catch (error) {
        console.error("Failed to load SafeSeat guide state:", error);
        if (!cancelled) setInitialCheckDone(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [completionKey, initialCheckDone, uid]);

  const active = stepId !== null;
  const step = useMemo(() => {
    if (!stepId) return null;
    const base = DRIVER_GUIDE_STEPS[stepId];
    if (stepId === "sensor") return {
      ...base,
      eyebrow: "STEP 5 · SENSOR SEAT",
      body: "Tap SafeSeat Sensor and choose the seat connected to the hardware.",
      actionHint: "Tap SafeSeat Sensor, then select its actual seat.",
    };
    if (stepId === "start" && !prototypeIndicator) return { ...base, eyebrow: "START MONITORING" };
    if (stepId === "complete" && !prototypeIndicator) return { ...base, body: "You assigned seats, confirmed consent when needed, and checked the live seat status." };
    return base;
  }, [stepId, prototypeIndicator]);

  // Hiding the selector must never leave the guide waiting for an invisible control.
  useEffect(() => {
    if (!prototypeIndicator && stepId === "sensor") setStepId("start");
  }, [prototypeIndicator, stepId]);

  // Any real navigation into Seats counts, whether it came from the bottom tab,
  // the Home "Choose Seats" action, or a swipe gesture.
  useEffect(() => {
    if (stepId === "dashboard" && pathname.includes("/assign")) {
      setStepId("seats");
    }
  }, [pathname, stepId]);

  const markComplete = useCallback(async () => {
    try {
      if (completionKey) await AsyncStorage.setItem(completionKey, "true");
    } catch (error) {
      console.error("Failed to save SafeSeat guide state:", error);
    } finally {
      setStepId(null);
      setSelectedSeatNo(null);
    }
  }, [completionKey]);

  const startGuide = useCallback(() => {
    setSelectedSeatNo(null);
    setStepId("welcome");
  }, []);

  const beginInteractiveGuide = useCallback(() => {
    setSelectedSeatNo(null);
    setStepId("dashboard");
    router.replace("/home" as any);
  }, [router]);

  const exitGuide = useCallback(async () => {
    await markComplete();
  }, [markComplete]);

  const finishGuide = useCallback(async () => {
    await markComplete();
  }, [markComplete]);

  const recordTabOpened = useCallback((tab: "home" | "assign" | "everyone" | "settings") => {
    if (stepId === "dashboard" && tab === "assign") {
      setStepId("seats");
    }
  }, [stepId]);

  const recordSeatTapped = useCallback((seatNo: number, outcome: SeatTapOutcome) => {
    if (stepId !== "seats") return;
    setSelectedSeatNo(seatNo);
    setStepId(outcome === "sensor" && !prototypeIndicator ? "start" : outcome);
  }, [stepId, prototypeIndicator]);

  const recordAssignmentSaved = useCallback((seatNo: number, needsConsent: boolean) => {
    if (stepId !== "assign") return;
    setSelectedSeatNo(seatNo);
    setStepId(needsConsent ? "consent" : prototypeIndicator ? "sensor" : "start");
  }, [stepId, prototypeIndicator]);

  const recordConsentConfirmed = useCallback((seatNo: number) => {
    if (stepId !== "consent") return;
    setSelectedSeatNo(seatNo);
    setStepId(prototypeIndicator ? "sensor" : "start");
  }, [stepId, prototypeIndicator]);

  const recordSensorSelected = useCallback((seatNo: number, needsConsent = false) => {
    if (stepId !== "sensor") return;
    setSelectedSeatNo(seatNo);
    setStepId(needsConsent ? "consent" : "start");
  }, [stepId]);

  const recordMonitoringStarted = useCallback(() => {
    if (stepId !== "start") return;
    setStepId("alerts");
  }, [stepId]);

  const recordLiveSeatOpened = useCallback((seatNo: number) => {
    if (stepId !== "alerts") return;
    setSelectedSeatNo(seatNo);
    setStepId("complete");
  }, [stepId]);

  const value = useMemo<DriverGuideContextValue>(() => ({
    active,
    step,
    stepId,
    selectedSeatNo,
    isStep: (id) => stepId === id,
    startGuide,
    beginInteractiveGuide,
    exitGuide,
    finishGuide,
    recordTabOpened,
    recordSeatTapped,
    recordAssignmentSaved,
    recordConsentConfirmed,
    recordSensorSelected,
    recordMonitoringStarted,
    recordLiveSeatOpened,
  }), [
    active,
    beginInteractiveGuide,
    exitGuide,
    finishGuide,
    recordAssignmentSaved,
    recordConsentConfirmed,
    recordLiveSeatOpened,
    recordMonitoringStarted,
    recordSeatTapped,
    recordSensorSelected,
    recordTabOpened,
    selectedSeatNo,
    startGuide,
    step,
    stepId,
  ]);

  return <DriverGuideContext.Provider value={value}>{children}</DriverGuideContext.Provider>;
}

export function useDriverGuide() {
  const value = useContext(DriverGuideContext);
  if (!value) throw new Error("useDriverGuide must be used inside DriverGuideProvider");
  return value;
}
