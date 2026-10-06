# SafeSeat UAT UX R8 — Seat-First Home

## Home
- Removed the large overall SAFE/WARNING/EMERGENCY/ANALYZING monitoring console.
- Home now always uses the five physical cabin positions in one vertical list: Driver, Front Passenger, Rear Left, Rear Center, Rear Right.
- All five rows render even when a seat is empty.
- Pre-session Home uses the same five-seat list and marks selected people as READY.
- Active monitoring moves status feedback into each individual seat row.
- ANALYZING uses one spinner inside that seat only.
- SAFE, WARNING, and EMERGENCY use small state-specific pulse animations inside each row.
- Seat rows no longer fade/animate as whole components, preventing disappearing cards after tab navigation.
- Kept Seats and End Session controls.

## Profiles and Emergency Contacts
- Removed explanatory page subtitle and informational strips.
- Removed redundant profile/contact helper paragraphs.
- Kept REQUIRED / OPTIONAL field labels and validation so form requirements remain clear.
- Empty states are shorter and no longer contain tutorial-like instructions.
