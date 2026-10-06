# SafeSeat Seats Scroll Fix

Updated `src/app/(tabs)/assign/index.tsx` to address excessive/sticky bottom scrolling in the Seats tab.

Changes:
- Disabled iOS bounce and Android overscroll on the main Seats `ScrollView`.
- Replaced the fixed `138 + safe-area` bottom padding with padding based on the measured height of the actual sticky monitoring action panel.
- Removed `flex: 1` from the inner scroll container so the content height is determined naturally.
- Preserved the existing Seats UI, prototype indicator behavior, seat assignment logic, monitoring controls, and prior car-image rendering fix.

Regression status:
- Existing regression suite remains 6/7 passing, identical to the prior fixed build.
- The one existing failure is the unrelated user-preferences theme persistence test (`dark` vs `light`).
