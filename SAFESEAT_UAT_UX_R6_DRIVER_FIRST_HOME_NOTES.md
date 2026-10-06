# SafeSeat UAT UX R6 — Driver-first Home

This revision focuses on the Home screen hierarchy after UAT feedback.

## Active monitoring Home
- Rebuilt the main status surface into a centered, glance-first layout.
- The state symbol is now the visual anchor, followed by the state label and approved short explanation.
- ANALYZING uses exactly one rotating/loading element: the center ActivityIndicator. The previous orbit was removed.
- SAFE/WARNING/EMERGENCY retain non-spinning pulse/attention motion.
- Warning/Emergency/Analyzing can show the relevant seat in a compact focus pill.
- Seats and End Session actions sit directly below the status surface.
- Renamed the roster section from "Passengers" to "People in the car" so it correctly includes the driver.
- Occupant count now uses PERSON / PEOPLE instead of PASSENGER / PASSENGERS.

## Pre-session Home
- Replaced the previous large setup poster with a compact cabin-setup preview.
- New heading: "Who's in the car?"
- Shows the 2-front / 3-rear cabin structure before entering seat assignment.
- One primary Choose Seats action routes to the Seats tab.

## Preserved behavior
- End Session confirmation and return-to-Seats flow remain intact.
- Main Hub status, Fusion state handling, seat assignments, Emergency modal, and session storage behavior are unchanged.
