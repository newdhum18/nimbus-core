# Zero Foundation Database References

- `nimbus-core-v36-zero.sqlite`: clean local reference database with schema version 11 and the current autonomous source catalog. It contains no runs, links, candidates, credentials, or production data.
- `DATABASE_SCHEMA_REFERENCE.sql`: numbered migrations concatenated in order for inspection and disaster-recovery planning.
- `RESOURCE_MANIFEST.json`: fixed Cloudflare resource names without credentials.

Use numbered migrations—not the SQLite file—to create or upgrade Cloudflare D1.
