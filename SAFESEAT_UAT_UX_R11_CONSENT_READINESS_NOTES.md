# SafeSeat UAT UX R11 — Consent + Readiness Gate

- Session consent is tracked per assigned seat/person in `seatSessionConsents`.
- Assigned seats show: EMPTY, CONSENT NEEDED, NOT MONITORED, OFFLINE, READY, or MONITORING on Seats.
- Tapping an assigned seat opens an in-dashboard consent sheet with Confirm Consent / Not Yet / Declined / Change Person.
- Consent is reset when that seat assignment changes and when a monitoring session ends.
- Start Monitoring is allowed only when the physically linked SafeSeat seat has confirmed consent and live telemetry is ready.
- If SafeSeat is unavailable, the Seats UI says only OFFLINE (no Main Hub wording).
- Home never shows ANALYZING for a seat that lacks consent, is declined, is unlinked, or is offline.
- The single physical UAT seat remains the only seat that can receive authoritative Fusion states.
- R10 tab animation lifecycle fix is preserved.
