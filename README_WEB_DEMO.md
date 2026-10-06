# SafeSeat Web Demo — R31 exact mobile UI

This folder is the browser/Vercel conversion of the uploaded SafeSeat R31 mobile app.
It intentionally preserves the real React Native/Expo Router UI instead of recreating it
as a separate Vite design.

## Run locally

```powershell
npm install
npm run web
```

## Production export

```powershell
npm install
npm run build
```

Expo writes the static site to `dist/`.

## Deploy to Vercel

Use the included `vercel.json`, or configure:

- Framework Preset: Other / None
- Build Command: `npm run build`
- Output Directory: `dist`

## Demo hardware behavior

The deployed browser cannot directly behave like the native phone attached to the
SafeSeat Main Hub's local-only Wi-Fi transport. The web demo therefore feeds the same
mobile UI a live SafeSeat-shaped telemetry stream (HR, RR, surface temperature,
occupancy, movement, camera readiness and SAFE fusion state). Existing researcher/UAT
UI controls can still drive the app's local warning/emergency presentation.

The browser demo does **not** publish synthetic hardware state/incidents to the real
Admin cloud and does **not** send real emergency SMS messages.
