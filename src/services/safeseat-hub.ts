import { Platform } from "react-native";

export type SafeSeatFusionState = "SAFE" | "WARNING" | "EMERGENCY" | string;

export type SafeSeatModelEvidence = {
  available?: boolean;
  valid?: boolean;
  isolation_forest_anomaly?: boolean;
  one_class_svm_anomaly?: boolean;
  both_models_anomaly?: boolean;
  either_model_anomaly?: boolean;
  isolation_forest_score?: number | null;
  one_class_svm_score?: number | null;
  confidence?: number | null;
};

export type SafeSeatStatusPayload = {
  schema_version?: string;
  device?: string;
  telemetry_ready?: boolean;
  timestamp_ms?: number;
  uptime_ms?: number;
  system?: {
    fusion_authoritative?: boolean;
    fusion_valid?: boolean;
    fusion_state?: SafeSeatFusionState;
    confidence?: number | null;
    emergency_active?: boolean;
    camera_verification_requested?: boolean;
    alert_requested?: boolean;
    warning_candidate_ms?: number;
    strong_multisensor_candidate?: boolean;
    strong_multisensor_elapsed_ms?: number;
    emergency_persistence_required_ms?: number;
    monitoring_limited?: boolean;
    monitoring_limited_persistent?: boolean;
    monitoring_limited_ms?: number;
    camera_fusion_role?: string;
    occupancy?: string;
    motion_context?: string;
    vitals_state?: string;
    pressure_state?: string;
    temperature_state?: string;
    respiration_state?: string;
    evidence?: {
      valid_sensor_count?: number;
      unavailable_sensor_count?: number;
      anomaly_evidence_count?: number;
      strong_anomaly_evidence_count?: number;
      normal_evidence_count?: number;
      supporting_context_count?: number;
      motion_artifact_possible?: boolean;
      multi_sensor_agreement?: boolean;
    };
  };
  network?: {
    ap_running?: boolean;
    ssid?: string;
    ip?: string;
    channel?: number;
    connected_clients?: number;
    local_only?: boolean;
    internet_required?: boolean;
    esp_now_enabled?: boolean;
  };
  sensors?: {
    c1001?: {
      health?: string;
      connected?: boolean;
      stale?: boolean;
      packet_age_ms?: number;
      packets_received?: number;
      present?: boolean;
      status?: string;
      trusted_vitals?: boolean;
      heart_rate_bpm?: number | null;
      respiration_rate_bpm?: number | null;
      motion?: number;
      move_range?: number;
      motion_artifact_active?: boolean;
      model?: SafeSeatModelEvidence;
    };
    mlx90614?: {
      health?: string;
      connected?: boolean;
      valid?: boolean;
      object_temperature_c?: number | null;
      sensor_ta_c?: number | null;
      object_minus_ta_c?: number | null;
      native_mlx_model?: SafeSeatModelEvidence;
    };
    fsr?: {
      health?: string;
      connected?: boolean;
      calibrated?: boolean;
      occupied?: boolean;
      back_contact?: boolean;
      validation_posture?: {
        reference_ready?: boolean;
        pattern_active?: boolean;
        strong_vote?: boolean;
        candidate_ms?: number;
        posture?: "LEFT" | "RIGHT" | "FORWARD" | "NONE" | string;
        monitoring_limited?: boolean;
        monitoring_limited_persistent?: boolean;
        monitoring_limited_ms?: number;
      };
      sampling_rate_hz?: number | null;
      model?: SafeSeatModelEvidence;
    };
    mpu6050?: {
      health?: string;
      connected?: boolean;
      valid?: boolean;
      sampling_rate_hz?: number | null;
      road_motion_model?: SafeSeatModelEvidence;
    };
  };
  camera?: {
    available?: boolean;
    connected?: boolean;
    transport_connected?: boolean;
    stale?: boolean;
    camera_ready?: boolean;
    model_ready?: boolean;
    psram_ready?: boolean;
    busy?: boolean;
    session_active?: boolean;
    local_session_active?: boolean;
    baseline_ready?: boolean;
    calibrating?: boolean;
    calibration_count?: number;
    calibration_target?: number;
    packet_age_ms?: number;
    verification_requested?: boolean;
    user_verification_state?: "IDLE" | "IN_PROGRESS" | "COMPLETED" | string;
    user_verification_message?: string;
    fusion_role?: string;
    request_active?: boolean;
    result_valid?: boolean;
    posture?: string;
    posture_normal?: boolean;
    posture_abnormal?: boolean;
    confidence?: number | null;
    verification_only?: boolean;
  };
};

export type SafeSeatHubConnectionState =
  | "idle"
  | "connecting"
  | "connected"
  | "unavailable";

const DEFAULT_HUB_URL = "http://192.168.4.1";
const REQUEST_TIMEOUT_MS = 1800;
const WEB_LOCAL_PROMPT_TIMEOUT_MS = 20_000;
const WEB_LOCAL_FALLBACK_TIMEOUT_MS = 5_000;

export type SafeSeatLocalNetworkPermissionState =
  | "granted"
  | "prompt"
  | "denied"
  | "unsupported"
  | "not-web";

type SafeSeatRequestInit = RequestInit & {
  targetAddressSpace?: "local" | "loopback" | "public";
};

export function getSafeSeatHubUrl(): string {
  const configured = process.env.EXPO_PUBLIC_SAFESEAT_HUB_URL?.trim();
  const value = configured && configured.length > 0 ? configured : DEFAULT_HUB_URL;
  return value.replace(/\/+$/, "");
}

function isWebRuntime(): boolean {
  return Platform.OS === "web" && typeof window !== "undefined" && typeof navigator !== "undefined";
}

function isPrivateLocalAddress(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === "localhost" || host.endsWith(".local")) return true;
    if (/^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host)) return true;

    const match = host.match(/^172\.(\d{1,3})\./);
    if (match) {
      const second = Number(match[1]);
      if (second >= 16 && second <= 31) return true;
    }
  } catch {
    return false;
  }
  return false;
}

export async function getSafeSeatLocalNetworkPermissionState(): Promise<SafeSeatLocalNetworkPermissionState> {
  if (!isWebRuntime()) return "not-web";

  const permissions = (navigator as Navigator & {
    permissions?: { query?: (descriptor: unknown) => Promise<{ state?: string }> };
  }).permissions;

  if (!permissions?.query) return "unsupported";

  for (const name of ["local-network", "local-network-access"]) {
    try {
      const result = await permissions.query({ name });
      const state = String(result?.state ?? "").toLowerCase();
      if (state === "granted" || state === "prompt" || state === "denied") {
        return state;
      }
    } catch {
      // Older Safari/Chromium builds do not recognize these permission names.
    }
  }

  return "unsupported";
}

function webLocalRequestInit(url: string, init: RequestInit): SafeSeatRequestInit {
  if (!isWebRuntime() || !isPrivateLocalAddress(url)) return init;

  return {
    ...init,
    mode: "cors",
    // Newer browsers use this to classify the ESP32 as a local-network target
    // and can show a Local Network permission prompt on an HTTPS deployment.
    // Older browsers safely ignore unknown dictionary members.
    targetAddressSpace: "local",
  };
}

function webLocalAccessError(url: string): Error {
  const fallback = `${getSafeSeatHubUrl()}/validation`;
  return new Error(
    `The browser could not reach the SafeSeat Main Hub at ${url}. ` +
      `Stay connected to the SafeSeat Wi-Fi and allow Local Network access for this site. ` +
      `If this browser does not support local-network access from HTTPS, open ${fallback} directly.`,
  );
}

// Informational diagnostics, throttled per endpoint. A powered-off or
// unreachable hub is a normal offline state, not an Expo LogBox warning.
// Never log sensor values,
// occupant/contact data, request bodies, or credentials.
const requestFailures = new Map<string, { message: string; loggedAt: number }>();
export function logSafeSeatHubFailure(method: string, url: string, error: unknown): void {
  let endpoint = "Main Hub";
  try { const parsed = new URL(url); endpoint = `${parsed.origin}${parsed.pathname}`; } catch {}
  const message = error instanceof Error ? `${error.name}: ${error.message}` : "Unknown request error";
  const key = `${method} ${endpoint}`;
  const previous = requestFailures.get(key);
  const now = Date.now();
  if (!previous || previous.message !== message || now - previous.loggedAt >= 30_000) {
    console.info(`[SafeSeat/Hub] ${key} failed: ${message}`);
    requestFailures.set(key, { message, loggedAt: now });
  }
}

function logHubRecovery(method: string, url: string): void {
  const parsed = new URL(url);
  const key = `${method} ${parsed.origin}${parsed.pathname}`;
  if (requestFailures.delete(key)) console.info(`[SafeSeat/Hub] ${key} recovered`);
}

function normalizeRequestError(error: unknown, signal: AbortSignal): unknown {
  // Android fetch may report an aborted request as a generic Error with
  // "Fetch request has been canceled", rather than an AbortError.
  // Only our own timeout aborts these controllers; do not relabel other errors.
  if (!signal.aborted) return error;
  const timeoutError = new Error("Main Hub request timed out");
  timeoutError.name = "AbortError";
  return timeoutError;
}

async function fetchWithTimeout(url: string, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const localWebRequest = isWebRuntime() && isPrivateLocalAddress(url);
  const permission = localWebRequest
    ? await getSafeSeatLocalNetworkPermissionState()
    : "not-web";

  if (permission === "denied") {
    throw webLocalAccessError(url);
  }

  const effectiveTimeout = permission === "prompt"
    ? Math.max(timeoutMs, WEB_LOCAL_PROMPT_TIMEOUT_MS)
    : localWebRequest && permission === "unsupported"
      ? Math.max(timeoutMs, WEB_LOCAL_FALLBACK_TIMEOUT_MS)
      : timeoutMs;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), effectiveTimeout);

  try {
    return await fetch(
      url,
      webLocalRequestInit(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
        signal: controller.signal,
      }),
    );
  } catch (error) {
    const requestError = normalizeRequestError(error, controller.signal);
    logSafeSeatHubFailure("GET", url, requestError);
    if (localWebRequest && !(requestError instanceof Error && requestError.name === "AbortError")) {
      throw webLocalAccessError(url);
    }
    throw requestError;
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchSafeSeatStatus(
  baseUrl = getSafeSeatHubUrl(),
): Promise<SafeSeatStatusPayload> {
  const url = `${baseUrl}/api/v1/status`;
  try {
    const response = await fetchWithTimeout(url);
    if (!response.ok) throw new Error(`SafeSeat Main Hub returned HTTP ${response.status}`);
    const payload = (await response.json()) as SafeSeatStatusPayload;
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("SafeSeat Main Hub returned an invalid status payload");
    }
    logHubRecovery("GET", url);
    return payload;
  } catch (error) {
    logSafeSeatHubFailure("GET", url, error);
    throw error;
  }
}

export type SafeSeatControlledCameraMode = "upright" | "non_upright" | "real";

type SafeSeatUatInjectionStatus = {
  ok?: boolean;
  active?: boolean;
  camera?: {
    mode?: string;
  };
};

async function postFormWithTimeout(
  url: string,
  fields: Record<string, string>,
  timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const body = Object.entries(fields)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");

  try {
    const response = await fetch(
      url,
      webLocalRequestInit(url, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
        signal: controller.signal,
      }),
    );
    if (!response.ok) logSafeSeatHubFailure("POST", url, new Error(`HTTP ${response.status}`));
    else logHubRecovery("POST", url);
    return response;
  } catch (error) {
    const requestError = normalizeRequestError(error, controller.signal);
    logSafeSeatHubFailure("POST", url, requestError);
    throw requestError;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Research/UAT-only camera corroboration control.
 *
 * This deliberately refuses to arm UAT by itself. The hidden app tap zones
 * only work when Controlled UAT Mode is already active on the Main Hub.
 * Nothing in the passenger UI reveals that the zones exist.
 */
export async function setSafeSeatControlledCameraMode(
  mode: SafeSeatControlledCameraMode,
  baseUrl = getSafeSeatHubUrl(),
): Promise<boolean> {
  const statusResponse = await fetchWithTimeout(`${baseUrl}/api/v1/uat/injection`);
  if (!statusResponse.ok) {
    logSafeSeatHubFailure("GET", `${baseUrl}/api/v1/uat/injection`, new Error(`HTTP ${statusResponse.status}`));
    return false;
  }

  let uat: SafeSeatUatInjectionStatus;
  try {
    uat = (await statusResponse.json()) as SafeSeatUatInjectionStatus;
  } catch (error) {
    logSafeSeatHubFailure("GET", `${baseUrl}/api/v1/uat/injection`, error);
    throw error;
  }
  if (!uat?.active) return false;

  const response = await postFormWithTimeout(
    `${baseUrl}/api/v1/uat/injection/update`,
    { camera_mode: mode },
  );
  return response.ok;
}

export function fusionStateToSeatState(
  status: SafeSeatStatusPayload | null | undefined,
): "safe" | "warning" | "emergency" | "unknown" {
  if (!status?.telemetry_ready || !status.system?.fusion_valid) return "unknown";

  const raw = String(status.system.fusion_state ?? "").trim().toUpperCase();
  if (raw === "SAFE" || raw === "NORMAL") return "safe";
  if (raw === "WARNING" || raw.includes("WARN")) return "warning";
  if (raw === "EMERGENCY" || raw.includes("EMERG")) return "emergency";
  return "unknown";
}

export function sensorHealthLabel(
  connected: boolean | undefined,
  health: string | undefined,
  extraReady = true,
): { label: string; level: "ready" | "attention" | "offline" } {
  if (!connected) return { label: "Not detected", level: "offline" };

  const normalized = String(health ?? "").toUpperCase();
  if (!extraReady || normalized === "DEGRADED" || normalized === "WARMING_UP") {
    return {
      label: normalized === "WARMING_UP" ? "Warming up" : "Needs attention",
      level: "attention",
    };
  }

  if (normalized === "UNAVAILABLE") return { label: "Unavailable", level: "offline" };
  return { label: "Operational", level: "ready" };
}
