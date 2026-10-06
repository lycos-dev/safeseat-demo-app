# SafeSeat App R18 — Guide Reliability Fix

## Why R17 failed
- The guide forced route changes while it was open, making Replay dependent on navigator state.
- The guide card used absolute top/bottom placement, so smaller screens could make navigation controls difficult or impossible to reach.
- Replay was silently disabled during an active monitoring session, giving no explanation when tapped.

## R18 changes
- The tutorial is now a true React Native `Modal`, rendered above the navigator.
- Replay no longer changes routes. It opens over the current screen and is fully state-independent.
- Back / Next / Skip / Finish are pinned outside the scrollable guide content and always have a 44px minimum touch target.
- The guide content scrolls on short screens, but its navigation buttons remain visible.
- Tutorial examples demonstrate seats, passenger consent, connection readiness, Start Monitoring, and status meanings without requiring real profiles, consent, hardware, or a live session.
- The guide never modifies real seat assignments, consent, sensor state, or session state.
- During an active monitoring session, Settings now shows `After session`; tapping the guide gives an explanation instead of silently doing nothing.
- First-time guide completion remains stored per authenticated account on-device.
