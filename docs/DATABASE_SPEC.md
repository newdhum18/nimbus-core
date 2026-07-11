# Database Specification

Authoritative schema:
`src/db/schema.sql`

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

No version-prefixed tables are permitted.

Batching:
- default 20
- initial maximum 25
