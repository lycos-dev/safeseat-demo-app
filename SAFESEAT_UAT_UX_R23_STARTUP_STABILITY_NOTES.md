# SafeSeat R23 — Startup Stability Rebuild

- Restored the known-good R20 root startup/provider architecture.
- UserPreferencesProvider is again scoped to the authenticated tab shell instead of mounting around the entire app root.
- Restored the known-good dark native shell configuration in app.json; in-app Light/Dark theming remains available after login.
- Enabled lazy material-tab rendering (`lazy: true`, preload distance 0) so Settings/Profiles/Seats do not all mount during Home startup.
- Wrapped the new Settings shield icon in an Expo UI Host rather than mounting the native Icon directly.
- Kept R21/R22 usability, seat options, driver-only SMS, larger text, guide, and in-app Light/Dark features.
