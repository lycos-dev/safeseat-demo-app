export type SeatDisplayState = "empty" | "assigned" | "safe" | "warning" | "emergency" | "unknown" | "consent" | "declined" | "offline" | "ready" | "monitoring";

/** Presentation settings never participate in monitoring eligibility. */
export function getSeatDisplayState({ assigned, ownerDriver, consent, linked, connected, ready, active, liveState }: {
  assigned: boolean;
  ownerDriver: boolean;
  consent?: "confirmed" | "declined";
  linked: boolean;
  connected: boolean;
  ready: boolean;
  active: boolean;
  liveState: SeatDisplayState;
}): SeatDisplayState {
  if (!assigned) return "empty";
  if (!ownerDriver && consent !== "confirmed") return consent === "declined" ? "declined" : "consent";
  if (!linked) return "assigned";
  if (!connected || !ready) return "offline";
  return active ? liveState : "ready";
}
