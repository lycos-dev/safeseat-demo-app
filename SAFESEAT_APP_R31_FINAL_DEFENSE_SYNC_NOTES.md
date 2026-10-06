# SafeSeat App R31 — Final Defense Runtime Sync

This build is based on `safeseat-app-safeseat-live-app-final (11).zip` and aligns the passenger app with Main Hub R5.4.

## Live state presentation
- Routine Main Hub `WATCH` remains visually `SAFE` after a trusted SAFE result.
- After a real `WARNING` or `EMERGENCY`, a temporary Main Hub `WATCH` is shown as `MONITORING` / recovery instead of latching the old alert.
- Once Main Hub returns `SAFE`, the app returns to `SAFE` immediately on the next telemetry refresh.
- Camera verification no longer replaces Fusion with a `VERIFYING` safety state.

## Camera corroboration presentation
- Passenger-facing Live Monitoring never shows UPRIGHT/NON-UPRIGHT.
- User-facing labels are limited to `Standby`, `Visual confirmation in progress`, and `Visual confirmation completed`.
- If camera corroboration cannot classify because the camera/baseline is unavailable, the passenger-facing verification step is still treated as completed rather than exposing an `Unavailable` message.
- Camera remains corroboration-only; Fusion severity comes from the Main Hub.

## Hidden controlled camera fallback
Inside the Live Monitoring `Camera verification` tile there are three invisible one-tap zones:
- left third: controlled UPRIGHT
- middle third: return to REAL CAMERA
- right third: controlled NON-UPRIGHT

There is no visible UAT badge, menu, sheet, button text, or Controlled UAT indicator in the app. The zones only apply when Controlled UAT is already active on the Main Hub. Controlled results remain identifiable in Main Hub `/uat`, telemetry/CSV, and research/report data.

## Session History privacy and lifecycle
- Added per-session `Delete Session`.
- Added `Clear Session History` with confirmation.
- Deletion removes local history immediately and also deletes the private Firestore `tripHistory` record.
- Offline/pending deletion tombstones prevent deleted records from reappearing during later cloud merges.
- `Clear Session History` keeps a pending clear marker until cloud deletion can be completed.
- Detailed completed history older than 30 days is removed locally and deleted from private cloud history during sync.
- Camera images/video continue to be excluded from passenger history.

## Session History navigation
- Repeated fast taps on the same history row are navigation-locked so the same detail screen cannot be stacked repeatedly.
- Settings uses `navigate` for Session History rather than repeatedly pushing duplicate Session History screens.

## History event wording
- Camera activity is recorded as `Visual confirmation requested` / `Visual confirmation completed`.
- Camera posture classifications are not shown in passenger history.
- Main Hub `WATCH` is recorded as monitoring/recovery context rather than as a new warning event.
