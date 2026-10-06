# SafeSeat UAT UX R13 — Hidden Timed Warning Scenario

## UAT control
Edit only `src/constants/uat.ts`:

- `UAT_WARNING_ENABLED` — `true` enables the hidden UAT Warning; set `false` for normal/demo builds.
- `UAT_WARNING_AFTER_MS` — delay after the active Home session is recognized (default 45,000 ms).
- `UAT_WARNING_HOLD_MS` — how long the synthetic Warning remains visible (default 10,000 ms).

## Behavior
- Runs once per monitoring session.
- The countdown is anchored to the actual session start time, so switching tabs does not restart it.
- No visible Diagnostics simulation controls.
- No SIMULATION badge is shown to the participant.
- The synthetic Warning is app-local and sends no request or command to the Main Hub.
- If SafeSeat is offline when the scheduled Warning is due, the app waits until live telemetry is ready.
- A real Main Hub EMERGENCY (including a latched Emergency during temporary WATCH) always overrides the synthetic Warning.
- When the hold time ends, the app returns to the real latched Fusion state.
- Starting a new session rearms the one-shot scenario; ending a session clears it.
