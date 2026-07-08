# Nimbus Core V27 SourceBoost 5 Auto Batch

Version: 27-sourceboost.5-auto-batch

Main changes:
- One-button AutoScan now automatically splits work into many safe requests from the browser.
- 1000 built-in source catalog remains available without D1 seeding during every run.
- D1 is no longer used as a hot-path cache for every source fetch.
- Balanced source rotation prevents repeating the same first sources.
- Deep processing uses smaller safer batches across repeated calls.
- Designed to avoid Cloudflare Worker "Too many API requests by single Worker invocation" while preserving wide coverage.

Recommended Cloudflare setup:
- For Pages with _worker.js: Build command empty, Output directory '.', Root directory '/'.
- For Workers deploy screen: Deploy command `npx wrangler deploy`.
- Keep D1 binding name as `DB`.
