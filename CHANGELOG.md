# Changelog

## 36.13.9 — Domain-Accurate Source Promotion Repair

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

