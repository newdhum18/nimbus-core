# Nimbus Core V32 Test Report

Version: `32.0-core-rebuild`

## Passed locally

- `_worker.js` syntax check.
- `queue-consumer.js` syntax check.
- Complete folder link accepted.
- MEGA file link rejected.
- Folder without key rejected.
- New-format folder parts parsed.
- Direct MEGA extraction.
- Percent-encoded redirect extraction.
- Pastebin raw conversion.
- Rentry raw conversion.
- DuckDuckGo target decoding.
- Search target parser follows decoded result.
- Source catalog contains exactly 1000 records.
- Default source policy enables exactly 107 records.
- Queue IDs now include `run_id`.
- Queue claim is conditional on pending state.
- Queue leases, recovery, worker identity, exponential retry, and dead-letter state are present.
- Canonical D1 schema is present in `schema.sql`.
- Queue consumer no longer duplicates the full worker source.

## Not falsely marked as passed

The following require a deployed Cloudflare environment and live network testing:

- D1 production migration against the user's existing database.
- Queue producer-to-consumer delivery.
- Multiple concurrent Worker instances.
- Live Meawfy response schema and availability.
- Live Google, Brave, DuckDuckGo, Startpage, Bing, Reddit, GitHub, Telegram, and Archive behavior.
- CAPTCHA and rate-limit behavior from Cloudflare IP ranges.
- Browser-rendered JavaScript-heavy comments. V32 detects blocked/dynamic responses but does not include a provisioned headless-browser binding.
- Actual number of live MEGA folders returned by third-party sources.

Local result: **PASS**  
Production/live-source result: **requires deployment verification**
