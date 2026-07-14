# Changelog

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

