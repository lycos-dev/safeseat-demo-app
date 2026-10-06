# SafeSeat Web Demo R31 — Exact Mobile UI conversion

Source: `safeseat-app-safeseat-live-app-final (12).zip` (R31 Final Defense Runtime Sync).

This is a separate Expo Web/Vercel demo build. The React Native screens, navigation,
seat/session behavior, Session History, profiles, settings, and visual theme come from
the uploaded R31 mobile source. Browser-only substitutions are kept underneath the UI.

## Browser substitutions

- Physical Main Hub HTTP transport (`192.168.4.1`) -> deterministic live browser telemetry.
- `expo-secure-store` -> `window.localStorage` through `src/services/app-storage.web.ts`.
- Native Expo UI host/icon primitives -> a web bridge using React Native Web + Ionicons.
- Native date/blood-type controls -> web-safe controls with the same settings-row layout.
- Admin cloud hardware/session sync is disabled for the web demo so simulated telemetry
  cannot pollute the real Admin collections.
- Real emergency SMS sending is disabled on web; the escalation flow returns a safe demo result.
- Private completed-session history remains local to the browser in the hosted demo.

## Fixes included for previous web errors

1. No `src/services/secure-store.ts` self-import exists. All storage imports use
   `@/services/app-storage`, and web resolves `app-storage.web.ts`.
2. `SecureStore.getItemAsync()` is fully implemented on web via localStorage.
3. All local `Animated.*` calls use `useNativeDriver: Platform.OS !== "web"`.
4. Deprecated `textShadowColor`/`textShadowRadius` are excluded on web.
5. Native-only Expo UI/SwiftUI controls are isolated behind web-specific adapters.

## Vercel

- Framework preset: Other / None
- Build command: `npm run build`
- Output directory: `dist`

The build command is `expo export --platform web`.

## Firebase web auth

The SafeSeat Firebase Web config is included as a web-only fallback so the hosted build
can initialize without a local `.env`. Firebase Authentication may still require the final
Vercel hostname to be added under Firebase Authentication -> Settings -> Authorized domains.
