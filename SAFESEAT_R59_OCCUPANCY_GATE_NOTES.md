# SafeSeat R59 — Occupancy-gated monitoring UI

- Fixes the R58 Home crash caused by the stale `setDismissedSeats` effect (inherited from the prior crash-fix build).
- A hardware-linked active seat with an explicit FSR `occupied: false` now shows **WAITING** instead of **ANALYZING**.
- The live-detail state shows **WAITING FOR OCCUPANT** while the seat is empty.
- HR, RR, and MLX surface temperature are not presented as passenger readings until occupancy is detected.
- Movement is shown as **Waiting for occupant** and camera remains **Standby** while empty.
- Session samples no longer save HR/RR/temperature/movement as occupant data while FSR occupancy is false.
- Once FSR occupancy becomes true, the UI automatically transitions to **ANALYZING**, then the Main Hub's decisive SAFE/WARNING/EMERGENCY state.
