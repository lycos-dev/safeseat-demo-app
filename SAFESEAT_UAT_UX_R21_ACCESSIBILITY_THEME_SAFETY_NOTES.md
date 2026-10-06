# SafeSeat UAT UX R21 — Accessibility, Theme & Safety Pass

## Driver readability
- Increased the app's baseline typography and enlarged the main Home/Seats labels and status text.
- Preserved all five-seat visibility while making names and state labels easier to scan.

## Seat management
- Tapping an occupied seat now opens a dedicated **Seat Options** sheet.
- Passenger actions are explicit: **Confirm/Review Consent**, **Change Person**, and **Remove from Seat**.
- The signed-in Driver remains automatically ready and is not asked for redundant consent.

## Settings cleanup
- Replaced the old Safety/App tabbed settings with one continuous, scrollable Settings page.
- Top shortcut chips scroll to **Account**, **Alerts & Emergency**, and **System & Display**.
- Removed misleading monitoring-module switches. Main Hub sensing modules are shown as automatic system behavior.
- Removed the old Emergency Location Sharing switch because no location service was connected to it.
- Driver Emergency SMS, SMS delay, metric units, appearance, diagnostics, guide, account changes, clearing seats, and logout retain real app behavior.
- Change Email now updates Firebase Auth as well as the Firestore profile.

## Light / Dark appearance
- Dark remains the default SafeSeat appearance.
- Added a persistent Light Mode switch.
- Added a complete light palette for app surfaces, text, controls, car/seat overlays, modals, and navigation.
- Root/status-bar/native appearance and keyboard appearance follow the selected theme.

## Emergency behavior
- Automated-SMS eligibility/countdown is now based on **Driver seat only** (`seat === 1`).
- Passenger Emergency still uses the SafeSeat emergency sound/haptics and Emergency screen, but never starts the SMS countdown.
- Note: the existing prototype still treats automated SMS as eligibility for the configured backend; it does not silently claim a message was sent when no backend is connected.

## Interactive guide
- Guide targets now use a rounded, translucent, pulsing highlight box around the real tappable control.
- Highlights remain non-blocking and action-gated.

## Validation
- Source-level TS/TSX transpile syntax check completed across all source TypeScript files with zero syntax diagnostics.
- Static requirement assertions passed for typography, seat options, settings scrolling, theme switch, Driver-only SMS gating, rounded guide highlight, and Firebase email update.
