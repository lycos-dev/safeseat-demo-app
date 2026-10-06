# SafeSeat UAT UX R9 — Full-height Home seats

## Home monitoring layout
- Active Home is no longer scroll-dependent.
- Driver, Front Passenger, Rear Left, Rear Center, and Rear Right divide the available Home viewport evenly.
- `Seats` and `End Session` stay visible below the five live seat cards.
- If the available viewport becomes shorter, all five rows compress together instead of hiding lower seats below a scroll boundary.

## Live seat cards
- Larger Home-specific seat presentation replaces the R8 compact monitoring rows.
- Each row retains its own animated state indicator.
- Each row now includes a short plain-language state explanation:
  - SAFE — No unusual signs detected
  - WARNING — SafeSeat detected something unusual
  - EMERGENCY — May need immediate help
  - ANALYZING — SafeSeat is still analyzing
  - EMPTY — No one assigned
- ANALYZING continues to use one spinner per analyzing seat only.

## Preserved behavior
- End Session confirmation and redirect to Seats are unchanged.
- Seat assignment behavior, Main Hub telemetry integration, emergency modal, Profiles, Contacts, and Seats screen remain unchanged from R8/R7 unless already inherited.
