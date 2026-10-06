# SafeSeat R26 — Glanceability, Consent, and Settings UI Fix

Built on R25 with no changes to Main Hub networking, Fusion logic, alert rules, or Driver-only SMS eligibility.

## Consent wording
- Seat Options uses the neutral action title **Consent** instead of Record/Review/Update Consent.
- Consent state is shown separately as READY, AGREED, DECLINED, or CONSENT NEEDED.
- Consent choices are now **Agreed**, **Not Yet**, and **Declined**. Removed “They” wording.
- When the linked passenger needs consent, the sticky setup action says **Passenger Consent**.

## Seats layout
- Compact car-map seat cards abbreviate the long status to **CONSENT** (and **DECLINED**) so status text stays inside the pill.
- Full state meaning remains available through Seat Options and accessibility/status copy.

## Settings scrolling/icons
- Settings list icons and chevrons were migrated away from native `@expo/ui` icon hosts to React Native vector icons.
- This prevents native icon layers from visually drifting/floating over the sticky shortcut header while scrolling.
- Sticky shortcut shell elevation was raised so scrolling content stays beneath the dock.
- Icon colors continue to use the active SafeSeat Light/Dark palette.

## Home monitoring glanceability
- Enlarged active-monitoring passenger name, role, avatar, state symbol, and state word.
- State pills are wider and use larger iconography/text.
- ANALYZING spinner and SAFE/WARNING/EMERGENCY symbols are larger.
- Warning/Emergency vital text is larger.
- The design still communicates state using both symbol + text, not color alone.
- Pre-session/global typography remains unchanged.

## Validation
- 75 TS/TSX source files transpile with zero TypeScript syntax diagnostics.
- No old `Record Consent`, `They Agreed`, `They Declined`, or `CONSENT RECORDED` wording remains in active source.
- Settings main screen no longer uses native `@expo/ui` icon hosts for row icons/chevrons.
