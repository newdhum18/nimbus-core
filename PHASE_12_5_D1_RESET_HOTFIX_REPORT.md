# Nimbus Core V36.8.4 — D1 Source Reset Hotfix

## Incident

GitHub Actions failed at `POST /api/sources/reset` with:

`D1_ERROR: too many SQL variables`

A subsequent local runtime test exposed a second migration edge case:

`UNIQUE constraint failed: sources.template_url`

## Root causes

1. The old reset used one `DELETE ... NOT IN (...)` query with all 300 catalog IDs bound at once.
2. Existing source rows could temporarily occupy template URLs needed by renamed or swapped catalog IDs.

## Fix

- Read the existing source snapshot first.
- Move existing template URLs to unique transaction-local placeholders.
- Delete obsolete rows using one bound ID per statement.
- Upsert all 300 catalog entries using one prepared statement per source.
- Submit the complete operation through one D1 `batch()` transaction so a failure rolls the reset back.

## Verification

- Automated tests: 109/109 PASS.
- Cloudflare Worker dry-run: PASS.
- D1 migrations and idempotency: PASS.
- Local Worker runtime:
  - `/health`: 200
  - `/bindings`: 200
  - `/api/foundation/db-test`: 200
  - `/api/sources/reset`: 200
  - `/api/diagnostics`: 200
- Restored catalog: 300 total / 80 default enabled.

## Status

SOURCE PASS — READY FOR GITHUB ACTIONS VERIFICATION.
