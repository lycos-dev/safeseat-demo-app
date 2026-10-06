# SafeSeat UAT UX R30 — Per-seat sessions and passenger history

## Purpose

This revision responds to adviser feedback that Home should visibly prove SafeSeat is working and that passengers should be able to review their own session after getting off.

## Home monitoring

- Keeps the existing five-seat Home layout; no extra scrolling section was added.
- The physically linked SafeSeat seat now shows live HR and RR during normal monitoring, not only during Warning/Emergency.
- The same compact line shows telemetry freshness (`LIVE Ns`) so an unchanged SAFE state no longer looks static.
- Tapping an active seat opens a live detail sheet with HR, RR, surface temperature, seat occupancy, Movement activity, camera-verification status, and SafeSeat fusion state.
- Only the physically linked prototype seat can show sensor readings. Other active seats explicitly say `No sensor`; no values are fabricated.
- Camera images/video are never shown or stored in passenger history.

## Per-seat session lifecycle

- Monitoring history is now modeled per seat rather than as one global passenger session.
- `End Session` on Home opens a seat chooser (`Who is getting off?`). Ending one seat saves that seat only; all other active sessions continue.
- `End all active sessions` remains available as an explicit secondary action when more than one session is active.
- A completed seat remains visible as `ENDED` with `Session saved · Tap to review` until the passenger summary is dismissed.
- Dismissing a completed summary frees that physical seat while keeping any saved profile available in Profiles.
- While other sessions are still active, an inactive/free seat can be assigned to the next passenger. After consent, that seat starts a new independent session without restarting the other seats.
- The SafeSeat hardware location itself remains fixed during an active ride; the prototype sensor cannot be reassigned while another session is running.

## Passenger session history

- Home provides an immediate Session Summary for the just-ended seat.
- Settings now includes `Session History` for archived sessions across passengers/seats.
- Detailed history shows duration, HR/RR/surface-temperature min/average/max, compact trend views, Movement activity, verification/warning/emergency counts, and an event timeline.
- User-facing posture wording is `Movement activity`; raw posture labels are not presented as passenger posture judgments.
- Sessions without the physical SafeSeat sensor remain valid passenger/seat sessions but clearly state that physiological readings were unavailable.

## Privacy and Admin boundary

- Exact HR, RR, and surface-temperature samples are stored in the signed-in user's private mobile session history (`users/{uid}/tripHistory/{sessionId}`) on a best-effort basis, with local AsyncStorage as the primary/offline copy.
- Shared Admin collections continue receiving only privacy-minimized session state, hardware health, verification state, and incident metadata.
- Exact physiological samples and camera content are not added to Admin collections.
- The Admin bridge now uses seat-scoped session IDs for the physically linked SafeSeat seat so ending that passenger closes only that Admin session document.

## Validation in this package

- All 90 TS/TSX source files passed TypeScript transpile/syntax validation.
- The existing regression suite reports 11/15 passing. The same four failures are reproducible on the uploaded R29/source package before this change (three auth-screen test-harness selector failures and one preferences theme expectation), so they are not introduced by R30.
- The Seats hidden-prototype-indicator regression test was updated only to mock the new seat-session context and continues to pass.
- A full Expo dependency build was not completed in the packaging environment because dependency installation did not finish. Run the commands below on the development PC for final device validation.

## Local validation commands

```powershell
npm install
npm run typecheck
npm test
npx expo start -c
```

Recommended manual scenario:

1. Assign two or more passengers and confirm consent.
2. Start monitoring.
3. Confirm the hardware-linked Home card shows changing HR/RR and `LIVE Ns`.
4. Tap the linked card and verify Live Monitoring detail.
5. Tap `End Session`, end only one seat, and confirm other seats remain active.
6. Open the ended card's summary, then `See Session Detail`.
7. Dismiss the completed seat and assign the next passenger while another seat session is still running.
8. Open Settings → Session History and review both sessions.
