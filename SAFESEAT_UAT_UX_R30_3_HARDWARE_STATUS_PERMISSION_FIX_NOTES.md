# SafeSeat UAT UX R30.3 — Hardware Status Permission Fix

- Firestore now treats `vehicles/{vehicleId}.ownerUid` as the authoritative ownership check for `hardware_status/{vehicleId}`.
- The current vehicle owner can repair/replace a stale hardware-status document left by an earlier test or account.
- Mobile hardware-status sync now writes a complete replacement snapshot instead of merging with legacy fields.
- Exact physiological readings remain excluded from the Admin hardware-status document.
