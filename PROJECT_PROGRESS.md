# Project Progress - Nimbus Core V27 Rewrite

## Build type

Full rewrite from a clean directory.

## Verification performed

- `node --check _worker.js` passed.
- `node --check app.js` passed.
- Confirmed Queue schema contains `available_at`.
- Confirmed AutoScan UI button and `/api/autoscan` endpoint exist.
- Confirmed extractor is integrated into `/api/scan`, `/api/autoscan`, `/api/extract-url`, source processing, crawler processing, and Reddit comment processing.
- Confirmed all tables use `nimbus_v27_*` prefix.
- Confirmed no old version table names are present in generated code.

## Feature map

- Core Engine: included.
- Database V27: included.
- Search Engine: included.
- Source Manager: included.
- Crawler Engine: included.
- Extractor Engine: included.
- Link Health Checker: included.
- Queue Manager: included.
- Background Workers: included through Cloudflare scheduled handler; requires Cron Trigger to run automatically.
- Cache System: included.
- Reddit Engine: included for public posts/comments JSON.
- Result Processor: included.
- Statistics Dashboard: included.
- Export System: included.
- Diagnostics: included.
- User Interface: included.
- AutoScan: included.
- Auth/session/rate-compatible structure: included.
- Maintenance tools: included.
- Performance improvements: included with cache, indexes, queue limits, lazy result loading.
