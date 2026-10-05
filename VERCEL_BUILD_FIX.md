# SafeSeat Web Demo R1.1 — Vercel Build Fix

This patch fixes the Vercel TypeScript configuration failure reported on 2026-10-05.

## Changes
- `npm run build` now uses `vite build`, which is the correct production bundle command for this Vite SPA.
- Added `npm run typecheck` as a separate static TypeScript check.
- Added `noEmit: true` to `tsconfig.node.json` so `allowImportingTsExtensions` satisfies TypeScript 5.8 requirements.
- No SafeSeat UI, demo behavior, or responsive phone-shell design was changed.

## Vercel
- Framework preset: Vite
- Build command: `npm run build`
- Output directory: `dist`
