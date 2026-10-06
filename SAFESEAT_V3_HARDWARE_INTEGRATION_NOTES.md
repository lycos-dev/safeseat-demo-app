# SafeSeat Final Redesign V3 — Main Hub Hardware Integration

## Runtime decision

No SafeSeat Runtime firmware files are modified by this overlay.

The provided final Main Hub runtime already exposes the frontend-ready, read-only API required by the mobile app:

- `GET /api/v1/status`
- `GET /api/v1/fusion`
- `GET /api/v1/sensors`
- `GET /api/v1/camera`
- `GET /api/v1/network`
- `GET /health`

Main Hub local address: `http://192.168.4.1`
SafeSeat Wi-Fi SSID: `SafeSeat`
Password: `safeseat123`

The app uses `/api/v1/status` as the canonical live endpoint because that payload already includes Fusion, network, sensors, and camera state.

## What V3 adds

- SafeSeat Main Hub polling service with timeout/backoff and no unhandled fetch errors.
- Live connection state: `LIVE`, `WARMING`, `OFFLINE`.
- Authoritative Fusion mapping:
  - `SAFE` -> Safe
  - `WARNING` -> Warning
  - `EMERGENCY` -> Emergency
  - unavailable/not-ready/invalid -> Pending
- One-seat UAT prototype mapping inside the five-seat app.
  - The first assigned seat is automatically linked to the physical prototype.
  - Before locking, tap **UAT prototype link** to cycle the physical hub link through currently assigned seats.
  - Only the linked seat receives the one physical Main Hub's state.
  - Other conceptual cabin seats remain Pending rather than duplicating one seat's data.
- Assign seat cards show a small `HUB` badge on the physically linked seat.
- Home now shows Main Hub connection state and current authoritative Fusion state.
- Emergency UI is triggered by a real `EMERGENCY` Fusion state from the linked Main Hub seat.
- Self-Diagnostic now reads real C1001, MLX90614, FSR, MPU6050, camera, and Main Hub health from runtime telemetry.
- Settings System status now shows live/warming/offline instead of a placeholder.
- Fixed the **GPS Sharing During Emergency** label colliding with the native switch by giving the switch a fixed non-shrinking area and allowing the label to wrap safely.

## Deliberately NOT changed

The app does not modify or recompute:

- trained IF/OCSVM models
- model thresholds
- C1001 acquisition/filtering
- MLX logic/context
- FSR logic
- MPU logic
- Fusion state machine
- camera trigger/verification behavior
- ESP-NOW transport

Main Hub Fusion remains authoritative.

## Important current boundary

The supplied Main Hub API is intentionally read-only. Therefore the app can now **read and display real hardware state**, but app preference toggles do not physically command the runtime yet.

Examples:

- Behavioral Monitoring / Physiological Monitoring / Event Camera Verification are saved app preferences.
- The 2-second emergency cancel interaction currently cancels the app-side response/escalation UI; it does not rewrite the Main Hub Fusion state.

If final requirements demand that those UI controls physically enable/disable hardware processing, that should be implemented later as a small, explicit authenticated control-plane extension rather than changing the validated sensor/Fusion code.

## Environment

The existing `.env` should contain:

```text
EXPO_PUBLIC_SAFESEAT_HUB_URL=http://192.168.4.1
```

The integration has the same `http://192.168.4.1` fallback if that variable is absent.

## UAT test sequence

1. Power the final SafeSeat hardware normally.
2. Confirm Main Hub Serial shows the SafeSeat AP and Local API as ready.
3. Open the app.
4. Assign the UAT participant to the cabin seat being represented.
5. Confirm **UAT prototype link** points to that seat. Tap it before Lock Deployment to cycle if needed.
6. Lock Deployment.
7. Connect the iPhone to Wi-Fi `SafeSeat` / `safeseat123`.
8. Home should change from `OFFLINE` to `LIVE` or briefly `WARMING`.
9. The linked seat should move from Pending to the Main Hub Fusion result.
10. Open Settings -> App -> System Self-Diagnostic and verify live module results.
11. For the standardized controlled Warning test, open the Main Hub `/uat` researcher page while on the SafeSeat network. The app should show Warning for the linked seat. The runtime intentionally provides no web Emergency injection.

## Development-network note

The SafeSeat Main Hub AP is local-only. During Expo Go development, the phone must be able to reach both Metro and `192.168.4.1`. If tunnel + cellular fallback is unreliable, load the app first, then join the SafeSeat AP, or put the development laptop on the SafeSeat AP and use LAN mode.

For a later standalone iOS/Android build, configure the native app to explicitly permit local-network HTTP access to the Main Hub. This is a native-build configuration step, not a change to the SafeSeat runtime.

## Validation performed on this overlay

- 68 TypeScript/TSX source files parsed/transpiled: 0 syntax diagnostics.
- Fusion mapping smoke check passed for SAFE / WARNING / EMERGENCY / invalid / telemetry-not-ready cases.
- Runtime source was inspected and left unchanged.
