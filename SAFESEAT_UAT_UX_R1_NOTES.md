# SafeSeat UAT UX Update — 2026-09-09

This build applies the usability findings from the recent UAT without changing the existing SafeSeat car artwork.

## User-facing changes

- `UNKNOWN` / `? Unknown` is presented as **ANALYZING** in the driver-facing seat and Home status UI.
- Home now uses one prominent visual safety-status card:
  - **SAFE** — No unusual signs detected. Monitoring continues automatically.
  - **WARNING** — SafeSeat detected something unusual. Check on the passenger.
  - **EMERGENCY** — Passenger may need immediate help. Check the passenger and follow emergency guidance.
  - **ANALYZING** — SafeSeat is still checking.
- Removed the old four-column Safe/Warning/Emergency/Pending counter strip from Home.
- Reduced technical Main Hub/Fusion wording from the normal driver Home screen.
- Home setup guidance is shorter and action-oriented.
- Bottom navigation now labels the assignment tab **Seats** while preserving the existing route.

## Assignment changes

- The page is now titled **Assign Seats**.
- A two-step guide shows **Assign seats → Start monitoring**.
- Empty seat cards explicitly show the seat role (Driver, Front Passenger, Rear Left, Rear Center, Rear Right) and `Tap to assign`.
- Assigned seat cards continue to show the seat role and the assigned person's name.
- The existing car image is unchanged; seat cards are lighter and the map is more compact so all five positions are easier to see immediately.
- The person picker now asks a seat-specific question such as **Who is in the Front Passenger seat?**
- Guest wording is simplified.
- The physical UAT seat selector is renamed **Monitored seat** and now opens a clear seat-choice dialog instead of silently cycling positions.
- The confusing **Lock Deployment** action is presented as **Start Monitoring**.
- Starting monitoring automatically redirects to Home.

## Navigation / clarity

- Existing persistent bottom navigation remains available across the tabbed app.
- The active tab treatment remains visually highlighted.
- Home includes a direct **View Seats** action during monitoring.
- Technical diagnostics remain available under Settings rather than occupying the main driver view.
