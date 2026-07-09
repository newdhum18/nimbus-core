# Nimbus Core V29.3 Test Report

Generated: 2026-07-09T17:48:11.926920Z

Version: 29.3-source-state-autopilot-fix

Local verification:
- JavaScript syntax: PASS (`_worker.js`, `queue-consumer.js`)
- Test cases: 1018 / 1018 PASS
- Failures: 0
- Source catalog: 1000 sources available
- Default enabled sources: 101
- GitHub/GitLab/Bitbucket/YouTube/social/video sources disabled by default: PASS
- Meawfy API enabled: PASS
- Reddit JSON/comment targets enabled: PASS
- Paste/Rentry sources enabled: PASS
- MEGA folder extraction: PASS
- MEGA file rejection: PASS
- Incomplete folder without key rejection: PASS
- URL-encoded folder extraction: PASS
- JSON/comment body extraction: PASS
- Reddit comments `.json` target expansion: PASS
- GitHub issue/pull comments API target expansion: PASS

Known limitation:
- JavaScript-only comment systems that require browser execution are not fully parsed in Cloudflare Workers. Public JSON/HTML comment endpoints are supported.
- External APIs such as Meawfy depend on the external service availability.


## V29.3 verification
- JavaScript syntax: PASS (`_worker.js`, `queue-consumer.js`).
- Sources UI fallback: PASS (catalog always returns built-in sources even if D1 source override table is empty).
- Zero-source rounds fix: PASS (tick seeds and immediately drains a small new slice).
- Fixed frontend offset: PASS (uses API `next_source_offset`/catalog size instead of hard-coded 1000).
