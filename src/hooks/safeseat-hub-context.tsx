import {
  fetchSafeSeatStatus,
  fusionStateToSeatState,
  getSafeSeatHubUrl,
  SafeSeatHubConnectionState,
  SafeSeatStatusPayload,
} from "@/services/safeseat-hub";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAudioModeAsync, useAudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import {
  AppState,
  AppStateStatus,
} from "react-native";
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

export type SafeSeatSeatState = "safe" | "warning" | "emergency" | "monitoring" | "unknown";
export type SafeSeatDecisiveState = "safe" | "warning" | "emergency";
export type SafeSeatSimulationState = "off" | SafeSeatSeatState;

type SafeSeatHubContextValue = {
  hubUrl: string;
  connectionState: SafeSeatHubConnectionState;
  connected: boolean;
  telemetryReady: boolean;
  status: SafeSeatStatusPayload | null;

  // rawSeatState mirrors the Main Hub exactly. WATCH/insufficient evidence maps
  // to "unknown" here.
  rawSeatState: SafeSeatSeatState;

  // seatState is the driver-facing state.
  // Routine WATCH while otherwise SAFE stays visually SAFE. After a real
  // WARNING/EMERGENCY, WATCH is surfaced as MONITORING until Fusion returns SAFE.
  seatState: SafeSeatSeatState;
  lastDecisiveSeatState: SafeSeatDecisiveState | null;
  resetDecisionLatch: () => void;

  // Local-only UAT visualization. This never sends a command to the Main Hub.
  simulationState: SafeSeatSimulationState;
  simulationActive: boolean;
  setSimulationState: (state: SafeSeatSimulationState) => void;
  armUatWarning: (delayMs: number) => void;
  cancelUatWarning: () => void;

  // App-side alert feedback. Emergency acknowledgement silences the repeating
  // cue only; it never clears or downgrades the Fusion state.
  emergencyAlertAcknowledged: boolean;
  acknowledgeEmergencyAlert: () => void;
  silenceAlertFeedback: () => void;

  lastUpdatedAt: number | null;
  lastError: string | null;
  refresh: () => Promise<SafeSeatStatusPayload | null>;
};

const SafeSeatHubContext = createContext<SafeSeatHubContextValue | undefined>(undefined);

const CONNECTED_POLL_MS = 1000;
const DISCONNECTED_POLL_MS = 3000;
const IS_LOCKED_IN_KEY = "isLockedIn";
const WARNING_ALERT_INTERVAL_MS = 3_000;
const EMERGENCY_ALERT_INTERVAL_MS = 4_000;

function getErrorText(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AbortError") return "Main Hub request timed out";
    return error.message;
  }
  return "Main Hub unavailable";
}

export function SafeSeatHubProvider({ children }: { children: ReactNode }) {
  const hubUrl = useMemo(() => getSafeSeatHubUrl(), []);
  const [connectionState, setConnectionState] = useState<SafeSeatHubConnectionState>("idle");
  const [status, setStatus] = useState<SafeSeatStatusPayload | null>(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastDecisiveSeatState, setLastDecisiveSeatState] = useState<SafeSeatDecisiveState | null>(null);
  const [recoveringAfterAlert, setRecoveringAfterAlert] = useState(false);
  const [simulationState, setSimulationStateValue] = useState<SafeSeatSimulationState>("off");
  const [emergencyAlertAcknowledged, setEmergencyAlertAcknowledged] = useState(false);

  const warningPlayer = useAudioPlayer(require("../../assets/sounds/warning-chime.wav"));
  const emergencyPlayer = useAudioPlayer(require("../../assets/sounds/emergency-alert.wav"));

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const mountedRef = useRef(true);
  const activeRequestRef = useRef<Promise<SafeSeatStatusPayload | null> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uatWarningDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveReadinessRef = useRef({ connected: false, telemetryReady: false });
  const warningAlertIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const emergencyAlertIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    void setAudioModeAsync({
      playsInSilentMode: true,
      interruptionMode: "duckOthers",
    }).catch((error) => {
      console.warn("SafeSeat alert audio mode could not be configured:", error);
    });
  }, []);

  const replayWarningCue = useCallback(() => {
    try {
      warningPlayer.seekTo(0);
      warningPlayer.play();
    } catch (error) {
      console.warn("SafeSeat warning chime could not play:", error);
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
  }, [warningPlayer]);

  const replayEmergencyCue = useCallback(() => {
    try {
      emergencyPlayer.volume = 1;
      emergencyPlayer.seekTo(0);
      emergencyPlayer.play();
    } catch (error) {
      console.warn("SafeSeat emergency chime could not play:", error);
    }
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
  }, [emergencyPlayer]);

  const clearAlertFeedbackTimers = useCallback(() => {
    if (warningAlertIntervalRef.current) {
      clearInterval(warningAlertIntervalRef.current);
      warningAlertIntervalRef.current = null;
    }
    if (emergencyAlertIntervalRef.current) {
      clearInterval(emergencyAlertIntervalRef.current);
      emergencyAlertIntervalRef.current = null;
    }
  }, []);

  const silenceAlertFeedback = useCallback(() => {
    clearAlertFeedbackTimers();
    try { warningPlayer.pause(); } catch {}
    try { emergencyPlayer.pause(); } catch {}
  }, [clearAlertFeedbackTimers, emergencyPlayer, warningPlayer]);

  const acknowledgeEmergencyAlert = useCallback(() => {
    setEmergencyAlertAcknowledged(true);
    if (emergencyAlertIntervalRef.current) {
      clearInterval(emergencyAlertIntervalRef.current);
      emergencyAlertIntervalRef.current = null;
    }
    try { emergencyPlayer.pause(); } catch {}
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);
  }, [emergencyPlayer]);

  const refresh = useCallback((): Promise<SafeSeatStatusPayload | null> => {
    if (activeRequestRef.current) return activeRequestRef.current;

    const request = (async () => {
      setConnectionState((current) => (current === "idle" ? "connecting" : current));

      try {
        const payload = await fetchSafeSeatStatus(hubUrl);
        if (!mountedRef.current) return payload;

        setStatus(payload);
        setLastUpdatedAt(Date.now());
        setLastError(null);
        setConnectionState("connected");
        return payload;
      } catch (error) {
        if (!mountedRef.current) return null;

        // A missing SafeSeat AP is an expected state while the phone is on a
        // normal Wi-Fi network. Keep this controlled and user-facing instead of
        // emitting repeated red-screen/Metro fetch errors.
        setConnectionState("unavailable");
        setLastError(getErrorText(error));
        return null;
      }
    })();

    activeRequestRef.current = request;
    void request.finally(() => {
      if (activeRequestRef.current === request) activeRequestRef.current = null;
    });
    return request;
  }, [hubUrl]);

  useEffect(() => {
    mountedRef.current = true;

    const clearTimer = () => {
      if (pollTimerRef.current) {
        clearTimeout(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };

    const scheduleNext = (delay: number) => {
      clearTimer();
      pollTimerRef.current = setTimeout(async () => {
        if (appStateRef.current !== "active") {
          scheduleNext(DISCONNECTED_POLL_MS);
          return;
        }

        const result = await refresh();
        scheduleNext(result ? CONNECTED_POLL_MS : DISCONNECTED_POLL_MS);
      }, delay);
    };

    const subscription = AppState.addEventListener("change", (nextState) => {
      appStateRef.current = nextState;
      if (nextState === "active") {
        void refresh();
        scheduleNext(CONNECTED_POLL_MS);
      } else {
        clearTimer();
      }
    });

    void refresh().then((result) => {
      scheduleNext(result ? CONNECTED_POLL_MS : DISCONNECTED_POLL_MS);
    });

    return () => {
      mountedRef.current = false;
      clearTimer();
      subscription.remove();
    };
  }, [refresh]);

  const connected = connectionState === "connected";
  const rawSeatState = useMemo<SafeSeatSeatState>(
    () => (connected ? fusionStateToSeatState(status) : "unknown"),
    [connected, status],
  );

  useEffect(() => {
    // Only real Main Hub decisive results update the remembered state.
    // Routine WATCH remains visually SAFE. Once an actual alert has happened,
    // WATCH becomes a short MONITORING/RECOVERY phase instead of latching the
    // previous WARNING/EMERGENCY on screen.
    if (rawSeatState === "safe") {
      setLastDecisiveSeatState("safe");
      setRecoveringAfterAlert(false);
    } else if (rawSeatState === "warning" || rawSeatState === "emergency") {
      setLastDecisiveSeatState(rawSeatState);
      setRecoveringAfterAlert(true);
    }
  }, [rawSeatState]);

  useEffect(() => {
    liveReadinessRef.current = {
      connected,
      telemetryReady: Boolean(connected && status?.telemetry_ready),
    };
  }, [connected, status?.telemetry_ready]);

  const clearUatWarningTimers = useCallback(() => {
    if (uatWarningDelayRef.current) {
      clearTimeout(uatWarningDelayRef.current);
      uatWarningDelayRef.current = null;
    }
  }, []);

  const cancelUatWarning = useCallback(() => {
    clearUatWarningTimers();
    setSimulationStateValue("off");
  }, [clearUatWarningTimers]);

  const armUatWarning = useCallback((delayMs: number) => {
    clearUatWarningTimers();
    setSimulationStateValue("off");

    const tryTrigger = () => {
      const readiness = liveReadinessRef.current;
      if (!readiness.connected || !readiness.telemetryReady) {
        uatWarningDelayRef.current = setTimeout(tryTrigger, 2000);
        return;
      }

      // UAT warnings intentionally persist until the researcher explicitly
      // stops them. A real Main Hub emergency still takes priority in the
      // driver-facing state below.
      setSimulationStateValue("warning");
    };

    uatWarningDelayRef.current = setTimeout(tryTrigger, Math.max(0, delayMs));
  }, [clearUatWarningTimers]);

  useEffect(() => () => clearUatWarningTimers(), [clearUatWarningTimers]);

  const resetDecisionLatch = useCallback(() => {
    setLastDecisiveSeatState(null);
    setRecoveringAfterAlert(false);
  }, []);

  const setSimulationState = useCallback((next: SafeSeatSimulationState) => {
    setSimulationStateValue(next);
  }, []);

  const simulationActive = simulationState !== "off";

  const driverFacingSeatState = useMemo<SafeSeatSeatState>(() => {
    // Hidden UAT simulation must never mask a real Main Hub EMERGENCY.
    if (rawSeatState === "emergency") return "emergency";
    if (simulationState !== "off") return simulationState;

    if (rawSeatState === "safe" || rawSeatState === "warning") {
      return rawSeatState;
    }

    // Fusion WATCH/insufficient-evidence is represented as raw "unknown".
    // Before any alert, keep the calm SAFE presentation. After a genuine
    // WARNING/EMERGENCY, show a temporary MONITORING recovery state instead of
    // pinning the old alert until SAFE finally returns.
    if (recoveringAfterAlert) return "monitoring";
    if (lastDecisiveSeatState === "safe") return "safe";
    return "unknown";
  }, [lastDecisiveSeatState, rawSeatState, recoveringAfterAlert, simulationState]);

  useEffect(() => {
    let cancelled = false;
    clearAlertFeedbackTimers();

    if (driverFacingSeatState !== "emergency") {
      setEmergencyAlertAcknowledged(false);
    }

    if (driverFacingSeatState !== "warning" && driverFacingSeatState !== "emergency") {
      return () => { cancelled = true; clearAlertFeedbackTimers(); };
    }

    const startFeedback = async () => {
      try {
        const rawLocked = await AsyncStorage.getItem(IS_LOCKED_IN_KEY);
        const monitoringActive = rawLocked ? Boolean(JSON.parse(rawLocked)) : false;
        if (cancelled || !monitoringActive) return;

        if (driverFacingSeatState === "warning") {
          replayWarningCue();
          warningAlertIntervalRef.current = setInterval(replayWarningCue, WARNING_ALERT_INTERVAL_MS);

          // WARNING feedback is state-driven: keep replaying the existing
          // beep-beep cue at the same interval for as long as WARNING remains
          // active. The cleanup below stops it immediately when the state clears.
          return;
        }

        setEmergencyAlertAcknowledged(false);
        replayEmergencyCue();
        emergencyAlertIntervalRef.current = setInterval(replayEmergencyCue, EMERGENCY_ALERT_INTERVAL_MS);
      } catch (error) {
        console.warn("SafeSeat alert feedback could not verify session state:", error);
      }
    };

    void startFeedback();
    return () => {
      cancelled = true;
      clearAlertFeedbackTimers();
    };
  }, [clearAlertFeedbackTimers, driverFacingSeatState, replayEmergencyCue, replayWarningCue, simulationState]);

  useEffect(() => () => silenceAlertFeedback(), [silenceAlertFeedback]);

  const value = useMemo<SafeSeatHubContextValue>(() => ({
    hubUrl,
    connectionState,
    connected,
    telemetryReady: Boolean(connected && status?.telemetry_ready),
    status,
    rawSeatState,
    seatState: driverFacingSeatState,
    lastDecisiveSeatState,
    resetDecisionLatch,
    simulationState,
    simulationActive,
    setSimulationState,
    armUatWarning,
    cancelUatWarning,
    emergencyAlertAcknowledged,
    acknowledgeEmergencyAlert,
    silenceAlertFeedback,
    lastUpdatedAt,
    lastError,
    refresh,
  }), [
    acknowledgeEmergencyAlert,
    armUatWarning,
    cancelUatWarning,
    connected,
    connectionState,
    emergencyAlertAcknowledged,
    driverFacingSeatState,
    hubUrl,
    lastDecisiveSeatState,
    lastError,
    lastUpdatedAt,
    rawSeatState,
    refresh,
    resetDecisionLatch,
    setSimulationState,
    silenceAlertFeedback,
    simulationActive,
    simulationState,
    status,
  ]);

  return <SafeSeatHubContext.Provider value={value}>{children}</SafeSeatHubContext.Provider>;
}

export function useSafeSeatHub(): SafeSeatHubContextValue {
  const context = useContext(SafeSeatHubContext);
  if (!context) {
    throw new Error("useSafeSeatHub must be used within SafeSeatHubProvider");
  }
  return context;
}
