# Changelog

## 36.9.2 — Phase 13.2 Dynamic Source UI Hotfix

- Removed remaining fixed 300/80 labels from the Sources interface.
- Source model heading now reflects live total and enabled counts.
- Select All, Unselect All, and Restore Defaults confirmations are catalog-agnostic.
- Updated UI fallback version and release metadata.

## 36.9.1 — Phase 13.1 Dynamic Source Validation Hotfix

- Fixed GitHub Actions runtime validation that still required the retired 300-source / 80-enabled model.
- Runtime validation now reads `/api/sources/catalog` and validates the reset and diagnostics against the live autonomous catalog.
- Added catalog consistency tests for total, enabled count, unique IDs, unique templates, and excluded GitHub/YouTube sources.
- Updated round-count regression tests to be catalog-size agnostic.
- Preserved the legacy 300/80 migration test only as an upgrade-path invariant before autonomous reset.
- Synchronized package, runtime, tests, phase status, inventory, and checksums at version 36.9.1.

## 36.8.1 — Phase 12 multi-round task identity hotfix

- Fixed D1 `idx_tasks_identity` unique-constraint failures when starting AutoScan with multiple rounds.
- Added a deterministic client-only round fragment to each task URL so every source/round pair has a unique task identity without changing the fetched server URL.
- Added regression coverage for 100 unique rounds.

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

## 36.8.2 — Phase 12 Search Pipeline & Source Quality Remediation

- Fixed Dashboard Clear so hidden completed runs no longer remain in Dashboard counters.
- Added Select All and Unselect All controls for source management.
- Rebuilt the 300-source catalog around MEGA-relevant public indexes, paste sites, Reddit comments, and archive/web pages.
- Removed GitHub and YouTube from search sources.
- Disabled Bing by default and moved it to the lowest search priority tier.
- Added Meawfy public results API, Meawfy search, OfverseDrops search, and Reddit comments search as approved defaults.
- Added search-result target crawling so DDG/RSS result pages are followed and their page/comment text is scanned.
- Improved extraction from HTML, JSON, Markdown-style text, escaped slashes, HTML entities, and percent-encoded URLs.
- Preserved folder-only extraction and rejected file links.
- Added deterministic multi-round query diversification and regression coverage for 1, 25, and 100 rounds.
- Source reset now removes obsolete catalog entries before reseeding exactly 300 sources and 80 defaults.

## 36.8.4 — Phase 12.5 D1 source reset hotfix

- Replaced the 300-variable `NOT IN` reset query with one prepared statement per row.
- Made source reset a single transactional D1 `batch()` operation with automatic rollback on failure.
- Neutralized existing template URLs before upsert to prevent template swap/rename UNIQUE conflicts.
- Preserved enabled state when requested and retained original `created_at` values.
- Added regression coverage for SQL-variable limits, transactional failures, template collisions, 300/80 restore totals, and obsolete-source removal.
- Confirmed `/api/sources/reset` returns HTTP 200 in the local Worker runtime validation.

## 36.9.0 — Phase 13 Autonomous Source Intelligence
- Replaced synthetic 300-source catalog with 29 distinct public discovery surfaces.
- Added novelty-aware source learning (proven/observe/explore/cooldown/quarantine/disabled).
- Added 70/20/10 adaptive source selection per round.
- Added global duplicate detection and novel-link scoring.
- Added automatic source promotion, demotion, cooldown and quarantine.
- Added one-minute Queue watchdog and continuous dispatch pumping after success or retry.
- Added automatic catalog reconciliation before a new run.
- Added D1 migration 0004 for source intelligence metrics.
- Kept Bing as disabled reserve and excluded GitHub/YouTube sources.
