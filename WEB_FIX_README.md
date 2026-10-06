# SafeSeat R31 Web/Expo Auth Fix

This package is based directly on `safeseat-app-safeseat-live-app-final (12)`.

## Fixed
- Firebase client config no longer becomes undefined when launched without an `.env` file.
- Web uses `browserLocalPersistence`.
- Native/Expo Go uses AsyncStorage 2.x with Firebase `getReactNativePersistence`.
- Duplicate Firebase Auth initialization during Fast Refresh falls back safely.
- Genuine Firebase configuration errors are no longer swallowed and converted into misleading Expo Router "missing default export" warnings.
- `npm run web` launches Expo Web directly.
- `npm run web:clear` launches Expo Web with a clean Metro cache.

## Web demo
Use:

```powershell
npm install
npm run web:clear
```

Then open the printed `Web: http://localhost:8081` address.

For Vercel, use the Expo Web export configured by the project. Do not use Expo Go for the Vercel demo.
