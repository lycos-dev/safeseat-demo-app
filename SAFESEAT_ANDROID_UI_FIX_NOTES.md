# SafeSeat Android UI fixes

Copy the files in this zip over the same paths in your project root (same folders), then **rebuild the APK**
(`npx eas-cli@latest build -p android --profile preview --clear-cache`). `app.json` and the new
`plugins/with-android-queries.js` change the Android manifest, so Metro / Expo Go reloads alone won't apply them.
No new npm packages are needed.

## 1. Floating gray / over-tall bottom tab bar
The tab bar already pads itself with the bottom safe-area inset, but each screen also used
`SafeAreaView edges={[..., "bottom"]}` plus large `paddingBottom` values (`100 + insets.bottom`, etc.), so the
inset was applied twice. Screens now use `edges={["left","right"]}` and a small constant bottom padding
(Home, Seats, Profiles, Contact, Profile, Settings sub-screens, Diagnostics, Help).

## 2. Keyboard hiding the input (Add Contact and other forms)
- `app.json`: `softwareKeyboardLayoutMode` changed from `pan` to `resize`.
- New `src/components/modal-keyboard-layout.tsx`: full-screen KeyboardAvoidingView (padding) + ScrollView, dialog centered
  in the space above the keyboard. Used by Add Contact, Add Profile, Change Email / Phone / Password, Password Verify.
- Login, Signup and FormScrollView now use `behavior="padding"`; a stray KeyboardAvoidingView around AddProfileModal was removed.

## 3. Modals with unreachable buttons (End Session, Session Summary, ...)
- New `src/components/sheet-frame.tsx`: lifts bottom sheets above the Android nav bar, caps height to the window and scrolls
  the content, so buttons such as "See Session Detail" can no longer end up off-screen.
- Applied to: End Session, Researcher Control (home), Session Summary, Seat Options, Live Seat Detail, Consent (seats).
- Modals now set `statusBarTranslucent` + `navigationBarTranslucent` so edge-to-edge behaviour is the same on every phone.

## 3b. Modal insets (second pass)
Each modal now wraps its content in its own `SafeAreaProvider` (`src/components/modal-safe-area.tsx`) so the bottom inset is measured in the modal window, not the main window (where it was 0 on Samsung).

## 4. "This dialer is not available on this device"
`Linking.canOpenURL("tel:...")` returns false on Android 11+ unless package visibility is declared. The app was not
forcing a dialer. New `src/utils/phone-call.ts` opens the default dialer directly (try/catch) and, only on a real
failure, offers "Copy number". Used by contact cards, the emergency modal, the banner and the contact page.
`plugins/with-android-queries.js` (registered in `app.json`) adds the `<queries>` entries for tel / sms / geo / https.

## 5. Settings section selector (Account / Alerts / History / System)
On Android the floating copy of the selector that appears after scrolling was view-only (`pointerEvents="none"`, non-interactive buttons).
It is now tappable, so you can jump between sections from anywhere on the page. (iOS keeps its original pinned header.)
