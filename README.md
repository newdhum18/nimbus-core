# Nimbus Core V36

Current package: **Phase 10 Search Adapter Core v1.8.0**.

Runtime/package version: **36.6.0**.

Status: **Phase 10 passes local validation and is ready for GitHub branch validation. No production deployment is included or approved by this package.**

Phase 10 adds the versioned search-adapter contract, deterministic HTML/RSS adapters, target normalization, source ranking support, database migrations, queue/run foundations, and branch-only validation.

Official resources remain:
- Repository: `newdhum18/nimbus-core`
- Pages: `nimbus-core-v36-web`
- Worker: `nimbus-core-v36-worker`
- D1: `nimbus-core-v36-db`
- Queue: `nimbus-core-v36-queue`
- Bindings: `DB`, `QUEUE`

Validation:
```bash
npm ci --no-audit --no-fund --registry=https://registry.npmjs.org
npm run validate:source
npm run build:web
npm run check:cloudflare
npm run check:runtime
npm run check:config
```

Remote database or production deployment commands must not be run without explicit approval and backup evidence.
