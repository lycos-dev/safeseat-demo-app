# SafeSeat UAT UX R22 — Expo Go Startup Stability

R22 is a focused stability patch on top of R21.

## What changed
- Removed `Appearance.setColorScheme()` from the mounted root component.
- Removed runtime `SystemUI.setBackgroundColorAsync()` from the mounted root component.
- Removed the duplicate `SystemUI.setBackgroundColorAsync()` call from the tab layout.
- Removed the `backgroundColor` prop from `expo-status-bar`; status-bar icon style still follows SafeSeat Light/Dark mode.
- Kept `userInterfaceStyle: automatic` in app config so the project remains theme-capable.
- Kept all R21 in-app theme colors, Settings redesign, seat options, accessibility sizing, guide highlight, and Driver-only SMS eligibility logic.

## Why
The R21 changes introduced native appearance/system-UI mutation during React mount. Expo SDK 57 documents the SystemUI root background call as a root-file-level operation. These native-shell calls are unnecessary for SafeSeat's React-level Light/Dark theme and are higher risk in Expo Go than normal themed Views/Text/StatusBar styling.

## Validation
- 74 TS/TSX source files transpiled with TypeScript 5.8.3: zero syntax diagnostics.
- Source audit confirms no remaining `Appearance.setColorScheme` or runtime `SystemUI.setBackgroundColorAsync` calls.
- ZIP integrity verified after packaging.
