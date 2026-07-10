# Nimbus Core V34 — Resilient Orchestrator

- One persistent run with non-wrapping source cursor.
- Cloudflare Queue producer/consumer activated with stable task IDs and D1 shadow state.
- Cron fallback every five minutes.
- Real Pause/Resume checks in UI, API, D1 processor, and queue consumer.
- Monotonic two-phase progress: source discovery then queue draining.
- Source and crawl URL deduplication for 30 days.
- Accurate enqueue counts based on D1 changes.
- Removed cross-run global queue fallback.
- Unified health states: valid, dead, unknown/unverified.
- Circuit breaker: five consecutive failures trigger a 30-minute cooldown.
- Separate scan-progress and result-target bars.
- Server polling UI: Safari observes work instead of owning the cloud-queue loop.
