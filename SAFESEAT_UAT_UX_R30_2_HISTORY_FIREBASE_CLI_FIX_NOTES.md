# SafeSeat UAT UX R30.2 — Monitoring History + Firebase CLI Fix

## Settings
- Moved Session History out of Account.
- Added a dedicated MONITORING & HISTORY section between Alerts & Emergency and System & Display.
- Added a History shortcut to the sticky Settings section navigator.
- Session History remains visible even when there are no completed sessions.

## Firebase CLI
- Added `firebase.json`, `.firebaserc`, `firestore.rules`, and `firestore.indexes.json` to the Mobile project root.
- The Mobile folder is now a Firebase CLI project directory targeting `safeseat-app`.
- Added `npm run firebase:use` and `npm run firebase:deploy:firestore` helpers.
- The Firestore rules are the same privacy-minimized Mobile/Admin contract used by Admin V1.5.

## Cloud sync reliability
- Fixed a first-launch provisioning race: the Mobile app now ensures its ACTIVE `account_directory/{uid}` record exists before provisioning the shared vehicle document.
- Cloud sync warnings now identify the failing stage (account directory, vehicle provisioning, hardware status, monitoring session, or emergency incident).
