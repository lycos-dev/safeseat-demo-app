# SafeSeat UAT UX R20 — Compact Interactive Guide

- Replaces the large interactive guide card with a compact floating coach bubble.
- Welcome and Finish remain larger because no underlying control needs to be touched.
- Adds animated, non-blocking pulse/highlight markers directly on the real control that must be tapped.
- Seats tutorial highlights an actual seat card instead of outlining the whole car.
- Assignment tutorial uses a compact guide pill and moves its highlight from the profile list to the Assign button after a person is selected.
- Consent tutorial uses a compact guide pill and highlights Confirm Consent.
- SafeSeat Sensor, Start Monitoring, bottom Seats tab, and live Home seat status each receive an animated tap target.
- Guide highlights never intercept touch events.
- Assignment and consent native sheets suppress the global coach bubble so instructions do not cover the real controls.
- Existing action-gated R19 behavior is retained: progress only occurs after the real required action succeeds.
