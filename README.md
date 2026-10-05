# SafeSeat Web Demo

A standalone React/Vite conversion of the SafeSeat Mobile R30.3 interface for browser demonstrations and Vercel deployment.

## Purpose

This project is intentionally separate from the Expo/React Native production prototype. It reproduces the SafeSeat mobile presentation and core interaction flow in a browser-sized mobile shell while replacing native hardware transport with a controlled demo simulator.

### Included demo flows

- Mobile-first SafeSeat UI sized around an iPhone 15 viewport (393 × 852 on desktop, full viewport on phones)
- Sign in / sign up presentation
- Five-seat Home monitoring board with all five seat cards visible at once
- Live-changing HR, RR, surface temperature, freshness, occupancy and movement presentation
- Seat assignment and passenger monitoring consent
- Prototype sensor-seat selection
- Per-seat session ending while other passenger sessions continue
- Immediate Session Summary after a passenger leaves
- Settings → Monitoring & History → multi-session Session History
- HR/RR trend visualization and detailed session statistics
- Passenger profiles and emergency-contact presentation
- Dark/light theme
- System Diagnostic screen
- Controlled SAFE / WARNING / EMERGENCY demo states
- Local persistence via `localStorage`

## Browser demo boundary

The web demo does **not** talk directly to the ESP32/Main Hub and does not attempt to use the Expo native Firebase/hardware implementation. The live sensor feed is simulated in-browser so the Vercel deployment is stable and predictable during a presentation.

No camera image or video is stored/displayed. The UI exposes only the event-based camera verification status.

## Run locally

```powershell
npm install
npm run dev
```

Then open the URL shown by Vite.

## Build

```powershell
npm run build
npm run preview
```

## Deploy to Vercel

1. Push this folder to its own Git repository, or import the folder as a Vercel project.
2. Framework preset: **Vite**.
3. Build command: `npm run build`
4. Output directory: `dist`
5. Deploy.

`vercel.json` already contains the SPA fallback rewrite.

## Demo controls

Open:

**Settings → System Diagnostic**

and switch between:

- SAFE
- WARNING
- EMERGENCY

The values continue to move so Home visibly demonstrates that monitoring is live rather than static.
