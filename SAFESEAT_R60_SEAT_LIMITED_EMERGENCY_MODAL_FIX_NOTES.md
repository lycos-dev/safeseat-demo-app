# SafeSeat R60 — Seat-specific Monitoring Limited + Emergency Modal Reliability

## Changes
- Removed the cabin-wide Monitoring Limited banner.
- Monitoring Limited is now attached only to the hardware-linked prototype seat.
- Monitoring Limited uses blue/slate styling so it cannot be mistaken for Warning.
- WAITING uses a dedicated teal state color instead of gray/alert colors.
- Live seat details show a seat-specific Monitoring Limited explanation when applicable.
- Emergency Contacts now uses a fixed-height internal sheet with a real flexing ScrollView, so the contact list remains reachable and scrollable on iOS.
- Opening Contacts no longer allows the emergency screen behind it to scroll.
- Home, Seats, Profiles, and Settings dismiss their local native modals when Emergency starts so the app-wide Emergency modal can take priority.
- Global Emergency presentation waits 420 ms for iOS native modal dismissal to finish, preventing the common multiple-Modal presentation race.
- Cancelling a local researcher Emergency now stops the simulation.
- Cancelling a real Emergency only dismisses the sheet briefly; if the Main Hub still reports EMERGENCY, the emergency UI returns after 2.5 seconds.
