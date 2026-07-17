# Nimbus Core V37.0.0

## Purpose

V37 starts from the approved V36.20.1 production foundation without renaming the existing Cloudflare resources. It introduces the first audited extraction-normalization foundation learned from verified Groq Web Search and Visit Website experiments.

## Implemented

- Bounded decimal/hex HTML entity decoding.
- Bounded repeated percent decoding.
- Bounded JavaScript Unicode and hexadecimal escape decoding without executing JavaScript.
- Escaped slash and escaped underscore normalization.
- Bounded Base64/Base64URL discovery.
- Extraction from public text, HTML attributes, JSON/XML/static script text supplied to the generic parser.
- Canonical host handling for `www.mega.nz` and `mega.io` to `mega.nz`.
- Exact folder ID/key casing preservation.
- Modern folder-only structural validation.
- Rejection of `mega.nz/file`, missing-key, legacy `#F!`, malformed and duplicate candidates.
- Root-folder normalization for an observed `/folder/<subfolderId>` suffix while preserving the subfolder as metadata.
- Diagnostic counting of legacy/file signals without persisting them as modern results.
- Deterministic ordering and idempotence tests.

## Verified research sources

The following domains are research-verified by direct public evidence-page visits, but remain disabled until fixture and controlled live-fetch validation:

- `paste.ulvis.net`
- `pastebin.com`

Pastemode remains a browser-review candidate because the visited page returned `Loading Please wait...` and did not expose a static MEGA link.

## Deployment identity

Cloudflare resource names intentionally remain the approved V36 names during V37 development:

- Worker: `nimbus-core-v36-worker`
- Pages: `nimbus-core-v36-web`
- D1: `nimbus-core-v36-db`
- Queue: `nimbus-core-v36-queue`

This prevents accidental production-resource replacement. Runtime application version is `37.0.0`.
