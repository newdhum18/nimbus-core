# Phase 09 — Source Manager Core

## Status

`PASS LOCAL`

## Parent

- Package: `Nimbus-Core-V36-Phase-08-Queue-Runtime-v1.6.0.zip`
- SHA-256: `60727b4ecca48976a3dc2743d29ac3573733b82825cf0cba02e1176e513ff689`

## Implemented scope

- Preserved the approved catalogue invariant of 300 sources and 80 enabled defaults.
- Added filtered, searchable, sortable and paginated source listing.
- Added source detail and aggregate summary endpoints.
- Added guarded single-source, bulk and all-source enable/disable operations.
- Retained the hard rule that source configuration cannot change while a run is running, paused or recovering.
- Added deterministic performance ranking based on yield, success, latency, timeout, block and failure data.
- Added advisory recommendations only; sources are never automatically disabled by metrics.
- Added explicit rank refresh operation guarded by the active-run rule.
- Kept source reset idempotent and preserved current enablement unless restoring approved defaults.

## API

- `GET /api/sources`
  - Filters: `enabled`, `category`, `source_type`, `search`
  - Sort: `priority`, `rank`, `yield`, `name`, `failures`
  - Pagination: `limit`, `offset`
- `GET /api/sources/:id`
- `GET /api/sources/summary`
- `POST /api/sources/:id/enable`
- `POST /api/sources/:id/disable`
- `POST /api/sources/bulk`
- `POST /api/sources/ranks/refresh`
- `POST /api/sources/reset`
- `POST /api/sources/high-yield-defaults`
- `POST /api/sources/enable-all`
- `POST /api/sources/disable-all`

## Safety invariants

1. No source mutation during `running`, `paused` or `recovering` runs.
2. Bulk source IDs are unique, validated and limited to 300.
3. Ranking is deterministic and bounded from 0 to 100.
4. Metric recommendations are advisory and cannot change enablement automatically.
5. The approved default restoration always returns to the catalogue's 80 enabled defaults.
6. Run task URLs remain snapshots created at run start, so later source changes cannot alter existing tasks.

## Out of scope

- Live source fetching.
- Automatic source disabling.
- Production D1 validation.
- Source Manager dashboard UI.
- Search engine adapter implementation.
