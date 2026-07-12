# Phase 06 — Database Core

Status: **PASS (local implementation and verification)**

Parent engineering baseline:
`Nimbus-Core-V36-Phase-05-Final-Architecture-v1.3.0.zip`

Declared parent SHA-256 from the approved project record:
`e80109b75d39c512d72e170a9b46c0041f7ed10e3e7724bf0897cafb1f7b7acf`

Important evidence note: the uploaded `SHA-256(1).zip` resolved to the Phase 04 v1.2.1 package rather than the Phase 05 package. Phase 06 was therefore implemented against the uploaded clean GitHub repository and the controlling architecture decisions already incorporated in that repository. No claim is made that the Phase 05 ZIP itself was byte-verified in this run.

## Scope completed

- Replaced the placeholder migration marker with a real SHA-256 migration catalogue.
- Added `src/db/migrations/0001_initial.sql` as the authoritative initial migration.
- Kept `src/db/schema.sql` as a bootstrap mirror without a fake or hard-coded migration row.
- Added migration history integrity checks.
- Added repository modules for runs, tasks, sources, pages/links, events and settings.
- Added pagination indexes and operational indexes.
- Proved the single-active-run partial unique index locally.
- Proved foreign-key cascades locally.
- Proved schema idempotency across three consecutive applications.
- Proved the database contains exactly the approved eleven tables.
- Preserved the 20-row default and 25-row maximum batch limits.

## Approved tables

1. schema_migrations
2. runs
3. sources
4. run_tasks
5. source_metrics
6. pages
7. links
8. visited_urls
9. events
10. settings
11. dead_tasks

## Production safety

No remote D1 command was run. No Cloudflare resource was changed. No GitHub repository was modified. The package is a reviewable implementation candidate for upload and deployment after approval.

## Next phase

Phase 07 — Runtime and Run Lifecycle Core.
