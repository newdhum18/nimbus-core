# Nimbus Core V36 — Phase 06.1 Database Core Remediation & Final Gate

Status: PASS (local final gate)
Version: 36.2.1
Parent package: Nimbus-Core-V36-Phase-06-Database-Core-v1.4.0
Parent SHA-256: 1db5bab3c2c5d329d8429953a8c0a34e24c8bbff69621a05eae7b6bdea4482d9
Phase 05 reference SHA-256: e80109b75d39c512d72e170a9b46c0041f7ed10e3e7724bf0897cafb1f7b7acf

## Closed audit findings

1. Added executable checksum-validating local migration runner.
2. Replaced direct `schema.sql` npm apply commands with Wrangler D1 migrations.
3. Added upgrade-path validation from migration 1 to the latest schema.
4. Added deterministic database seed: 300 sources, 80 enabled.
5. Added non-mutating local schema inspection and drift report.
6. Executed repair three times successfully and idempotently.
7. Added null-safe task identity index using `COALESCE(source_id, '')`.
8. Added controlled remote migration and rollback plan.
9. Updated stale Phase 06 documentation and status.
10. Kept production D1 untouched; disposable/production Cloudflare execution remains an explicit operator gate.

## Authoritative migration path

- Migration directory: `src/db/migrations`
- Wrangler config: `migrations_dir = src/db/migrations`
- Local Cloudflare apply: `npm run db:apply:local`
- Remote apply: `npm run db:apply:remote` only after backup and approval
- Local standalone validation runner: `npm run db:migrate:local -- --database=<path>`
- Dry run: `npm run db:migrate:dry -- --database=<path>`

`src/db/schema.sql` is a generated compatibility snapshot of the ordered migrations and is not an independent deployment path.

## Final local evidence

- Full tests: 61 passed, 0 failed, 0 skipped
- Source validation: PASS
- Web build: PASS
- Clean: PASS
- Fresh migration: PASS
- Upgrade migration: PASS
- Dry-run after apply: 0 pending
- Schema inspection: 11 tables, 3 migrations, 300 sources, 80 enabled
- Repair execution x3: PASS
- Remote/production changes: NONE

## Phase gate

Phase 06 is closed locally as PASS FINAL. Phase 07 may begin from this package. Before any production D1 migration, follow `docs/phase06/REMOTE_D1_MIGRATION_AND_ROLLBACK.md` and obtain explicit approval.
