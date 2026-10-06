# SafeSeat Mobile ↔ Admin Firebase Integration

This build connects the existing SafeSeat mobile flow to the privacy-minimized Admin collections in the same `safeseat-app` Firebase project.

## What syncs

- `account_directory/{uid}`: driver account name/email, role, account status, and high-level preference consent flags.
- `vehicles/{vehicleId}`: deployment identity and the currently linked monitored seat.
- `monitoring_sessions/{sessionId}`: active monitored seat, occupant reference, derived fusion state, and event-based camera state.
- `hardware_status/{vehicleId}`: module-level health only (`operational`, `degraded`, `offline`, `standby`).
- `incidents/{sessionId}-EMERGENCY`: one retained Admin incident when a **real Main Hub emergency** occurs.

Exact HR, RR, MLX temperature, FSR values, MPU samples, raw sensor payloads, and camera frames are never written to the Admin collections.

## Occupant identity

- The signed-in account owner uses `occupantType: registered` and their Firebase UID.
- A saved dependent/person profile uses `occupantType: profile`, plus its owner UID, profile ID, and display name. It is not falsely treated as a Firebase login account.
- A session-only Guest uses `occupantType: guest`.

## UAT simulation boundary

Hidden Warning/Emergency researcher simulations remain local-only and do not create cloud incidents. Only the authoritative Main Hub emergency state can create an Admin incident or count as a real SMS escalation.

## Offline behavior

The Main Hub remains authoritative and local monitoring continues without Firebase. Cloud writes are supplementary and are retried on later status updates when connectivity is available. A phone connected to a local-only SafeSeat AP may need working cellular data for truly live Admin updates.

## Required Firestore rules

Deploy the matching `firestore.rules` from the updated `safeseat-admin` package before testing this integration. The rules allow a signed-in mobile user to write only their own privacy-minimized records while preserving Admin-only access to administrative functions.

## Admin diagnostic round-trip

`diagnostic_requests` is now bidirectional. An Admin request for this vehicle is visible to the signed-in mobile bridge, which refreshes the privacy-minimized hardware health document and marks the request `COMPLETE` with only an overall `operational | degraded | offline` result. No raw sensor readings are attached to the diagnostic response.

## Between monitoring sessions

Once a SafeSeat hardware seat is configured, the mobile bridge keeps the vehicle registration and privacy-safe hardware heartbeat current even when no occupant is locked in. No `monitoring_sessions` document remains active after End Monitoring. This lets the Admin distinguish a registered/online unit from an active occupant session.

If an administrator marks the driver's Admin directory record `DISABLED`, the deployed Firestore rules reject that account's shared Admin-cloud writes. Local Main Hub monitoring remains independent of the cloud boundary.
