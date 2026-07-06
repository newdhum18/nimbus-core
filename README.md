# Nimbus Core

External alias for Mega Hunter Pro Monitor.

## Version
0.5.0 Real API Foundation

## What works in V5

- PWA dashboard
- PIN screen
- Real `/api/search`
- Real `/api/latest`
- Real `/api/protected`
- Real `/api/schema`
- D1 storage
- Free public discovery mode without Brave API
- MEGA link extraction
- Deduplication
- Protected source classification
- Auto Scan on app open
- Manual Search Now

## Required Cloudflare setup

Create D1 database and bind it to Pages as:

DB

Then open:

/api/schema

## Note

True background scheduled scanning requires a separate Cloudflare Worker with Cron Trigger.
V5 includes `cron-worker.js` for that future step.
