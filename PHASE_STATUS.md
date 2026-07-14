# Nimbus Core V36 — Zero Foundation Status

- Version: 36.13.2
- Baseline: Zero Foundation
- Source lineage: Clean Baseline v36.13.0 + complete Phase 16.2 hardening merge
- Schema version: 10
- Runtime resources:
  - Pages: nimbus-core-v36-web
  - Worker: nimbus-core-v36-worker
  - D1: nimbus-core-v36-db
  - Queue: nimbus-core-v36-queue
  - Bindings: DB / QUEUE
- Source catalog: autonomous, dynamic, and expandable
- Queue strategy: packed task envelopes with conservative concurrency
- Status: SOURCE PASS — deployment verification required before main merge

## Included hardening

- Background source discovery through Cloudflare Queue and watchdog.
- D1-safe chunked discovery-task creation.
- Domain-level candidate aggregation and source quality grading.
- Source graph provenance with source ID, host, fingerprint, and evidence URL.
- Link reappearance tracking and partial-run outcome reporting.
- MEGA structural validation with conservative alive/dead/unknown semantics.
- Queue-efficient envelopes: 8 discovery tasks per message, 32 tasks per dispatch.
- Clean backup database and reproducible migration reference.
