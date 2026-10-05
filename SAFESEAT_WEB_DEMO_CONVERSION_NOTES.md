# SafeSeat Web Demo Conversion Notes

Source baseline: **SafeSeat Mobile R30.3 — Hardware Status Permission Fix**.

This is a separate React/Vite demonstration build. The Expo/React Native app is unchanged.

## Web substitutions

| Mobile capability | Web demo behavior |
|---|---|
| ESP32/Main Hub telemetry | Controlled live telemetry simulator |
| Haptics/audio/native alerts | Browser UI feedback |
| AsyncStorage | localStorage |
| Expo Router | Internal React navigation state |
| Expo native icons | Inline SVG icon system |
| Native modal/drawer | Responsive web modal/sheet |
| Firebase Admin cloud sync | Excluded from demo by design |
| Event camera | Status-only demo; no image/video |

## Presentation target

Desktop browsers center a 393 × 852 mobile shell. On mobile browsers the shell expands to the device viewport and retains the same compact five-seat Home layout.
