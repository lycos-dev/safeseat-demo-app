# SafeSeat UAT UX R19 — Interactive Guided Setup

The first-time SafeSeat Guide is now action-gated and uses the real application flow instead of a passive slideshow or fake demo state.

## Real guided flow

1. Welcome → Start Guide opens Home.
2. Home → user must navigate to the real Seats tab (bottom tab, Home shortcut, or swipe).
3. Seats → user must tap a real seat on the car.
4. If the seat is empty, the real assignment modal opens and the guide continues only after a real profile/Guest is assigned.
5. If passenger consent is needed, the real consent sheet opens and the guide continues only after Confirm Consent.
   - Logged-in account owner in Driver remains automatically consent-ready.
   - Replay skips redundant consent when the selected seat is already consented.
6. User must tap SafeSeat Sensor and select the actual monitored seat.
7. User must wait for readiness and tap the real Start Monitoring button.
8. Home → user must tap an assigned live seat to open its status details.
9. Guide completion appears; Finish records guide completion for the logged-in account on that device.

## Reliability behavior

- There is no generic Next button for action steps.
- Each step advances from the real control's success event.
- Closing an assignment/consent modal does not corrupt the guide; the coach card remains and tells the user how to reopen it.
- Replay adapts to existing setup instead of forcing re-assignment or duplicate consent.
- Exit Guide is always available. Real changes already made remain real; the guide does not fabricate profiles, consent, connectivity, or session state.
- First-time display remains per authenticated Firebase account on the device.
