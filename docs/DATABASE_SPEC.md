# Database Specification — Phase 06 Approved

Authoritative migration:
`src/db/migrations/0001_initial.sql`

Bootstrap mirror:
`src/db/schema.sql`

Migration catalogue:
`src/db/migration-catalog.js`

Approved tables:
- schema_migrations
- runs
- run_tasks
- sources
- source_metrics
- pages
- links
- visited_urls
- events
- settings
- dead_tasks

Rules:
- No version-prefixed business tables.
- D1 is the durable source of truth.
- Queue messages carry identity only; records are reloaded from D1.
- Migration records use real SHA-256 checksums.
- Migration history mismatch is a hard failure.
- Bulk writes use batches of 20 and never exceed 25 in the initial release.
- All list/read models use explicit limits.
- One run may be active (`running`, `paused`, or `recovering`) at a time.
- Links are unique per run, not globally.
- Remote migration execution requires explicit approval and a backup/rollback checkpoint.
