# SafeSeat App R24 — Functionality & UI Reliability Fix

Built from R23 Startup Stability Rebuild.

## Reported fixes

1. **System Diagnostic runtime crash fixed**
   - `levelColor()` now receives the active theme for every hardware status row.
   - Fixes: `TypeError: Cannot read property 'textMuted' of undefined`.

2. **Typography restored**
   - Global font scale returned to the R20/original sizing.
   - Home keeps slightly larger monitoring-specific typography for glanceability.

3. **Settings shortcuts redesigned as a sticky dock**
   - Account / Alerts / System shortcuts remain visible while scrolling.
   - The active section is visually selected and taps scroll to the real section.

4. **Light/Dark icon consistency**
   - All active authenticated `@expo/ui` icons now receive an explicit theme color.
   - Settings/tab native icons remount when theme mode changes to avoid stale native tints.
   - Contact action icons now use correct light/dark contrast.
   - Repaired an older contact drawer that referenced a stale theme structure.

5. **Interactive Guide highlight redesigned**
   - Removed the floating TAP badge/indicator from the focus overlay.
   - The guide now draws a rounded double focus frame around the exact tappable control.
   - Overlay remains `pointerEvents="none"`, so it never steals the tap.

6. **Profile UI cleaned up**
   - Compact profile hero with full name and role context.
   - Smaller avatar treatment with clear edit badge.
   - Restored bordered Basic/Health information cards.
   - Removed the oversized Trip Readiness block; Emergency Contacts remains directly accessible.

## Preserved R21–R23 safety behavior

- Dark mode remains default; Light Mode is selectable.
- Driver-seat emergency is the only path eligible for the automated SMS countdown.
- Passenger emergency continues audible/haptic + driver-facing Emergency UI without automated SMS countdown.
- Seat Options (Consent / Change Person / Remove from Seat) retained.
- Interactive first-time SafeSeat guide retained.
- Lazy tab mounting / R23 startup-stability architecture retained.

## Validation

- Expo SDK 57 versioned reference reviewed before code changes.
- 74 TS/TSX files transpiled with TypeScript syntax diagnostics: 0 errors.
- Active authenticated `@expo/ui` Icon nodes without explicit theme color: 0.
