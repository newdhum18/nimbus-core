# Nimbus Core V37.1.1 Comprehensive Audit

## Scope
Full static and executable audit of extraction, source discovery, D1 migrations, Worker runtime, Pages build, GitHub package hygiene and Cloudflare deployment configuration.

## Findings corrected
1. Obsolete PasteToday and OfverseDrops adapters were still imported by the queue runtime despite the six-source catalog. They were removed.
2. Target variants still contained Pastebin, Paste.ee, dpaste, Reddit and Pastetoday paths. They were reduced to the approved domains only.
3. Automatic discovery could create and enable arbitrary discovered sources. Discovery is now candidate-only outside the approved host allowlist and marks such domains `manual_approval_required`.
4. Source reset preserved `user_*` rows and could omit approved rows because of tombstones. Reset now deterministically restores exactly six approved sources and deletes every other row.
5. Fresh schema still allowed obsolete adapter types. Active schema now allows only `html`, `rss`, `json`, and `custom`. Historical migrations remain unchanged for upgrade safety.
6. Runtime tests were updated to reject obsolete active adapters and verify exact six-source behavior.

## Approved runtime sources
- rentry.co
- controlc.com
- justpaste.it
- telegra.ph
- pastemode.com
- pastelink.net

## Verification
- npm dependency audit: 0 vulnerabilities
- Node tests: 174 passed, 0 failed
- Configuration validation: PASS
- Cloudflare Worker dry-run: PASS
- Local D1 schema application and idempotency: PASS
- Pages build: PASS
- Release validation: PASS
- Local Worker endpoints: /health, /bindings, /api/foundation/db-test, /api/sources/catalog, /api/sources/reset and /api/diagnostics returned HTTP 200

## Deployment note
The local Wrangler runtime may print a non-fatal `workers.cloudflare.com` DNS/Request.cf warning in restricted or offline environments. The server subsequently becomes ready and all runtime endpoint checks pass. This is not a Worker code failure.
