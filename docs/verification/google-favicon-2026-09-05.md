# Google favicon and admin branding verification — 2026-09-05

## Implementation verification

- Backend branding tests: 9 passed, 31 assertions.
- React admin: 52 test files, 282 tests passed; TypeScript/Vite production build passed.
- Storefront: favicon route 8 tests passed; changed-file ESLint passed; Next.js production build passed and listed `ƒ /favicon.png`.
- `favicon-fallback.png`: PNG RGBA, 96×96, alpha range 0–255.
- `apple-touch-icon.png`: PNG RGBA, 180×180, alpha range 0–255.
- `frontend/public/favicon.png` is absent; `frontend/app/favicon.png/route.ts` is the sole owner of `/favicon.png`.
- Four planned commits are present on `feat/google-favicon-admin-branding`.

## Pre-deploy production snapshot

Production still serves the previous deployment:

- `/favicon.png`: HTTP 200, `image/png`, 3250 bytes, old `max-age=0` policy.
- `/favicon.ico`: HTTP 200, `image/x-icon` while payload was previously verified as PNG.
- `/apple-touch-icon.png`: HTTP 404.
- Homepage metadata still advertises `/favicon.png` as 100×100 for icon/shortcut/apple.

These live observations are expected before deployment and must not be treated as post-deploy acceptance.

## Required post-deploy checks

```bash
curl -I https://petposture.com/favicon.png
curl -I https://petposture.com/favicon.ico
curl -I https://petposture.com/apple-touch-icon.png
curl -s https://petposture.com | grep -iE 'rel="(icon|shortcut icon|apple-touch-icon)"'
```

Expected:

- `/favicon.png` returns HTTP 200, `Content-Type: image/png`, `X-Content-Type-Options: nosniff`, and the documented public/stale cache policy.
- Downloaded `/favicon.png` is exactly 96×96.
- No redirect to `api.petposture.com/storage/...`.
- Homepage metadata advertises `/favicon.png` at 96×96 and `/apple-touch-icon.png` at 180×180.
- `/favicon.ico` is no longer advertised; its server behavior may remain 404 after deployment.
- In staging/local failure simulation, settings/source/decode failures still return the 96×96 fallback with HTTP 200.

## Google Search Console

After deployment and successful live checks, use URL Inspection for `https://petposture.com/` and request indexing. Record the request date here. Google may take days or weeks to refresh the search favicon.

- Recrawl requested: **pending deployment/manual Search Console action**.

## GitNexus

The installed GitNexus CLI does not expose `detect-changes` (`unknown command`). Upstream impact checks were run before symbol edits; staged `git diff --check`, exact file scope, commit review, and independent code reviews were used as the available pre-commit substitutes. After deployment, run locally:

```bash
npx gitnexus analyze
```
