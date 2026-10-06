# SafeSeat Seats Image Render Fix

Date: 2026-09-21

## Fix
- Replaced the Seats tab's nested `ImageBackground` + duplicated blurred car image with one explicit absolute-positioned `Image` inside the existing car-map container.
- Kept the existing gradients, seat-card positions, assignment logic, prototype indicator, and lock/monitoring behavior unchanged.
- Removed the now-unused `ImageBackground` import and replaced `carImage` styling with `carBackgroundImage`.

## Validation
- Confirmed `assets/images/appImgs/car-cropped.png` exists in the project and remains the image source.
- Existing regression suite: 6/7 tests pass; the remaining user-preferences/theme test failure is unrelated to this Seats image-rendering patch.
- Full TypeScript validation could not be completed in this environment because the dependency install did not finish cleanly before validation; no package/dependency files were intentionally changed by this patch.
