# Comprehensive Engineering Review

## Result

**Candidate 2 is locally ready for review.**

It is not yet a live-production PASS because the approved D1 database ID is not
present and no remote deployment was performed from this package.

## Corrections made from Draft 1

1. Removed `dist/` from source package.
2. Removed duplicate inventory file.
3. Added one npm lockfile policy.
4. Pinned Wrangler to `4.110.0`.
5. Added clean config and release validators.
6. Corrected CORS to allow only the approved Pages project and its previews.
7. Preserved CORS headers on error responses.
8. Added structured 404 and 405 responses.
9. Removed the incomplete Repair DB endpoint from this phase.
10. Added safe Queue batch dispatch.
11. Added automatic initial dispatch at run start.
12. Prevented Resume from blindly replaying queued tasks.
13. Added paused and cancelled run checks in Queue consumer.
14. Added task timestamps for queue/recovery control.
15. Added progress synchronization and run completion.
16. Corrected links to be unique per run, not globally.
17. Corrected page persistence to avoid invalid page references.
18. Added visited URL persistence.
19. Added source metrics and events.
20. Corrected source reset so enabled state is actually reset.
21. Eliminated duplicate source templates; catalogue is 300 unique entries.
22. Preserved exactly 80 default-enabled sources.
23. Hardened folder extraction:
    - file links rejected
    - missing key rejected
    - escaped URLs decoded
    - HTML entity fragments decoded
    - percent-encoded URLs decoded
24. Added public URL validation and response-size limits.
25. Added schema idempotence and single-active-run validation.
26. Added local Wrangler runtime validation.
27. Added Worker dry-run bundle validation.

## Local evidence

- Node tests: 41 passed, 0 failed.
- JavaScript syntax: PASS.
- Config validation: PASS.
- Web build: PASS.
- SQLite schema first run: PASS.
- SQLite schema second run: PASS.
- Approved table count: 11.
- Single active run index: PASS.
- Local Wrangler D1 schema application: PASS.
- Local `/health`: PASS.
- Local `/bindings`: PASS.
- Local D1 runtime query: PASS.
- Local source reset: 300 total / 80 enabled.
- Local diagnostics: PASS.
- Worker Wrangler dry-run: PASS.
- npm audit: 0 vulnerabilities.

## Deliberate release blocker

`wrangler.worker.jsonc` contains:

`REPLACE_WITH_APPROVED_D1_DATABASE_ID`

This is intentional. `npm run check:release` correctly fails until the real ID
is inserted.

## Remaining live tests

- Remote D1 schema application
- Remote Worker deployment
- Remote health/bindings/diagnostics
- Remote Queue retry
- Remote dead-task behavior
- Progressive 1/5/10/20/40/80 source tests
