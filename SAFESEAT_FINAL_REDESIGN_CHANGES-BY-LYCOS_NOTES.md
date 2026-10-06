# SafeSeat Final Redesign V2 — Design + Feature Pass

This overlay is intentionally a refinement of the existing redesign, not a replacement of the original teammate's work.

## Preserved

- Existing Expo Router structure and authentication flow
- Existing Firebase account/profile/contact model
- Existing five-seat Assign map and core seat-card interaction
- Existing profile editing screens
- Safe / Warning / Emergency safety-state semantics
- Dark in-vehicle background and the team's overall navigation structure

## Refined visual direction

- Dark navy foundation with green + white branding
- Amber is reserved for Warning; red is reserved for Emergency
- More compact bottom navigation and setting rows
- Clearer information hierarchy, less decorative chrome, more spacing consistency
- No random fallback profile images; initials are used instead
- Haptics and pressed states are retained for lightweight interaction feedback

## Implemented / prepared features

- Same-tab navigation no-op fix (prevents the previous POP_TO_TOP warning)
- Five-seat Home status view with Safe / Warning / Emergency / Pending summary
- Privacy-first camera status note on Home
- Lock Deployment / End Session wording and workflow
- Session-only Guest passenger assignment for seats 2–5
- Guest assignment deletion when a session ends
- Granular preferences for behavioral monitoring, physiological monitoring, event-camera verification, status sharing, GPS sharing, and automated SMS escalation
- Context-aware escalation shown as an automatic safety rule rather than a user-disableable switch
- 20 / 25 / 30 second escalation-window control
- Emergency overlay with countdown and a real 2-second hold-to-cancel safeguard
- Emergency alert category shown in non-diagnostic language
- Manual nearby-hospital map search
- Manual emergency-contact and emergency-service dialer shortcuts
- Explicit statement that SafeSeat does NOT place automated voice calls
- Automated escalation direction standardized to SMS only
- System Self-Diagnostic screen scaffold that checks the app layer and honestly marks hardware modules as Awaiting Hub until integration

## Deliberately NOT simulated in this pre-hardware pass

- Live M1/M2/M3/M4/CAM Operational / Degraded / Not Detected results
- Live SafeSeat Main Hub telemetry
- Actual Twilio SMS dispatch
- Automatic nearest-hospital ETA inside the app
- Any claim that an SMS has been delivered

These functions need real hardware/backend/location data. The UI is prepared so they can be wired later without redesigning the app again.

## Manuscript cleanup decisions

The uploaded manuscript is unrevised and contains older implementation details. This UI pass follows the current project decisions instead of reintroducing obsolete behavior:

- Weight Balance / total passenger weight remains removed.
- Automated TTS / automated voice calling is NOT implemented. Planned emergency-contact escalation is automated SMS only.
- The current hardware module terminology is M1 Headrest, M2 Backrest, M3 Cushion, M4 Seat Frame, plus the trigger-only camera module. Obsolete removed sensor modules are not added back to the app.

## Apply

Copy the `src` folder from this overlay over the `src` folder in the currently working SafeSeat project. Do not replace `.env`, `package.json`, `package-lock.json`, `app.json`, or `node_modules` with files from an older project copy.
