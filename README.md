# Nimbus Core V32 Core Rebuild

V32 rebuilds the operational core while preserving the existing Dashboard, AutoScan, Search, Extract, Archive, Sources, and Tools pages.

## Main corrections

- Queue task IDs are isolated by `run_id`, preventing one run from suppressing another run's tasks.
- D1 queue tasks use conditional claims, 90-second leases, expired-lease recovery, worker IDs, exponential retry delay, and dead-letter state.
- The queue consumer imports the shared worker core instead of duplicating the full application.
- `schema.sql` is now a complete canonical schema and the worker records schema versions.
- Runs store heartbeat and current stage data.
- Fetches use stable request headers, response-type classification, redirect following, and block/CAPTCHA detection.
- Per-source metrics record requests, successes, blocks, errors, candidates, valid links, and average response time.
- `/api/source-metrics` exposes measured source performance.
- MEGA folder-only rules, required keys, redirect decoding, raw paste variants, comment targets, Archive, CSV/JSON export, and the 100-link success target remain enabled.

## Deployment

1. Apply `schema.sql` to the D1 database or call `/api/db/repair` after deployment.
2. Deploy the Pages project using `wrangler.jsonc`.
3. Deploy the queue consumer using `wrangler.queue.jsonc` when Cloudflare Queues are enabled.
4. Bind D1 as `DB` and the queue producer as `QUEUE`.
5. Set `AUTH_PIN` or `NIMBUS_PIN` instead of relying on the development default.

## Verification

Run:

```bash
npm test
npm run check
```

Local tests verify syntax, MEGA folder filtering, missing-key rejection, file rejection, encoded-link extraction, redirect decoding, raw paste conversion, search-target parsing, source catalog size, and the default source policy.

Live search yield, third-party endpoint availability, Cloudflare Queue delivery, and D1 behavior under production concurrency must still be verified after deployment because they require the user's Cloudflare environment and external websites.
