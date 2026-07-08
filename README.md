# Nimbus Core V27.1 Fixed AutoScan Build

This build fixes the D1 schema migration error reported in V27.0:

`D1_ERROR: no such column: available_at`

## What changed

- Self-healing database migration in `ensureSchema()`.
- Adds missing columns with `ALTER TABLE` when upgrading an existing V27 database.
- Fixes `queue.available_at`, `locked_at`, `updated_at`, and related queue fields.
- Adds a visible **AutoScan** button.
- Adds `/api/autoscan` to run search + several queue-processing cycles in one action.
- Keeps `Start Scan` for adding tasks only.
- Keeps `Process Queue` for manual queue processing.
- Keeps Check DB, Diagnostics, Clean Data, Reset Cursor.
- Fixes authenticated export using fetch instead of direct unauthenticated location redirect.

## First run after upload

Open:

`/reset?v=27.1&fresh=1`

Then run:

1. Login
2. Check DB
3. Clean Data
4. AutoScan
5. Process Queue if queue still has tasks
6. Check Batch

## Features present

- Multi-source engine
- Deduplication cleaner
- V27 D1 database schema
- Improved UI
- Link Health Checker
- Multi-page crawler
- JSON Source Engine
- Simple plugin-style sources
- Reddit public search scraper
- Queue Manager
- Background scheduled hook
- Cache System
- Statistics Dashboard
- AutoScan
