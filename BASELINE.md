# Nimbus Core V36 — Zero Foundation

This package is the canonical source baseline for future development. It merges the clean v36.13.0 foundation with every verified Phase 16.2 source-intelligence hardening change.

## Rules

1. Build future phases from this package or its merged `main` commit.
2. Apply numbered D1 migrations; do not import the SQLite backup directly into production.
3. Keep fixed Cloudflare resource names and bindings unchanged.
4. Do not commit secrets, local Wrangler state, generated builds, or runtime logs.
5. Require source validation, tests, baseline verification, build, and Cloudflare dry-run before merge.
