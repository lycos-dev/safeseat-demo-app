import type { VercelRequest, VercelResponse } from "@vercel/node";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

// ---------------------------------------------------------------------------
// Firebase Admin initialization
// ---------------------------------------------------------------------------
function initFirebaseAdmin() {
  if (getApps().length > 0) return;

  const serviceAccountRaw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!serviceAccountRaw) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT environment variable is missing");
  }

  const serviceAccount = JSON.parse(serviceAccountRaw);
  initializeApp({ credential: cert(serviceAccount) });
}

// ---------------------------------------------------------------------------
// CORS
// ---------------------------------------------------------------------------
const ALLOWED_ORIGINS = [
  "https://safeseat-app.vercel.app",
  "http://localhost:8081",
  "http://localhost:19006",
];

function setCorsHeaders(req: VercelRequest, res: VercelResponse) {
  const origin = req.headers.origin ?? "";
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Max-Age", "86400");
}

// ---------------------------------------------------------------------------
// Validation / normalization
// ---------------------------------------------------------------------------
function normalizePhilippineMobileNumber(rawPhone: unknown): string | null {
  if (typeof rawPhone !== "string") return null;
  const trimmed = rawPhone.trim();
  if (!trimmed || !/^[+()\d\s.-]+$/.test(trimmed)) return null;

  let digits = trimmed.replace(/\D/g, "");
  if (/^09\d{9}$/.test(digits)) digits = `63${digits.slice(1)}`;
  else if (/^9\d{9}$/.test(digits)) digits = `63${digits}`;

  if (!/^639\d{9}$/.test(digits)) return null;
  return `+${digits}`;
}

type ValidLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp?: string;
};

function parseLocation(raw: unknown): ValidLocation | null {
  if (!raw || typeof raw !== "object") return null;
  const value = raw as Record<string, unknown>;
  const latitude = Number(value.latitude);
  const longitude = Number(value.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;

  const accuracy = Number(value.accuracy);
  const timestamp = typeof value.timestamp === "string" ? value.timestamp : undefined;
  return {
    latitude,
    longitude,
    ...(Number.isFinite(accuracy) && accuracy >= 0 ? { accuracy } : {}),
    ...(timestamp ? { timestamp } : {}),
  };
}

function validEventId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9:_-]{8,180}$/.test(value);
}

function validSessionId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9:_-]{6,180}$/.test(value);
}

// ---------------------------------------------------------------------------
// Exact SafeSeat Emergency message
// ---------------------------------------------------------------------------
function buildSmsBody(driverName: string, location: ValidLocation | null): string {
  const name = driverName.trim() || "the driver";
  if (location) {
    return `SafeSeat Emergency Alert: Possible emergency involving ${name}. Check on them now. GPS: ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}. Paste coordinates into Maps.`;
  }
  return `SafeSeat Emergency Alert: Possible emergency involving ${name}. Check on them now. Current GPS location is unavailable.`;
}

// ---------------------------------------------------------------------------
// TextBee sending. API key/device details are server-side only.
// ---------------------------------------------------------------------------
async function sendTextBeeSms(
  recipients: string[],
  message: string,
): Promise<{ messageId: string }> {
  const apiKey = process.env.TEXTBEE_API_KEY;
  if (!apiKey) throw new Error("TEXTBEE_API_KEY environment variable is missing");

  const deviceId = process.env.TEXTBEE_DEVICE_ID?.trim();
  const response = await fetch("https://api.textbee.dev/api/v1/gateway/send-sms", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      recipients,
      message,
      ...(deviceId ? { deviceId } : {}),
    }),
  });

  const bodyText = await response.text();
  let data: any = {};
  try {
    data = bodyText ? JSON.parse(bodyText) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(`TextBee API error ${response.status}`);
  }

  const messageId =
    data?.smsBatchId ??
    data?.data?.smsBatchId ??
    data?.id ??
    data?.data?._id ??
    "accepted";

  return { messageId: String(messageId) };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------
export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
): Promise<void> {
  setCorsHeaders(req, res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const testMode = process.env.TEST_MODE === "true";

  try {
    initFirebaseAdmin();

    // 1) Authenticated SafeSeat user only.
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) {
      res.status(401).json({ error: "Missing or invalid authorization header" });
      return;
    }

    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(authHeader.slice(7));
    } catch {
      res.status(401).json({ error: "Invalid or expired auth token" });
      return;
    }
    const uid = decodedToken.uid;

    // 2) Client supplies event/session identity + phone GPS only. It never
    // supplies recipient numbers or the driver's authoritative display name.
    const { seatNumber, sessionId, eventId, location } = req.body as {
      seatNumber?: number;
      sessionId?: string;
      eventId?: string;
      location?: unknown;
      timestamp?: string;
    };

    if (seatNumber !== 1) {
      res.status(400).json({ error: "SMS escalation is only available for the driver seat" });
      return;
    }
    if (!validSessionId(sessionId) || !validEventId(eventId)) {
      res.status(400).json({ error: "Missing or invalid Emergency event/session identity" });
      return;
    }

    const db = getFirestore();

    // 3) Server-side Emergency verification. Do not trust the mobile client to
    // declare an arbitrary event as an Emergency.
    const sessionRef = db.collection("monitoring_sessions").doc(sessionId);
    const sessionSnap = await sessionRef.get();
    if (!sessionSnap.exists) {
      res.status(409).json({ error: "Driver monitoring session is not available for Emergency verification" });
      return;
    }

    const session = sessionSnap.data() ?? {};
    const sessionSeat = String(session.seat ?? "").trim().toLowerCase();
    const fusionState = String(session.fusionState ?? "").trim().toUpperCase();
    if (
      session.ownerUid !== uid ||
      session.active !== true ||
      sessionSeat !== "driver" ||
      fusionState !== "EMERGENCY"
    ) {
      res.status(409).json({ error: "Emergency is no longer active or does not belong to the current driver" });
      return;
    }

    // 4) Server chooses the driver's identity and recipients from Firebase.
    const [userSnap, contactsSnap] = await Promise.all([
      db.collection("users").doc(uid).get(),
      db.collection("users").doc(uid).collection("emergencyContacts").get(),
    ]);

    const driverName =
      (typeof userSnap.data()?.name === "string" && userSnap.data()?.name.trim()) ||
      (typeof decodedToken.name === "string" && decodedToken.name.trim()) ||
      "the driver";

    if (contactsSnap.empty) {
      res.status(200).json({ ok: true, skipped: "no_contacts", smsStatus: "SKIPPED" });
      return;
    }

    const contacts = contactsSnap.docs
      .map((contactDoc) => {
        const data = contactDoc.data();
        const phone = normalizePhilippineMobileNumber(data.phone);
        const hierarchy = Number(data.hierarchy);
        return {
          name: typeof data.name === "string" && data.name.trim() ? data.name.trim() : "Emergency Contact",
          phone,
          hierarchy: Number.isFinite(hierarchy) && hierarchy > 0 ? hierarchy : 999,
        };
      })
      .filter((contact): contact is { name: string; phone: string; hierarchy: number } => Boolean(contact.phone))
      .sort((a, b) => a.hierarchy - b.hierarchy);

    // One SMS request can contain all recipients. De-duplicate identical numbers.
    const recipientMap = new Map<string, string>();
    for (const contact of contacts) {
      if (!recipientMap.has(contact.phone)) recipientMap.set(contact.phone, contact.name);
    }
    const recipients = [...recipientMap.keys()];
    const recipientNames = [...recipientMap.values()];

    if (recipients.length === 0) {
      res.status(200).json({ ok: true, skipped: "no_valid_contacts", smsStatus: "SKIPPED" });
      return;
    }

    const gps = parseLocation(location);
    const message = buildSmsBody(driverName, gps);

    // 5) Durable event-level idempotency. A function restart or repeated
    // Firebase render cannot create a second send attempt for the same event.
    const eventRef = db.collection("smsEmergencyEvents").doc(eventId);
    let claimed = false;
    await db.runTransaction(async (transaction) => {
      const existing = await transaction.get(eventRef);
      if (existing.exists) return;
      transaction.create(eventRef, {
        uid,
        sessionId,
        eventId,
        seatNumber,
        smsStatus: testMode ? "TEST_PENDING" : "SENDING",
        recipientCount: recipients.length,
        gpsIncluded: Boolean(gps),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      claimed = true;
    });

    if (!claimed) {
      const existing = await eventRef.get();
      const existingStatus = String(existing.data()?.smsStatus ?? "").toUpperCase();
      res.status(200).json({
        ok: true,
        skipped: existingStatus === "SENDING" || existingStatus === "TEST_PENDING" ? "event_in_progress" : "duplicate_event",
        smsStatus: existingStatus || "DUPLICATE",
      });
      return;
    }

    // 6) Safe server test mode.
    if (testMode) {
      console.log("SafeSeat SMS TEST_MODE event", {
        eventId,
        uid,
        recipientCount: recipients.length,
        gpsIncluded: Boolean(gps),
      });
      await eventRef.update({
        smsStatus: "TEST_SKIPPED",
        updatedAt: new Date().toISOString(),
      });
      res.status(200).json({
        ok: true,
        skipped: "test_mode",
        smsStatus: "TEST_SKIPPED",
      });
      return;
    }

    // 7) Live TextBee send to ALL registered valid Emergency Contacts.
    try {
      const result = await sendTextBeeSms(recipients, message);
      const now = new Date().toISOString();

      await eventRef.update({
        smsStatus: "SENT",
        smsSentAt: now,
        textBeeMessageId: result.messageId,
        updatedAt: now,
      });

      // Keep existing Admin incident visibility in sync. No phone numbers/GPS
      // coordinates are written to the incident or audit record.
      const incidentRef = db.collection("incidents").doc(`${sessionId}-EMERGENCY`);
      await incidentRef.set({ smsEscalated: true, updatedAt: now }, { merge: true }).catch(() => undefined);

      await db.collection("smsLog").add({
        uid,
        sessionId,
        eventId,
        seatNumber,
        recipientCount: recipients.length,
        textBeeMessageId: result.messageId,
        gpsIncluded: Boolean(gps),
        timestamp: now,
      }).catch((error) => console.warn("SafeSeat SMS audit log write failed:", error));

      res.status(200).json({
        ok: true,
        messageId: result.messageId,
        sentTo: recipientNames,
        smsStatus: "SENT",
      });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : "TextBee send failed";
      await eventRef.update({
        smsStatus: "FAILED",
        failureReason: messageText.slice(0, 500),
        updatedAt: new Date().toISOString(),
      }).catch(() => undefined);
      console.error("SafeSeat TextBee send failed:", error);
      res.status(502).json({ error: "Emergency SMS gateway failed", smsStatus: "FAILED" });
    }
  } catch (error) {
    console.error("SMS escalation error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    res.status(500).json({ error: message });
  }
}
