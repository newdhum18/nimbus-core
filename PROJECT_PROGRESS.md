# Nimbus Core Project Progress

## Real project name
Mega Hunter Pro Monitor

## External alias
Nimbus Core

## Version
0.5.0 Real API Foundation

## Completed

- Project email created
- GitHub account created
- Repository: nimbus-core
- Cloudflare account created
- Cloudflare Pages connected
- V3 uploaded and tested
- Brave API reviewed and postponed because paid plan is required
- V5 built without Brave API

## V5 features

- Free public discovery mode
- Cloudflare Pages Advanced Mode `_worker.js`
- API routes:
  - /api/schema
  - /api/search
  - /api/latest
  - /api/protected
- D1 database support
- Extract MEGA links from public pages
- Deduplicate links
- Save protected/login-required sources separately
- Auto Scan on app open
- Manual Search Now

## Still required

1. Create Cloudflare D1 database:
   nimbus_core_db

2. Bind it to Pages project as:
   DB

3. Upload V5 files to GitHub.

4. Open:
   https://YOUR-PAGES-DOMAIN/api/schema

5. Open app and press:
   Auto Scan Now

## Important limitation

V5 auto scan runs when the app opens or when Auto Scan Now is pressed.
True background scanning without opening the app requires a separate Cloudflare Worker Cron Trigger in V6.
