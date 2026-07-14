# Nimbus Core V36.13.9 Source Promotion Accounting Repair

## Root cause

The discovery pipeline correctly aggregates candidates by host in `source_candidate_domains`, but the source summary counted URL-level rows from `source_candidates`. A single host can produce many URL evidence rows, so the database showed 131 promoted candidate rows while the executable source catalog contained only a small number of distinct source hosts.

A second accounting defect counted only newly inserted `sources` rows as promoted. When an already-existing discovered source was refreshed, the domain transitioned to `promoted` but the run counter did not increase.

A third quality issue treated any extracted HTTP link as proof sufficient to auto-enable a source. This could activate noisy domains that produced no novel or alive MEGA evidence.

## Repairs

- Source summary now uses `source_candidate_domains`, the host-level authority.
- Promotion totals count every qualified domain transition, including existing source refreshes.
- New source creation is reported separately as `created`.
- Automatic activation now requires `novel_links > 0` or `alive_links > 0`.
- Reachable zero-yield domains remain available as disabled sandbox sources.
- URL-level candidate quality grades are synchronized when their host is promoted.
- Added regression tests for existing-source refresh counting and zero-yield activation prevention.

## Expected behavior after deployment

- The UI promoted count represents distinct promoted domains, not duplicate URL evidence rows.
- A run can report promoted domains even when the corresponding source row already existed.
- Newly discovered low-evidence domains are preserved but disabled until they produce useful evidence.
