# SafeSeat App UAT UX R15 — Alert Audio + Vital Signs

Based on R14 Secret Long-Press Warning.

## Alert feedback
- SAFE and ANALYZING remain silent.
- WARNING plays a gentle two-note SafeSeat chime immediately, then about every 3 seconds, for up to 10 seconds total.
- WARNING uses matching warning haptic feedback.
- EMERGENCY plays a distinct but controlled alert immediately and about every 4 seconds until the user acknowledges it or the state clears.
- EMERGENCY acknowledgement stops sound/haptics only. The Emergency state and monitoring remain active.
- Ending a monitoring session from Home or Seats silences any active alert feedback.
- Hidden long-press UAT Warning uses the exact same Warning sound/haptic behavior as a live Warning.

## Vital signs
- Vital signs appear only for WARNING and EMERGENCY states.
- Source is the existing C1001 heart-rate and respiration readings from `/api/v1/status`.
- Numeric HR/RR are displayed only when C1001 is connected, not stale, and reports `trusted_vitals=true`.
- Untrusted/stale readings are never recycled as current values; the UI shows Reacquiring/Unavailable instead.
- Home shows a compact VITALS line in the affected seat card.
- The Emergency modal includes a larger Vital Signs panel.
- MLX temperature is intentionally not presented as a clinical vital sign.

## Audio dependency
- Added `expo-audio` ~57.0.4 for Expo SDK 57 playback.
- Added local WAV assets under `assets/sounds/`.
