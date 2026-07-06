# Nimbus Core

Version: 0.7.0 Polished UI + Results Fix

## What changed
- Fixed mobile layout and overflow issues.
- Latest results are shown as clean cards.
- Search results are shown as cards.
- Added filters for recent results.
- Added PWA icons.
- Updated service worker cache to V7.
- API returns more useful result data.

## Required
Cloudflare D1 binding must be named:

`DB`

## Test order
1. `/api/ping`
2. `/api/schema`
3. Login with `775224`
4. Latest → Auto Scan
5. Search Now
6. Protected
7. Add to iPhone Home Screen
