# SafeSeat Android icon and Main Hub fixes

## Follow-up: quiet offline / timeout handling

The Main Hub being off, the phone being on another Wi-Fi network, or a slow/unreachable hub can cause a request timeout. The previous logger used `console.warn`, which Expo Go displays through LogBox. This was a handled connection failure, not an app crash.

This follow-up uses throttled `console.info` diagnostics for handled hub failures, so this logger no longer produces the on-screen warning. The app continues to show its existing unavailable/offline state and retry normally. Connection failures are still visible in terminal/ADB diagnostics. No global warning suppression was added.

Android can describe our AbortController timeout as `Fetch request has been canceled` instead of `AbortError`. The service now checks its controller's aborted flag and reports `Main Hub request timed out` consistently for both GET and POST requests. Other errors retain their original cause. The existing timeout duration and reconnect behavior remain unchanged.

Only these files changed relative to the first fixed ZIP:
- `src/services/safeseat-hub.ts`: quiet connection diagnostics and normalized timeout errors.
- `scripts/regression-tests.cjs`: verify handled errors do not use the warning channel, correct timeout classification, and recovery.
- `SAFESEAT_ANDROID_FIX_NOTES.md`: this follow-up and validation results.

For your already updated folder, replace `src/services/safeseat-hub.ts` with this version, stop Metro with Ctrl+C, then run `npm run start:tunnel:clear`. No new dependency installation is required for this follow-up. The full project is also included. Rebuild the APK when you want this change in the installed standalone app.

Follow-up validation: TypeScript passed and all 23 regression tests passed. Physical phone/hub operation was not tested here. The earlier Android/iOS release-export checks below apply to the preceding icon/network fix; this small logging follow-up was verified with TypeScript and regression tests.

## Build the new APK

Use Node.js 22.13 or newer. Extract the ZIP and open a terminal in `safeseat-demo-app-master` (the folder containing `package.json`).

```sh
npm ci
npx eas-cli@latest build -p android --profile preview --clear-cache
```

If EAS asks you to sign in, use the Expo account authorized for the existing `lycos/safeseat-app` project. The existing package name and EAS project ID are preserved. `preview` explicitly produces an installable APK, not a development client or AAB. No extra configuration is needed for the deployment values you supplied.

Install the newly generated APK. A Metro restart, Expo tunnel, or JavaScript-only update cannot apply an Android manifest change to an old APK. If Android rejects an in-place install because the signing key differs, use the original EAS signing credentials; uninstalling would remove locally stored app data.

The project uses Expo-generated native projects and does not include `android/` or `ios/`. Build this extracted source directly. If applying the changes to another checkout that contains generated native projects, regenerate its Android project with `npx expo prebuild --platform android --clean` only after preserving any manual native changes.

## Main Hub cause and exact correction

The app polls `http://192.168.4.1/api/v1/status` directly. It does not send sensor requests through the Expo tunnel. The tunnel supplies the development app's JavaScript; it is not the hub connection.

The original `app.json` contained `expo.android.usesCleartextTraffic: true`, but this is not the setting consumed by the SDK 57 Android prebuild pipeline. Inspecting the original generated manifest confirmed that the application had **no `android:usesCleartextTraffic` attribute**. On modern Android, the standalone release therefore blocks this HTTP traffic, while Expo Go runs with its own native networking configuration.

The unsupported property was removed and replaced with the supported config plugin:

```json
[
  "expo-build-properties",
  {
    "android": {
      "usesCleartextTraffic": true
    }
  }
]
```

This entry is in `expo.plugins` in `app.json`. Its SDK-compatible dependency is included in `package.json` and locked in `package-lock.json`. The corrected generated application manifest now contains:

```xml
android:usesCleartextTraffic="true"
```

`INTERNET` and `ACCESS_NETWORK_STATE` are explicitly declared. INTERNET was already supplied by Expo in the original generated manifest; its absence was **not** the root cause. The app uses HTTP polling, not Bluetooth, Wi-Fi scanning, mDNS, UDP broadcast, or WebSockets, so unrelated Bluetooth/nearby-device permissions were not added. Existing GPS permissions remain for emergency location.

The supplied public client values are included in `.env` for local development and `eas.json`'s inherited `base.env` for remote builds. URLs use normal `http://` and `https://` syntax. Existing source defaults already matched the hub address; missing environment variables alone do not explain the original symptom. If deploying another vehicle or backend, update `.env` and `build.base.env` together.

A second networking bug was corrected: React Native can expose browser-like `window` and `navigator` globals. The service now checks `Platform.OS === "web"` before applying browser local-network handling. Native failures are no longer misclassified as browser permission errors.

The missing manifest setting is confirmed from this source project. An APK running on your specific phone with your physical Main Hub has not been tested here, so device Wi-Fi routing or hub-side problems remain possible if a fresh build still fails.

## Icon corrections

- Preload Ionicons and MaterialIcons together with the existing Inter fonts before rendering the screens.
- Preload all 19 app XML vector assets, then pass local file URIs to the Android native renderer. This retains the existing vector artwork and avoids the installed Expo UI renderer's raw-resource XML/bitmap fallback path in standalone builds. In an APK, the local files are copied from packaged resources; no internet or Metro server is required.
- Reserve the existing icon dimensions for Android Hosts containing a single icon. Password-eye Hosts previously had neither explicit dimensions nor content matching and could collapse to zero size while the native painter loaded.
- Give Android login/signup eyes the existing light text color on their fixed dark background. iOS tint behavior is unchanged.
- Correct the drawer's Edit action from an Android chat drawable to the matching pencil drawable.
- Correct the bridge's `Icon.select` TypeScript declaration; preserve the native SF Symbol/Material Symbol selection and web fallback.
- Surface asset-loading failures through the existing error boundary instead of hanging indefinitely on the splash screen.

All app icon call sites were inspected, including the shared bridge, native tabs, `expo-symbols`, modal controls, and vector icons. All 46 checked literal vector-icon names exist in their installed glyph maps. The existing Unicode checkmarks, chevrons, arrows, circles, ellipsis, dash, and multiplication sign exist in the bundled Inter fonts, so they were preserved. Emoji found in source comments are not rendered UI. No evidence required changing modal stacking, clipping, or app layouts. Platform-native SF Symbols and Material Symbols retain their original platform-specific shapes.

## Every changed or added file

| File | Reason |
| --- | --- |
| `app.json` | Apply cleartext through the Android build plugin; explicitly declare networking permissions. |
| `eas.json` | Supply public deployment values to all build profiles and explicitly request APK output for preview. |
| `.env` (new) | Include the public client configuration supplied with the request for local use. |
| `package.json` | Add the supported build plugin and apply Expo's recommended SDK 57 compatibility patches. |
| `package-lock.json` | Lock the dependency changes for reproducible `npm ci` installs. |
| `src/app/_layout.tsx` | Gate startup on icon fonts/XML assets; handle startup failures and rejected native setup promises. |
| `src/services/icon-assets.ts` (new) | Register/preload every app XML icon and provide its cached local file URI. |
| `src/components/ui-bridge-runtime.tsx` | Reserve Android icon Host dimensions, use local drawable URIs, and repair `Icon.select` typing. |
| `src/app/(auth)/login.tsx` | Set a visible Android-only eye tint using the screen's existing light color. |
| `src/app/(auth)/signup.tsx` | Apply the same Android-only password-eye tint correction. |
| `src/components/contact-card-drawer.tsx` | Use the correct Edit/pencil drawable on Android. |
| `src/services/safeseat-hub.ts` | Fix platform detection; add throttled request-failure/recovery logs and reject array status payloads. |
| `src/hooks/safeseat-hub-context.tsx` | Log connection/readiness transitions and prevent in-flight requests from restarting polling after cleanup/backgrounding. |
| `scripts/regression-tests.cjs` | Repair stale test imports/fixtures/async confirmation expectations; add icon and hub regression coverage. Existing signup requirements were preserved. |
| `SAFESEAT_ANDROID_FIX_NOTES.md` (new) | Document causes, exact fixes, full change list, validation, and build/device instructions. |

No screen redesign, monitoring thresholds, sensor fusion rules, SMS rules, navigation, or feature additions/removals were made. Existing unused/reference project files remain included. Generated caches and `node_modules` are excluded; `npm ci` restores dependencies.

## Validation

- `npm run typecheck`: passed (no TypeScript errors).
- `npm test`: all 23 regression tests passed.
- `npx expo install --check`: dependencies are up to date for SDK 57.
- `npx expo config --type introspect`: verified the generated Android application has `android:usesCleartextTraffic="true"` and the declared networking permissions.
- `npx expo export --platform android --platform ios`: both production Hermes bundles exported successfully with the app's XML drawables and vector fonts.
- Icon audit: all 46 checked literal vector-icon names were valid; relevant Unicode symbols were verified against the bundled Inter font character maps.
- The ZIP was checked for integrity and preserves every file from the supplied source archive.

No EAS build was submitted and no physical APK/iPhone test was performed. Release export validates bundling, not Android native compilation, pixel-level appearance, Wi-Fi routing, or real sensor operation. Those require the fresh APK and your actual phone/hub. The included device checklist is the final acceptance check.

## Quick device check and logs

1. Install the new APK and check the login/signup eye controls, password dialogs, Emergency Contacts actions, emergency modal, tabs, and Settings icons. Try both Android system light/dark modes and the app's existing light/dark setting where applicable.
2. Connect the phone to the Main Hub's SafeSeat Wi-Fi and accept Android's option to stay connected even without internet.
3. Check `http://192.168.4.1/api/v1/status` in the phone's browser. If it is unreachable there too, check the hub power/AP and phone routing. Temporarily disable mobile data, VPN, or automatic switching away from Wi-Fi only if needed to isolate routing.
4. Open the app's existing System Diagnostic and monitoring flow. Verify connected/telemetry-ready state and sensor statuses. Background and resume the app to verify polling resumes.
5. For remaining failures, attach USB with debugging enabled and capture logs:

```sh
adb logcat -v time ReactNativeJS:I ImageLoader:V AndroidRuntime:E "*:S"
```

The app logs `[SafeSeat/Hub]` connection/readiness transitions, endpoint failures, and recoveries; repeated identical failures are throttled to once per 30 seconds. It does not log sensor readings, occupant/contact records, or request bodies. `ImageLoader` provides native icon decode errors. Windows users can also filter `adb logcat` output with `findstr /I "SafeSeat CLEARTEXT ImageLoader AndroidRuntime"`.

Reference: https://docs.expo.dev/versions/v57.0.0/sdk/build-properties/ and https://docs.expo.dev/versions/v57.0.0/sdk/ui/universal/icon/
