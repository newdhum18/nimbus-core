# Changelog

## 36.2.1 — Phase 06.1 Database Core Remediation

- Added migrations `0002_task_identity.sql` and `0003_source_seed.sql`.
- Added checksum-validating local migration runner and dry-run mode.
- Adopted Wrangler D1 migrations as the Cloudflare deployment path.
- Added deterministic 300/80 source seed.
- Added null-safe task identity uniqueness.
- Added schema inspection and local repair tools.
- Added upgrade, checksum drift, seed and nullable uniqueness tests.
- Updated Phase 06 status and remote migration/rollback documentation.
- No remote or production changes.

## 36.3.0 — Phase 07 Runtime and Run Lifecycle Core

- Added central run state machine and legal-transition enforcement.
- Added optimistic lifecycle transition service with durable events.
- Refactored pause, resume, cancel, completion, failure and recovery paths.
- Added explicit run recovery API action.
- Added terminal-state and concurrent-transition protection.
- Added Phase 07 lifecycle integration tests.
- Raised automated test count from 61 to 65.

## v1.6.0 — Phase 08 Queue Runtime

- Independently reviewed and accepted Phase 07.
- Added strict `nimbus.queue.v1` message contract.
- Added cross-run message rejection.
- Added expired lease reclamation and queue recovery service.
- Added producer rollback and bounded dispatch behavior.
- Added minimal versioned dead-task payloads.
- Added Phase 08 tests and documentation.
- Updated runtime version to 36.4.0.

## 36.5.0 — Phase 09 Source Manager Core

- Added searchable, filterable, sortable and paginated source management.
- Added source detail and source summary APIs.
- Added guarded bulk enable/disable operations.
- Added deterministic source ranking and advisory recommendations.
- Preserved 300 total sources and 80 approved enabled defaults.
- Added Phase 09 tests and documentation.

## 36.6.0 — Phase 10
- Added versioned Search Adapter contract.
- Added deterministic HTML/RSS adapters and target normalization.
- Added branch-only GitHub Actions validation with no deployment.
- Kept production deployment restricted to `main`.
