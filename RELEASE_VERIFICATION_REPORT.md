# Nimbus Core V36.13.9 Release Verification Report

## Finding

The submitted v36.13.6 package was not release-ready because two tests still expected schema version 11 while migration 0012 made the effective schema version 12. The bundled reference database and resource manifest also remained at schema 11, and an obsolete hidden-files patch ZIP was still present.

## Corrections

- Synchronized all release/version assertions to v36.13.9.
- Synchronized all schema assertions and manifests to schema version 12.
- Applied migration 0012 to the clean backup database.
- Regenerated the SQL schema reference from the updated backup database.
- Removed the obsolete hidden-files patch archive.
- Added real SQLite integration tests for automatic promotion:
  - productive candidate → enabled executable source;
  - reachable zero-yield candidate → disabled sandbox source;
  - source metrics and candidate states are created/updated.

## Verification

- Automated tests: 147/147 PASS.
- npm audit: 0 vulnerabilities.
- Configuration validation: PASS.
- Release validation: PASS.
- Web build: PASS.
- Worker dry-run: PASS.
- D1 migrations 0001–0012: PASS.
- D1 idempotency: PASS.
- Clean baseline verification: PASS.
- Local Worker runtime endpoints: PASS.

## Remaining deployment gate

A production deployment must still apply migration 0012 remotely and complete one live Quick Source Discovery run. Local tests can prove database and promotion behavior, but cannot guarantee that external public sites return usable results from Cloudflare's network.
