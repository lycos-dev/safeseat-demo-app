import {
  fetchSafeSeatStatus,
  fusionStateToSeatState,
  getSafeSeatHubUrl,
  SafeSeatHubConnectionState,
  SafeSeatStatusPayload,
} from "@/services/safeseat-hub";
import { setAudioModeAsync, setIsAudioActiveAsync, useAudioPlayer } from "expo-audio";
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

  const warningPlayer = useAudioPlayer(
    require("../../assets/sounds/warning-chime.wav"),
    { downloadFirst: true, keepAudioSessionActive: true },
  );
  const emergencyPlayer = useAudioPlayer(
    require("../../assets/sounds/emergency-alert.wav"),
    { downloadFirst: true, keepAudioSessionActive: true },
  );

  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const mountedRef = useRef(true);
  const activeRequestRef = useRef<Promise<SafeSeatStatusPayload | null> | null>(null);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uatWarningDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveReadinessRef = useRef({ connected: false, telemetryReady: false });
  const warningAlertIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const emergencyAlertIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioModeConfiguredRef = useRef(false);

  const ensureAlertAudioReady = useCallback(async () => {
    // SafeSeat alert tones are short UI/safety cues, not background media.
    // mixWithOthers avoids requesting exclusive audio focus and is the most
    // reliable mode for these short sounds in Expo Go and standalone builds.
    if (!audioModeConfiguredRef.current) {
      await setAudioModeAsync({
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        interruptionMode: "mixWithOthers",
      });
      audioModeConfiguredRef.current = true;
    }

    // Expo can deactivate the native session after interruptions / reloads.
    // Explicitly reactivate it before each alert cue.
    await setIsAudioActiveAsync(true);
  }, []);

  useEffect(() => {
    void ensureAlertAudioReady().catch((error) => {
      audioModeConfiguredRef.current = false;
      console.warn("SafeSeat alert audio mode could not be configured:", error);
    });
  }, [ensureAlertAudioReady]);

  const replayWarningCue = useCallback(() => {
    void (async () => {
      try {
        await ensureAlertAudioReady();
        warningPlayer.volume = 1;
        warningPlayer.muted = false;
        if (warningPlayer.playing) warningPlayer.pause();
        await warningPlayer.seekTo(0);
        warningPlayer.play();
      } catch (error) {
        audioModeConfiguredRef.current = false;
        console.warn("SafeSeat warning chime could not play:", error);
      }
    })();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
  }, [ensureAlertAudioReady, warningPlayer]);

  const replayEmergencyCue = useCallback(() => {
    void (async () => {
      try {
        await ensureAlertAudioReady();
        emergencyPlayer.volume = 1;
        emergencyPlayer.muted = false;
        if (emergencyPlayer.playing) emergencyPlayer.pause();
        await emergencyPlayer.seekTo(0);
        emergencyPlayer.play();
      } catch (error) {
        audioModeConfiguredRef.current = false;
        console.warn("SafeSeat emergency chime could not play:", error);
      }
    })();
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
  }, [emergencyPlayer, ensureAlertAudioReady]);

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

    const startFeedback = () => {
      if (cancelled || appStateRef.current !== "active") return;

      // The driver-facing alert state is already what the user sees on screen.
      // Do not gate its sound on a second AsyncStorage read: on Android that
      // persisted flag can briefly lag the live session and suppress a real
      // WARNING/EMERGENCY cue even though the alert UI is already visible.
      if (driverFacingSeatState === "warning") {
        replayWarningCue();
        warningAlertIntervalRef.current = setInterval(replayWarningCue, WARNING_ALERT_INTERVAL_MS);
        return;
      }

      setEmergencyAlertAcknowledged(false);
      replayEmergencyCue();
      emergencyAlertIntervalRef.current = setInterval(replayEmergencyCue, EMERGENCY_ALERT_INTERVAL_MS);
    };

    startFeedback();
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
