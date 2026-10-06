# SafeSeat UAT UX R5 — Home Monitoring Console

This pass restructures Home rather than only adding decorative motion.

## Home changes
- Rebuilt the active-session hero as a status-focused monitoring console.
- Added state-specific visual behavior:
  - ANALYZING: loading spinner plus rotating orbital indicator.
  - SAFE: animated check symbol with a calm breathing confirmation ring.
  - WARNING: animated warning symbol with a quicker attention pulse.
  - EMERGENCY: stronger/faster emergency pulse treatment.
- Added dedicated Seats and End Session controls immediately below status.
- End Session now opens an in-app confirmation sheet.
- Confirming End Session stops the session, removes session-only guest assignments, preserves saved assignments, clears status state, and redirects to Seats.
- Kept SafeSeat navy/emerald as the base visual identity while preserving semantic status colors.
- Retained the existing passenger status cards and detailed status tap behavior.

## Validation
- Home, Seats, and passenger-card TSX were syntax-validated with the TypeScript compiler parser.
- Full Expo native compilation was not run in this environment because project dependencies are not installed locally.
