# SafeSeat UAT UX R10 — Home State Animation Focus Fix

## Problem
On the R9 Home screen, switching tabs could leave the animated state visual or its icon invisible when returning to Home. The state icon was hosted by Expo UI while also being wrapped by a native-driven animated transform. The Home tab remains mounted during tab changes, so paused native animation/view state could survive the focus transition.

## Fix
- State icons are now always rendered statically and are no longer transformed by Animated.
- SAFE / WARNING / EMERGENCY animate only a React Native pulse ring around the always-visible icon.
- ANALYZING now uses a custom React Native spinner instead of ActivityIndicator.
- Home increments an animation cycle every time it gains focus.
- Each seat state visual is remounted using that cycle, guaranteeing a fresh visible state after any tab switch.
- Seat animations explicitly stop/reset when Home loses focus and restart when Home regains focus.
- Pre-session READY / EMPTY visuals remain static.

## Expected behavior
Repeatedly switching Home -> Seats -> Home or Home -> Profiles -> Home should always show all five seat cards, state labels, icons, and active animations immediately.
