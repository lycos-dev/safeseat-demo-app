# SafeSeat UAT UX R4 — Home Motion & Theme Polish

This revision preserves the R3 flow and focuses on Home visual quality.

## Home changes
- SafeSeat navy + emerald are now the persistent visual base, while green/amber/red/blue remain reserved for live status semantics.
- Added subtle ambient background lighting so Home is not a flat navy canvas.
- Added a soft breathing aura on the main cabin-status card.
- Added a restrained pulse ring around the main status icon.
- Added a pulsing LIVE indicator when the Main Hub is connected.
- Added spring/fade entrance motion for the main status surface.
- Passenger rows enter with a short stagger animation when monitoring is active.
- Passenger rows now have a thin semantic state rail and restrained state glow for stronger visual hierarchy.
- Setup Home uses the same SafeSeat navy/emerald depth and ambient motion.

## Motion intent
Animations are deliberately low-amplitude and use native-driver transforms/opacity so they communicate active monitoring without becoming distracting to a driver.

No SafeSeat monitoring logic, seat assignment logic, Main Hub integration, or Seats-screen workflow was changed in this pass.
