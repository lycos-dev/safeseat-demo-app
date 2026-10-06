# SafeSeat R31 Exact Web Runtime Fix 1.0.2

- Web authentication/session storage uses the browser-safe adapter.
- Web session delete and clear-history confirmations use `window.confirm`, because React Native `Alert.alert` is not reliable on Expo Web.
- Native iOS/Android confirmations remain `Alert.alert`.
- Session deletion still removes the local record immediately and queues cloud deletion when Firebase connectivity is unavailable.
- Clear-all history uses the existing pending-clear/tombstone mechanism so cloud records do not reappear on refresh.
- Web animations automatically disable `useNativeDriver`; native platforms keep the native driver.
- UI/navigation remain based directly on the R31 Expo source.

Run:

```bash
npm install
npm run web:clear
```
