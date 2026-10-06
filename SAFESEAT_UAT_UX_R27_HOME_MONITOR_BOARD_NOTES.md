# SafeSeat UAT UX R27 — Home Monitor Board

R27 changes only the active Home monitoring presentation.

- Replaces the generic five SeatCard rows on active Home with dedicated monitoring-console rows.
- Keeps all five seats visible at once with no scrolling by sharing the remaining screen height equally.
- Each row has three clear zones: seat/person identity, large live state, and sensor/vitals context.
- Status remains readable without relying on color through large text and symbols: SAFE, WARNING, EMERGENCY, ANALYZING, OFFLINE, etc.
- The physically linked seat is explicitly marked SENSOR LINKED / LIVE MONITOR.
- HR/RR remain shown only for Warning/Emergency and only when trusted, preserving the prior non-diagnostic behavior.
- Empty and non-linked conceptual seats remain visible and clearly differentiated.
- Seats and End Session controls remain pinned below the monitoring board.
- The interactive guide still wraps the target monitoring row.

No Fusion, alerting, consent, assignment, SMS, or persistence logic was changed.
