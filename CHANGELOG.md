# Changelog

## 36.20.0
- Enforce strict manual source locking across every AutoScan/keyword round.
- Prevent source discovery from auto-enabling candidates while manual mode is active.
- Add direct public source creation and permanent deletion from the iPhone UI.
- Preserve user-added sources during catalog synchronization.
- Add regression tests for OfverseDrops → public Linkvertise target → PasteToday → MEGA extraction.

## 36.19.1 — PasteToday isolated validation correction

- Separated the direct PasteToday validation note from DuckDuckGo-based discovery.
- Added `pastetoday_search` as a distinct discovery source.
- Added production verification for migration 0013 and `extraction_recovery`.
- Updated source totals, tests, release identity, and deployment checks.

## 36.19.0-step3 — PasteToday Complete Runtime

- Added migration 0013 to allow the `pastetoday` source type in D1.
- Added durable extraction recovery evidence.
- Strengthened canonical/embed/endpoint traversal and escaped MEGA extraction.
- Connected Results Recovery to real extraction failures.
- Added isolated single-source PasteToday test protocol.


## 36.18.0-step2 — PasteToday Adapter

- Added a dedicated PasteToday search adapter and source type.
- Expanded every public PasteToday note into canonical and `/embed/<slug>` fetch surfaces.
- Added dynamic-page diagnostics for loading, embed, fetch/XHR, and client-render markers.
- Restricted PasteToday discovery results to PasteToday note URLs before recursive crawling.
- Added isolated adapter regression tests; no D1 migration is required.
## 36.16.1 — Stale Discovery Run Lock Reconciliation

- Reconciles active source-discovery runs before applying the single-run lock.
- Automatically finalizes completed task sets left with stale running status.
- Preserves protection against genuinely active, paused, or recovering duplicate runs.

# Changelog

## 36.16.0 — iPhone Source Intelligence and Extraction Recovery

- Added three iPhone-first Sources views: Control, Discovery, and Pipeline.
- Added persistent Automatic/Manual source governance.
- Added domain-level candidate evidence cards and clear promotion reasons.
- Added Results → Extraction Recovery for blocked, dynamic, encoded, and unresolved MEGA pages.
- Preserved note-first discovery, safe redirect decoding, folder-only extraction, and D1-safe queue processing.

# Nimbus Core V36 Changelog

## 36.15.0 — Adaptive Note-First Recursive Discovery Repair

- Recursively decodes nested redirect chains, including URL-encoded and Base64URL wrapper parameters.
- Prioritizes note, paste, raw, post and redirect surfaces before analytics and static assets.
- Expands controlled crawl depth to 4 and child-link selection to 24 with ranked filtering.
- Raises source-discovery fetch budgets moderately to 16 while preserving queue limits.
- Separates disabled sandbox registration from genuine active promotion.
- Promotes note/paste domains only after repeated extraction evidence or real novel/alive MEGA yield.
- Uses direct root crawling for qualified note-family sources instead of only a search-engine site template.
- Adds regression coverage for nested Linkvertise-style chains and target prioritization.
- Produces a clean source package and a separate deployment package.

## 36.14.0 — Domain-Accurate Source Promotion Repair

- Count discovery promotion at the host/domain level instead of inflating totals with URL-level candidate evidence rows.
- Count qualified domain transitions even when the executable source already exists and is refreshed.
- Report newly created source rows separately from promoted domains.
- Require novel or alive MEGA evidence before automatically enabling a discovered source.
- Preserve reachable zero-yield domains as disabled sandbox sources.
- Synchronize promoted candidate quality grades and add regression coverage for both accounting defects.

## 36.13.6 — Comprehensive Autonomous Source Promotion Repair

- Automatically catalogs successfully tested candidate domains instead of leaving them permanently in candidate storage.
- Activates candidates with real MEGA yield; keeps unproven but reachable candidates as disabled sandbox sources.
- Generates executable site-search templates for promoted domains.
- Adds source metrics at promotion time and synchronizes candidate/domain promotion state.
- Enables JSON and custom source records through the generic text/HTML target decoder.
- Adds migration 0012 for executable discovered sources and promotion indexing.


## 36.13.5 — Source Candidate Provenance Repair
- Fix candidate Foreign Keys for Source Discovery and AutoScan.
- Stop retrying permanent D1 schema errors.
- Canonicalize MEGA folder fingerprints.


## 36.13.3 — Source Recovery and Mobile UI Repair

- Decode DuckDuckGo, Google, and Bing search wrappers during source discovery.
- Profile discovered example pages before generic domain endpoints.
- Reduce Queue workload to two discovery tasks per message and six fetches per task.
- Reconcile source-discovery status and progress from live task counts.
- Make the first AutoScan round cover every explicitly enabled source.
- Compact and reorganize the Sources interface for iPhone.
- Add regression tests for wrapped target decoding and enabled-source AutoScan coverage.
- Remove the obsolete hidden-files patch archive from the runtime package.


## 36.14.0
- Added note-first recursive source discovery.
- Added nested/base64 redirect decoding for Linkvertise-style targets.
- Added note raw variants and deeper useful-page traversal.
- Increased discovery fetch budget and added regression tests.
