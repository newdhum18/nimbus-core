# Nimbus Core V36 — Phase 10 UI Recovery v1.9.1

Runtime version: `36.6.0`

Status: operational iPhone UI integrated with the current V36 run, queue, results, source, and diagnostics APIs.

This package supports real AutoScan and Keyword Search execution through the deployed V36 Worker. It replaces the Foundation placeholder page and adds rendered-output contract tests.


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

## Security gate for operational deployment

Before exposing the operational UI publicly, protect the Pages application and Worker with Cloudflare Access or an equivalent approved authentication layer. The interface can create real AutoScan and Keyword runs that consume Queue, D1, and outbound Worker resources.

Preview testing also targets the configured production Worker API unless a separate API base is supplied. Use a controlled test window and do not treat CORS as authentication.
