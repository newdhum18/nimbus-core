# Nimbus Core V36.13.2 — Source Recovery and Mobile UI Repair

## Scope

This maintenance release was built from the current GitHub `main` ZIP supplied by the user. It preserves the Zero Foundation database schema and resource names while repairing Source Discovery, AutoScan coverage, Cloudflare Queue workload, progress reconciliation, and the mobile Sources interface.

## Root causes found

1. Source Discovery parsed ordinary links but did not consistently decode search-engine redirect wrappers. DuckDuckGo `uddg=`, Google `/url?q=`, and Bing redirect targets could therefore remain hidden behind search hosts and be rejected.
2. A Source Discovery Queue message could contain eight heavy tasks, while every task could use up to eighteen fetches. A single message could therefore attempt a very large crawl workload and terminate partway through on Cloudflare.
3. Source Discovery progress was displayed from a stored value that could become stale. A run could show `100% partial` while pending tasks still existed.
4. The first AutoScan round used adaptive filtering immediately. Sources with historical cooldown/quarantine data could reduce a one-round scan from 26 enabled sources to only a small subset.
5. The Sources interface used large cards, long labels, and a single-column flow, making progress and candidate panels difficult to view together on iPhone.
6. The uploaded repository contained an obsolete hidden-files patch ZIP that is not part of the runtime application.

## Repairs

### Source Discovery extraction

- Added search-target decoding through the existing Target Decoder before raw HTML/JSON URL extraction.
- Preserved filtering of MEGA and search-engine hosts after targets are decoded.
- Added Bing RSS as an occasional reserve discovery surface while keeping DuckDuckGo HTML/Lite as the main discovery providers.
- Domain profiling now tests discovered example pages before generic root, sitemap, RSS, feed, archive, and recent endpoints.

### Source Discovery runtime

- Reduced Source Discovery dispatch from 32 tasks to 16 tasks per dispatch.
- Reduced Source Discovery Queue envelopes from 8 tasks to 2 tasks per message.
- Reduced the per-task fetch budget from 18 to 6.
- Reduced direct fallback fetch budget from 12 to 6.
- Reconciles run status and progress from actual task states every time the run is read.
- The UI calculates progress from completed, failed, dead, and cancelled task counts rather than trusting a stale stored percentage.

These changes prioritize completion reliability. A 200-task scan now uses smaller, bounded Queue workloads rather than a few oversized messages.

### AutoScan

- The first AutoScan round now includes every source explicitly enabled by the user, up to the catalog limit.
- Later rounds continue to use adaptive source intelligence.
- A one-round scan with 26 enabled sources now creates 26 source tasks rather than being reduced by historical source-state filtering.

### Sources mobile interface

- Combined Source Discovery and Candidate Pipeline into a responsive two-panel workspace on wide screens and a compact stacked workspace on iPhone.
- Reduced card padding, title sizes, field heights, progress height, and metric sizes.
- Changed long labels to compact labels such as `NEW`, `DONE`, `On`, `Off`, `Y`, `F`, `P`, and `R`.
- Reorganized discovery controls into a compact three-column button grid.
- Shortened `Dispatch pending tasks` to `Dispatch`.
- Added bounded candidate-list scrolling so the control and candidate panels remain visible together.
- Compacted source rows and prevented metadata lines from wrapping across multiple lines.

### Cleanup and versioning

- Removed the obsolete `Nimbus-Core-V36-Zero-Foundation-Hidden-Files-Patch.zip` from the project root.
- Updated package, runtime, documentation, manifest, inventory, and verification version to `36.13.2`.
- No database migration was added; schema version remains 10.
- Cloudflare resource names remain unchanged.

## Validation

- Automated tests: 139 / 139 PASS.
- Configuration validation: PASS.
- Release validation: PASS.
- Web build: PASS.
- Worker dry-run: PASS.
- npm audit: 0 vulnerabilities.
- Clean baseline verification: PASS.
- Local D1 migrations: PASS.
- Local Worker runtime endpoints: PASS.
  - `/health` 200
  - `/bindings` 200
  - `/api/foundation/db-test` 200
  - `/api/sources/catalog` 200
  - `/api/sources/reset` 200
  - `/api/diagnostics` 200

Wrangler emitted a temporary `Request.cf` network warning during local startup, then used its fallback and completed runtime validation successfully.
