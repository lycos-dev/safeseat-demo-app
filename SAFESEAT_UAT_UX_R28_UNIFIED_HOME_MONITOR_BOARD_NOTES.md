# SafeSeat UAT UX R28 — Unified Home Monitor Board

R28 fixes the R27 Home inconsistency where the monitor-board layout only appeared after Start Monitoring.

## Home behavior
- The default/pre-session Home now uses the same five full-width `HomeMonitorRow` console rows as active monitoring.
- No generic `SeatCard` is rendered on Home anymore.
- No scrolling is used for Home in either setup or active-monitoring state.
- The five rows share the available height and remain visible together.
- Before monitoring:
  - empty seat -> EMPTY
  - assigned conceptual seat -> ASSIGNED
  - linked hardware seat -> READY or OFFLINE depending on telemetry
  - missing passenger consent -> CONSENT
  - declined passenger -> DECLINED
- During monitoring the exact same rows transition to SAFE / WARNING / EMERGENCY / ANALYZING / OFFLINE as appropriate.
- A compact SETUP badge and bottom Configure Seats action replace the former pre-session generic-card layout.

## Scope
No changes to Fusion, alerts, SMS eligibility, consent persistence, seat assignment persistence, or sensor logic.
