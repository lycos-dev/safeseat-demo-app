# SafeSeat R25 — Theme, Seat Assignment & Consent Fix

## Fixed

- Native Expo UI icons now use a SafeSeat-aware ThemedHost that explicitly follows the app's Light/Dark preference instead of the device appearance.
- Applied the themed native host throughout authenticated tabs/components, including tab icons, Settings, Seats, Home, contacts, profile selectors, banners, and password/email/phone actions.
- Removed legacy component dependencies on the device `useColorScheme()` / static Dark theme where they could conflict with the in-app theme.
- Seat removal now updates both live React state and `AsyncStorage` immediately.
- Assignment picker receives the live seat-assignment map, so a person removed from one seat is immediately available for another seat without requiring a second removal.
- Empty assignment storage now removes the storage key instead of retaining stale data.
- Seat Options redesigned with clear action rows and descriptions.
- Ambiguous `Confirm Consent` wording replaced:
  - `Record Consent` when no response is recorded
  - `Review Consent` when agreed
  - `Update Consent` after decline
  - consent response uses `Yes, They Agreed`, `Not Yet`, and `They Declined`
- Seat action wording clarified to `Change Assigned Person` and `Remove Person from Seat`.

## Dependency alignment

R25 package.json is aligned to the SDK 57 patch versions identified by Expo Doctor in the UAT environment, adds `expo-asset`, removes the accidental direct `npm` dependency, and pins datetimepicker/pager-view to the versions Expo Doctor requested. The stale R24 package-lock is intentionally not included; keep the already-clean local lockfile/node_modules or run `npm install` in a fresh extraction.

## Validation

- 75 TS/TSX files parsed/transpiled with zero syntax diagnostics.
- No raw `Host` usage remains in authenticated tabs/shared components except the central ThemedHost wrapper.
- No `@expo/ui` Icon in authenticated tabs/shared components is missing an explicit color.
- No legacy `Themes[...]` / `Themes as themes` references remain in authenticated tabs/shared components.
- Old `Confirm Consent`, `Change Person`, and `Remove from Seat` action labels are removed from the active source.
