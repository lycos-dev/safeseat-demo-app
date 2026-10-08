import { auth } from "../firebase";
import type { EmergencyLocation } from "./emergency-location";

const SMS_API_URL = process.env.EXPO_PUBLIC_SMS_API_URL ?? "";

export type SmsEscalationResult =
  | {
      ok: true;
      messageId?: string;
      sentTo?: string[];
      skipped?: string;
      smsStatus?: string;
    }
  | { ok: false; error: string };

/**
 * Request one emergency SMS cycle from the SafeSeat server.
 *
 * The client never submits recipient numbers and never holds the TextBee key.
 * The backend verifies the authenticated driver's active Firebase emergency,
 * loads that driver's registered Emergency Contacts, and applies server-side
 * duplicate protection for eventId.
 */
export async function sendEmergencySms(params: {
  seatNumber: number;
  sessionId: string;
  eventId: string;
  location: EmergencyLocation | null;
}): Promise<SmsEscalationResult> {
  if (!SMS_API_URL) {
    console.warn("SafeSeat SMS API URL is not configured");
    return { ok: false, error: "SMS API URL not configured" };
  }

  const currentUser = auth.currentUser;
  if (!currentUser) {
    return { ok: false, error: "No authenticated user" };
  }

  try {
    const idToken = await currentUser.getIdToken();
    const response = await fetch(SMS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        seatNumber: params.seatNumber,
        sessionId: params.sessionId,
        eventId: params.eventId,
        location: params.location,
        timestamp: new Date().toISOString(),
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      console.warn("SafeSeat SMS API error:", data);
      return { ok: false, error: data.error ?? "SMS API request failed" };
    }

    return {
      ok: true,
      messageId: data.messageId,
      sentTo: Array.isArray(data.sentTo) ? data.sentTo : undefined,
      skipped: data.skipped,
      smsStatus: data.smsStatus,
    };
  } catch (error) {
    console.error("SafeSeat SMS escalation failed:", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Network error",
    };
  }
}
