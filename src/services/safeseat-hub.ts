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

export function getSafeSeatHubUrl(): string {
  const configured = process.env.EXPO_PUBLIC_SAFESEAT_HUB_URL?.trim();
  const value = configured && configured.length > 0 ? configured : DEFAULT_HUB_URL;
  return value.replace(/\/+$/, "");
}

async function fetchWithTimeout(url: string, timeoutMs = REQUEST_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchSafeSeatStatus(
  baseUrl = getSafeSeatHubUrl(),
): Promise<SafeSeatStatusPayload> {
  const response = await fetchWithTimeout(`${baseUrl}/api/v1/status`);

  if (!response.ok) {
    throw new Error(`SafeSeat Main Hub returned HTTP ${response.status}`);
  }

  const payload = (await response.json()) as SafeSeatStatusPayload;
  if (!payload || typeof payload !== "object") {
    throw new Error("SafeSeat Main Hub returned an invalid status payload");
  }

  return payload;
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
    return await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
      signal: controller.signal,
    });
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
  if (!statusResponse.ok) return false;

  const uat = (await statusResponse.json()) as SafeSeatUatInjectionStatus;
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
