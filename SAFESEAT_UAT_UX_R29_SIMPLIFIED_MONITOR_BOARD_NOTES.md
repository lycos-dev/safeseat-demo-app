# SafeSeat UAT UX R29 — Simplified Monitor Board

## Goal
Reduce Home-screen cognitive load while keeping all five cabin seats visible without scrolling.

## Home redesign
- Unified pre-session and active-session Home remains a five-row monitoring board.
- Removed the extra `CABIN MONITOR / 5-seat overview` header block.
- Main title is now simply `Cabin Monitor`.
- Each row now focuses on three things only:
  1. Seat/role
  2. Occupant
  3. Current status
- Removed the permanent third metrics/status column.
- HR/RR appears only for the linked seat during Warning/Emergency.
- Hardware-linked seat gets a small `LINKED` badge rather than a full third column.
- Unlinked assigned seats during an active session are labeled `NOT MONITORED` instead of looking like a broken `OFFLINE` sensor.
- True `OFFLINE` is reserved for the linked hardware seat when monitoring data is unavailable.
- Short, state-specific secondary hints appear only when useful (Warning, Emergency, Analyzing, Consent, Offline, Empty).
- Long state labels use one-line auto-fit text to avoid overflow.

## Controls
- Active session bottom controls simplified to `Seats` and `End Session` only.
- Pre-session action simplified to `Set Up Seats`.
- Five rows remain flex-fitted to the available screen; no Home scrolling added.

## Unchanged behavior
- Fusion/state logic
- Driver-only automated SMS eligibility
- Passenger emergency audio/haptics
- HR/RR trust rules
- Seat assignment/consent persistence
- Hidden UAT Warning control
- Guide logic
- Light/Dark theme behavior

## Validation
- 76 TS/TSX files passed TypeScript transpile/syntax validation with zero diagnostics.
