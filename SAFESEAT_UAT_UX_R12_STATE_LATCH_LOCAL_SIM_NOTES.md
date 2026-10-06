# SafeSeat App UAT UX R12

## Driver-facing Fusion state latch
- A new session can show ANALYZING while Fusion has not yet produced a decisive state.
- Once the Main Hub reports SAFE, WARNING, or EMERGENCY, that decisive state is retained on the driver display through temporary WATCH / insufficient-evidence intervals.
- A later decisive Main Hub state replaces the retained state immediately.
- OFFLINE still overrides the display immediately in live mode.
- The latch resets when a monitoring session starts or ends.

## Local UAT Simulation
- Added under Settings > Diagnostics > UAT Simulation.
- SAFE, WARNING, EMERGENCY, and ANALYZING can be visualized locally on the phone.
- No simulation request is sent to the Main Hub.
- Home shows a visible SIMULATION badge while enabled.
- Return to Live restores the current/latched real Main Hub state.

## Existing R11 behavior retained
- Session consent gate.
- SafeSeat readiness gate before Start Monitoring.
- Five-seat Home layout.
- Tab-safe icon animation behavior.
