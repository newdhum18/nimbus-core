# Nimbus Core V36 D1 Migration Timeout Repair

Version: 36.13.8

## Root cause
The failed GitHub Action did not report an SQL syntax or schema error. Cloudflare D1 returned code 7429 because the remote storage operation exceeded its API timeout while Wrangler was applying migration 0012.

## Repair
- Added `scripts/apply-d1-migrations-remote.mjs`.
- Remote migration deployment now retries up to five times with increasing backoff.
- A retry is safe because Wrangler records applied D1 migrations; if the first request completed remotely but its response timed out, the next attempt detects that no migration remains.
- Added post-migration verification for the migration 0012 index and the discovered-source backfill state.
- Increased the migration workflow step timeout to eight minutes.
- Updated release version to 36.13.8.

## Verification
- 147/147 automated tests passed.
- Cloudflare Worker dry-run passed.
- Local D1 schema and idempotency checks passed.
- Local Worker runtime endpoints passed.
- Clean baseline verification passed.
- Release configuration passed.
