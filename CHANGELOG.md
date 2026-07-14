# Changelog

## 36.13.8 — Promotion Verification and Baseline Synchronization

- Correct stale schema-version tests and release metadata after migration 0012.
- Upgrade the clean reference SQLite database and schema export to version 12.
- Add end-to-end database integration tests for active and sandbox source promotion.
- Remove the obsolete hidden-files patch archive from the package.
- Synchronize documentation, inventory, resource manifest, and checksums.

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

