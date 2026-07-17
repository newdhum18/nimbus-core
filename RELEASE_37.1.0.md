# Nimbus Core V37.1.0 — Approved Sources Clean Rebuild

This release removes the previous runtime source catalog and replaces it with exactly six approved public note/paste sources:

1. rentry.co
2. controlc.com
3. justpaste.it
4. telegra.ph
5. pastemode.com
6. pastelink.net

All six are enabled by default and ordered by verified priority. Migration 0016 purges obsolete source rows and tombstones before inserting the clean catalog.

Validation completed:
- 187/187 automated tests passed.
- Source validation passed.
- Configuration validation passed.
- Release validation passed.
- Web assets built successfully.
- Baseline verification passed.
- Local D1 and Worker runtime validation passed, including /health, /bindings, /api/foundation/db-test, source catalog, source reset, and diagnostics.

A transient Cloudflare Request.cf network warning occurred in the isolated environment, but the local Worker started and every required runtime endpoint returned HTTP 200.
