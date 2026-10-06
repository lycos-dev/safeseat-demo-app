# SafeSeat UAT UX R7 — Visibility, Animation Persistence & Profiles

## Seats
- Made the car map height-adaptive for smaller phones.
- Repositioned front/rear seat overlays proportionally so all five seat hotspots remain visible without needing to discover lower seats by scrolling.
- Preserved the translucent seat-overlay design and sticky Start Monitoring control.

## Home
- Fixed Home animation lifecycle when switching tabs/screens. Animated values are reset/restarted on focus so state symbols and person entrances do not disappear after navigation.
- Only the center Analyzing indicator spins; Safe/Warning/Emergency retain non-spinning state motion.
- Replaced the D/F/L/C/R cabin preview with a useful Current Seat Setup summary showing selected people and their seat names, or a clear empty state.
- Compact two-column People in the car layout makes a full five-seat session easier to scan.
- Tightened the monitoring console height while keeping the primary safety state dominant.

## Profiles
- Renamed Occupants tab to People.
- Replaced vague plus-only action with Add Person.
- Added concise guidance explaining saved people can be reused for seat assignment.
- Added clearer empty states and tappable profile affordances.

## Add Person
- Redesigned the modal into clearly grouped required/optional fields.
- Required: Name, Birthday, Height & Weight, Blood Type.
- Optional: Allergies.
- Added 18+ guidance/validation feedback.
- Fixed Create button validation logic so it is only enabled when required fields are valid.
- Fixed imperial height validation so 0 inches is allowed when feet are valid.

## Emergency Contacts
- Redesigned Add Contact with required Name/Phone and optional Contact Order.
- Replaced internal hierarchy terminology with 1st/2nd/3rd/4th/5th contact language.
- Redesigned contact cards with a clear order badge, phone number, View/Edit affordance, and dedicated Call button.
- Updated contact detail wording and validation.
- Updated emergency call list ordering label from #1/#2 to 1st/2nd/etc.
