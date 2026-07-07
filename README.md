# Nimbus Core V24

Clean Link-First PWA for public indexed MEGA URL discovery.

## Critical V24 Fix
V24 no longer uses legacy tables such as `scan_state`, `mega_links`, or broken ALTER migrations. It creates isolated tables:

- nimbus_v24_links
- nimbus_v24_sources
- nimbus_v24_logs
- nimbus_v24_state

This avoids the D1 error: `table scan_state has no column named key`.

## Deploy
Upload the ZIP contents to GitHub root, wait for Cloudflare Pages deployment, then open:

`https://nimbus-core-6or.pages.dev/reset?v=24&fresh=1`

Then run:

1. Settings > Ping API
2. Settings > Check DB
3. Auto Scan
4. Manual Search

## Policy
Public indexed discovery only. No login/captcha/paywall/advertisement/unlock/private-system bypass.
