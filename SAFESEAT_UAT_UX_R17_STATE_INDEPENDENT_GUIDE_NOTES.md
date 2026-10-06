# SafeSeat UAT UX R17 — State-Independent First-Time Guide

- Fixed the first-time guide so it never depends on real seat assignments, consent, SafeSeat connectivity, or an active session.
- Added realistic in-guide examples for seat assignment, passenger consent, sensor readiness, Start Monitoring, Home status, and alert meanings.
- Consent tutorial now visibly demonstrates CONSENT NEEDED + Confirm Consent even when no passenger has actually been assigned.
- Driver auto-readiness remains unchanged: the authenticated account owner assigned to Driver does not require a separate consent confirmation.
- The guide now blocks interaction with the underlying app while active. Back / Next / Skip / Finish are always the navigation controls.
- The guide does not create profiles, assignments, consent records, or monitoring sessions.
- Existing R16/R15 monitoring, UAT Warning, sound/haptics, vital signs, and readiness behavior are preserved.
