# SafeSeat Auth Refresh

- Replaced the remote stock-traffic image on Splash, Login, and Sign-up with a fully local SafeSeat background.
- The auth background now uses Expo LinearGradient plus the existing local cabin image as a subtle decorative layer, so it works offline.
- Redesigned Splash, Login, and Sign-up with a consistent dark cabin-safety visual system and translucent form cards.
- Added direct Login <-> Create account navigation links.
- Phone number is now optional during registration.
- If a phone number is entered, it is validated loosely for 7-15 digits and common international formatting characters.
- Password and Confirm Password now have independent visibility controls.
- Added clearer password guidance and friendlier auth copy.
- Updated auth stack back-arrow tint for the dark background.
- All previous Seats image, scrolling, and persistent UAT warning changes remain untouched.
