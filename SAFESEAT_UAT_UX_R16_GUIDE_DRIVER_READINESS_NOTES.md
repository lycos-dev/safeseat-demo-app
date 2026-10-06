# SafeSeat UAT UX R16 — First-Time Guide + Driver Readiness

## First-time Driver Guide
- Runs once per authenticated Firebase account on this device when no monitoring session is active.
- Stored locally as `safeseat_driver_guide_completed:<uid>`.
- Can be skipped without appearing automatically again.
- Can always be replayed from Settings > App > SafeSeat Guide.
- Does not interrupt an active monitoring session.
- Guide automatically navigates between Home and Seats and highlights the real UI area for each step.
- Steps: Home dashboard, seat assignment, passenger consent, SafeSeat connection, Start Monitoring, status meanings.
- Added Settings > App > Quick Help as a concise permanent reference.

## Driver Consent / Readiness
- If Seat 1 (Driver) contains the authenticated account-owner profile, separate monitoring consent is not requested.
- Driver/account-owner is treated as effectively confirmed everywhere, including old saved assignments without a consent record.
- Assigning the account owner to Driver stores confirmed consent for consistency.
- Tapping an assigned account-owner Driver seat opens person selection rather than the passenger consent dialog.
- Any other person assigned to Driver still requires the normal per-session consent flow.
- Passenger consent behavior is unchanged.

## Preserved from R15
- Five-seat Home layout and state animations.
- State latch (WATCH does not erase last decisive state).
- Secret long-press researcher Warning scheduler.
- Warning/Emergency audio + haptics.
- Warning/Emergency HR/RR vital-sign indicators with trusted-live gating.
- Consent/readiness gate for passenger monitoring.
