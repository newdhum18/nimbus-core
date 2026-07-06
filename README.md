# Nimbus Core

Version: 1.2.0 V12 Global AutoScan

## What changed
- Removed any fixed/default keyword from Auto Scan.
- Auto Scan now searches general public MEGA link patterns.
- Added 50+ countries including Russia.
- Country selections now affect query generation, not just UI.
- Added rotating batch cursor using D1 `scan_state`.
- Added optional Brave API support with `BRAVE_API_KEY`.
- Increased source list and paste/rentry focused queries.
- `.onion` sources are stored as Tor-only/manual sources because Cloudflare cannot access Tor directly.

## Required Cloudflare Variables
- AUTH_PIN
- Optional AUTH_SECRET
- Optional BRAVE_API_KEY

## Required Binding
- DB

## Test order
1. Upload V12.
2. Redeploy.
3. Open `?v=12&fresh=1`.
4. Login.
5. Settings → Clear App Cache if old version appears.
6. Settings → Check DB.
7. Auto Scan Batch with empty keyword.
