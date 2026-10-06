# SafeSeat UAT UX R3 — Home + Seats visual refinement

This revision focuses only on the Home and Seats experience while retaining the functional UAT improvements from R1/R2.

## Seats
- Removed the numbered `1 Pick a seat -> 2 Start monitoring` strip.
- Kept the existing car image unchanged and visually dominant.
- Empty seat overlays now use the explicit action `ASSIGN PERSON` rather than vague `Tap` wording.
- Removed the `MONITORED` text badge from seat overlays so it cannot cover the car artwork/logo.
- Hardware linkage is shown below the car in a compact `SAFESEAT SENSOR` selector with the linked seat, connection state, and a clear `CHANGE` affordance.
- Start Monitoring remains sticky and is now full-width, with a concise readiness line directly above it.
- End Monitoring uses the same persistent action location during an active session.

## Home
- Reworked the live status area into a status-tinted gradient hero while preserving the approved SAFE / WARNING / EMERGENCY / ANALYZING wording.
- Added a clearer cabin-status hierarchy: state, meaning, action/detail, occupant count, and affected seat when relevant.
- Passenger cards now support profile imagery/initials, status rings, compact state badges, press feedback, and a chevron.
- Passenger rows are genuinely interactive: tapping one opens the fuller status explanation so the main driving view stays concise.
- Replaced the old utility-style seat-navigation card with a cleaner `Seats & passengers` action row.
- Replaced the unlocked Home step diagram with a single focused setup hero and `Set Up Seats` action.

## Preserved behavior
- `UNKNOWN` remains user-facing `ANALYZING`.
- Start Monitoring redirects to Home.
- Seat-specific assignment and person-selection flow from R1/R2 is retained.
- Main Hub / Fusion data contract is unchanged.
