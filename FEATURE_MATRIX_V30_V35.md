# Feature Matrix V30–V35 — Foundation Decisions

| Feature | Decision | V36 implementation direction |
|---|---|---|
| Dashboard | REWRITE | Modular static frontend with clear API states |
| AutoScan | REWRITE | Persistent run, rounds, pause/resume, no replay |
| Keyword Search | REWRITE | Independent run and results |
| Archive | REWRITE | Unified pages/links/evidence model |
| 300 sources / 80 enabled | KEEP REQUIREMENT | Modular catalogue and metrics |
| Source enable/disable/reset | REWRITE | Batched upsert, blocked during active run |
| Diagnostics | REWRITE | Worker/D1/Queue/run/source status |
| Repair DB | DEFER | Idempotent phase after migrations |
| JSON/CSV export | KEEP REQUIREMENT | Dedicated later module |
| MEGA folder extraction | KEEP REQUIREMENT | Modern folder required; legacy optional |
| MEGA file links | REMOVE | Always reject |
| Redirect decoding | REWRITE | Safe redirect module and validated crawl redirects |
| Deduplication | KEEP REQUIREMENT | Per-run normalized URL uniqueness |
| Queue producer/consumer | REWRITE | Modular producer/consumer/lease/retry |
| Pause/Resume/Cancel | KEEP REQUIREMENT | Same run_id, no completed replay |
| Progress persistence | KEEP REQUIREMENT | Derived from terminal task states |
| Metrics | REWRITE | Unified source_metrics table |
| Internal PIN/login/token | REMOVE | Cloudflare Access in Phase 19 |
| Cron | DEFER | Only after live tests |
| Custom CPU limits | REMOVE | Platform defaults |
| Versioned tables | REMOVE | Unified V36 schema |
| Monolithic `_worker.js` | REMOVE | Small worker entry and modules |
| Duplicate consumer Worker file | REMOVE | One Worker service |
