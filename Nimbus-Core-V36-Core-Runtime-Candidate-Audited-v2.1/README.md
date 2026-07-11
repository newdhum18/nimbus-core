# Nimbus Core V36 Clean Foundation — Candidate 2

This package is the corrected modular core foundation for Nimbus Core V36.

## Status

**READY FOR REVIEW**

It is locally validated but has not been deployed from this package.

## Fixed identity

- Pages: `nimbus-core-v36-web`
- Worker: `nimbus-core-v36-worker`
- D1: `nimbus-core-v36-db`
- Queue: `nimbus-core-v36-queue`
- Bindings: `DB`, `QUEUE`
- Repository: `newdhum18/nimbus-core`
- Branch: `main`

## Important release gate

Before Worker deployment, replace:

`REPLACE_WITH_APPROVED_D1_DATABASE_ID`

with the actual ID of `nimbus-core-v36-db`.

Then run:

```bash
npm ci
npm run validate
npm run check:release
npm run db:apply:remote
npm run deploy:worker
```

Cron and Cloudflare Access remain disabled.
