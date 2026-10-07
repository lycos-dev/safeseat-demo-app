# Error + QR fix notes

Only errors were fixed; no UI or behaviour was redesigned.

## Errors fixed
- 10 files imported `local-storage.ts` with a `.ts` extension (TS5097, breaks type-check/tests) -> `@/services/local-storage`.
- `ui-bridge.ts` and `ui-modifiers-bridge.ts` re-exported themselves (circular) -> now re-export from `@expo/ui` / `@expo/ui/swift-ui/modifiers`.
- `StyleSheet.absoluteFillObject` (removed) -> `StyleSheet.absoluteFill`.
- Two type errors in `seat-session-context.tsx`.
- `src/firebase.ts` crashed with `auth/invalid-api-key` when no `.env` existed (this also broke `npm run build`). Added safe fallbacks + `.env.example`. Put your real keys in `.env`.
- `package.json` was missing `build` / `web:clear` scripts that `vercel.json` and the READMEs rely on. Added.
- Removed unused stray dependencies `start` and `react-navigation@5`.
- Regression test harness mock updated for the `@/services/local-storage` import (15/15 pass).

## QR / "server cannot be found"
`expo-dev-client` is installed, so plain `expo start` shows a QR for a development build, which Expo Go cannot open.
- `npm start`            -> Expo Go QR on your Wi-Fi (phone and PC on the same network)
- `npm run start:tunnel` -> Expo Go QR through ngrok; works on any network / when the LAN QR says server not found
- `npm run start:clear`  -> same as start, with clean cache
- `npm run dev-client`   -> original behaviour, only for a built development client
