# Remote D1 Migration and Rollback Plan

## Safety rule
No command in this document is authorized automatically. Production execution requires explicit approval and a verified backup.

## Pre-flight
1. Confirm package SHA-256 and clean working tree.
2. Confirm `nimbus-core-v36-db`, binding `DB`, and the correct Cloudflare account.
3. Export/backup the remote database using the supported Wrangler/D1 export workflow.
4. Store the backup outside the repository and record its SHA-256.
5. Run `npm run validate:source`.
6. Run local migrations and inspection on a fresh disposable local database.
7. Prefer a disposable remote D1 database first; do not test first on production.

## Controlled apply
1. List pending migrations with Wrangler.
2. Review each SQL file and checksum.
3. Apply to the disposable D1 database.
4. Verify 11 tables, required indexes, migration records, 300 sources and 80 enabled.
5. Run Worker smoke tests against the disposable database.
6. Only after approval, run `npm run db:apply:remote` against the official database.
7. Wrangler captures a backup when applying D1 migrations; retain the command output as evidence.

## Stop conditions
Stop immediately on checksum mismatch, unknown migration, unexpected table/index, source counts other than 300/80, foreign-key failure, duplicate task identity, or any partial migration error.

## Rollback/recovery
DDL rollback is restore-based, not an automatic down-migration. Do not run destructive reverse SQL on production. Restore from the verified pre-migration backup, redeploy the last known-good Worker package, and re-run inspection before reopening traffic.

## Evidence required for final remote approval
- Backup identifier and SHA-256
- Disposable D1 test output
- Pending/applied migration list
- Post-migration inspection output
- Worker health and bindings output
- Rollback readiness confirmation
