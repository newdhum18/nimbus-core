# Nimbus Core V27 Rewrite

Fresh rebuild from an empty structure. This package does not reuse old V24/V25/V26/V27 files.

## What is included

- New UI and new menu layout.
- Integrated extractor inside the main system.
- Cloudflare Pages `_worker.js` API.
- D1 tables with prefix `nimbus_v27_*`.
- Automatic DB creation and repair.
- Multi-source engine: RSS, HTML, JSON, Reddit JSON, targeted public sources.
- Plugin-style source manager.
- AutoScan endpoint and button.
- Queue Manager with priority, attempts, retry timing, and `available_at` column.
- Background `scheduled()` hook for Cloudflare Cron.
- Cache System for requests and pages.
- Multi-page crawler with depth limits, next-page detection, and loop prevention by queue/database uniqueness.
- Reddit Engine for public posts and comments JSON.
- MEGA link extractor for `mega.nz/file` and `mega.nz/folder` with key fragments.
- Link Health Checker: Alive / Dead / Unknown using public HTTP checks.
- Statistics dashboard.
- CSV and JSON export.
- Diagnostics, Repair DB, Clean Data, Reset Queue, Reset Cache, Reset AutoScan Cursor, Ping API.
- Auth by PIN + session cookie. Set `NIMBUS_PIN` in Cloudflare. Default development PIN is `0000`.

## Deploy

Upload all root files to the GitHub repository root used by Cloudflare Pages.

Required Cloudflare binding:

- D1 database binding name: `DB`

Optional environment variables:

- `NIMBUS_PIN`: login PIN.
- `NIMBUS_API_TOKEN`: optional bearer token for API usage.

After deployment open:

```text
/reset?v=27&fresh=1
```

Then:

1. Login
2. Check DB
3. AutoScan
4. Process Queue
5. Check Batch

## Notes

This rewrite is designed around public-source discovery and indexing. The separate search-protection/content-policy module requested for a later version is not included in this build.
