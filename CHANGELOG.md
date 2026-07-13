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

## 36.6.1 — Phase 10 CI Registry Remediation
- Replaced environment-specific internal npm registry URLs in `package-lock.json` with public `registry.npmjs.org` URLs.
- Synchronized the lockfile package version with `package.json` at `36.6.0`.
- Pinned npm `10.9.2` in the branch validation workflow.
- Forced `npm ci` to use the public npm registry.
- Removed stale Phase 09 text from the Phase 10 README.
- No production deployment or remote database operation was performed.

## 36.7.0 — Phase 11 UX & Interface Modernization

- Rebuilt the mobile navigation into five clear primary areas: Dashboard, Search, Results, Sources, and System.
- Consolidated AutoScan, Keyword Search, Extract, and Archive into one Search workspace.
- Added a polished visual system, responsive cards, status indicators, loading states, and safer mobile controls.
- Improved Dashboard progress context and current-run visibility.
- Enhanced Results with Copy and Open actions.
- Replaced raw diagnostics-first presentation with health cards while preserving developer JSON details.
- Improved source cards, enabled-state visibility, small-screen behavior, safe-area support, and touch targets.
- Preserved all Phase 10 API routes and operational workflows.

## 36.8.0 — Phase 11.5 + Phase 12

- Final mobile UI/UX polish across Dashboard, Search, Results, Sources and System.
- Added Developer Center, complete system check, state-aware controls, compact history and maintenance tools.
- Removed raw JSON from normal user workflows.
- Added adaptive source selection and configurable multi-round run planning.
- Added result counts to run history and expanded source performance controls.
