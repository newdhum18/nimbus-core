# Known Issues — Runtime Candidate v2.0

## Deployment blocker

`wrangler.worker.jsonc` still contains `REPLACE_WITH_APPROVED_D1_DATABASE_ID`.
It must be replaced by the real ID for `nimbus-core-v36-db` before any Worker deploy.

## Not yet production-proven

- Remote D1 schema application.
- Long live Queue run.
- Retry-to-dead path under Cloudflare delivery.
- Live-source availability and blocking behavior.
- Link health classification.
- Cloudflare Access.
- Cron recovery.

## Deliberately deferred

- Browser Rendering.
- Automated source disabling/re-enabling.
- Scheduled AutoScan.
- Advanced health checker.
