# Nimbus Core Feature Matrix — V28 to V36

Status: FINAL ENGINEERING DECISION BASELINE

Notes:
- No V33 package exists.
- The supplied failed V36 package is failure evidence only and is never an implementation source.
- V28–V35 are requirement and failure references; V36 code is rewritten modularly.

| Area | Historical evidence | Final decision | V36 implementation |
|---|---|---|---|
| Browser-driven AutoPilot | V28–V32 stopped when Safari suspended the tab | REMOVE | Server-owned run state and Queue consumer |
| Persistent run_id | Requested repeatedly; V32 created repeated runs | KEEP / REWRITE | One run, durable task rows, same run_id on resume |
| Queue follow-up dispatch | V34.2 fixed waiting for Cron | KEEP | Consumer dispatches next pending slice after ack |
| Cron as primary engine | Caused visible five-minute pauses | REMOVE | Cron deferred as recovery only after live tests |
| Pause / Resume / Cancel | Required and partially present in V34/V35 | KEEP / REWRITE | Explicit state transitions and no completed replay |
| Source catalogue | 1000 templated entries caused cost and reset failures | REWRITE | 300 deterministic entries, 80 enabled defaults |
| Source ON/OFF | Required | KEEP | API with active-run lock |
| Source reset | Delete-all and giant UPSERT were unsafe | REWRITE | Batched idempotent upsert, preserves state by default |
| Source metrics | Earlier elapsed values were unreliable | REWRITE | Request, success, failure, timeout, block, latency, yield |
| Keyword Search | Required separate from AutoScan | REWRITE | Independent keyword run |
| AutoScan | Required without keyword | REWRITE | Stable round query, enabled sources only |
| Deep crawl | Unbounded crawling risks limits | REWRITE | Depth 2, 10 child links, 20 pages/task maximum |
| MEGA folder links | Core requirement | KEEP | Modern folder required; legacy optional |
| MEGA file links | Explicitly excluded | REMOVE | Always rejected |
| Missing key / malformed links | False positives in earlier versions | REMOVE | Strict validator |
| Redirect decoding | Useful but unsafe when unrestricted | REWRITE | Validated public HTTP redirects only |
| Archive | Required | REWRITE | Unified pages + links + evidence model |
| Link health | Earlier all Unknown | DEFER | Separate validated phase after core runtime |
| D1 schema | Versioned tables accumulated | REWRITE | Eleven version-neutral tables |
| Repair DB | Earlier repair mixed source seeding and giant writes | REWRITE | Idempotent inspection, recovery, batched seed |
| Worker architecture | Monolithic `_worker.js` became unmaintainable | REMOVE | Small entry + router + domain modules |
| Queue worker duplication | Separate worker/config names conflicted | REMOVE | One Worker service with fetch and queue handlers |
| Pages backend bindings | Unneeded for static frontend | REMOVE | Pages static-only; Worker owns DB and Queue |
| Internal PIN / login | Not acceptable as final protection | REMOVE | Cloudflare Access deferred to Phase 19 |
| JSON / CSV export | Required | KEEP | Results service with stable export endpoints |
| Diagnostics | Required for operations | REWRITE | Worker, bindings, D1, Queue, runs, tasks, sources |
| Free-plan safety | Custom limits and high concurrency caused failures | KEEP | No custom CPU limit; batch 1 and concurrency 1 initially |
| Browser rendering | Expensive and not foundational | DEFER | Only for explicitly approved sources later |
| Failed V36 package | Included only to identify mistakes | REMOVE | No code copied or adopted |
