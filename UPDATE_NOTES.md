# SafeSeat revision 2 — 21 September 2026

## Changes

- Removed the Home instruction/summary card and routine explanatory captions.
- All five Home seats share the available screen height. Home has no ScrollView. Names, seat positions, status, and alert vitals remain visible; smaller screens use a compact row. Full names remain available through seat details and accessibility labels.
- Prototype indicator OFF completely removes the sensor selector from Seats. There is no replacement Monitored seat card. Turning it off preserves the existing hardware-seat selection; when there is no selection, the existing first-assignment fallback still applies. Turn the indicator on to change the physical sensor location.
- The guide skips the sensor-selector step when hidden, including when the setting changes during that step. Consent and one-seat monitoring remain enforced.
- Settings shows only Email and its value, with no edit action or read-only explanation. Removed the toggle's On/Off paragraphs and the monitoring explanation card. The Driver-only SMS note is shortened.
- Enlarged the car map and seat assignment boxes. Added subtle blur and gradient shading around the car with no moving effects. Seats can still scroll on small phones; Home does not scroll.
- Quick Help reflects the hidden selector and fixed Home layout.

## Validation

- npm run typecheck: passed.
- npm test: all seven tests passed, including hidden-selector rendering and guide transitions.
- Android production JavaScript and asset export: passed.
- Rendered the actual Home component with mocked trip data in React Native Web at 320×568, 360×640, and 390×844. All five seats and the bottom actions fit in each panel without scrolling. The previews reserve space for the tab bar and system areas.
- Visually checked the enlarged Seats layout with browser stand-ins for native images/gradients.
- Physical phone, sensor hardware, and real SMS delivery were not available for end-to-end validation.

## Run

Extract the ZIP, then run:

```sh
npm ci
npm run typecheck
npm test
npm start
```

No new dependencies were added. The ZIP contains the full source project and assets, not an APK.
