# Nimbus Core V36.15.0 — Comprehensive Discovery Repair

## Completed repairs

- Added recursive redirect-chain decoding up to six wrapper layers.
- Decodes URL encoding, HTML entities, JavaScript escapes and Base64URL redirect values.
- Added extraction from anchors, iframes, forms, scripts, link tags and meta-refresh redirects.
- Added note/paste raw variants for Pastebin, Rentry, Paste.ee, dpaste and Reddit JSON.
- Added ranked child-link selection that prioritizes note, paste, raw, article and redirect surfaces.
- Filters analytics, trackers and static assets before crawl budget is consumed.
- Increased controlled crawl depth from 2 to 4 and child-link allowance from 10 to 24.
- Increased source-discovery fetch budget from 10 to 16 without changing queue message limits.
- Corrected source accounting: reachable zero-yield domains are now sandboxed, not reported as promoted.
- Active promotion now requires real novel/alive MEGA evidence, or repeated note-family extraction evidence.
- Qualified note-family sources use their direct root surface instead of only a DuckDuckGo site-search template.
- Added regression tests for nested redirect chains, note priority and tracker rejection.
- Updated version synchronization and baseline verification.

## Verification

- Unit/integration tests: 154/154 PASS.
- Configuration validation: PASS.
- Web build: PASS.
- Clean baseline verification: PASS.
- No new D1 migration is required for this release; schema remains at migration 0012.

## Deployment note

The GitHub workflow already applies pending migrations before Worker deployment. Because V36.15.0 adds no migration, deployment only validates the existing schema and publishes the updated Worker/UI.

## Remaining platform limitation

Cloudflare Worker fetch does not execute browser JavaScript. Dynamic pages that generate destinations only after browser execution still require a future Browser Rendering adapter or Safari-assisted capture endpoint. This release improves all statically visible and encoded nested links without bypassing access controls.
