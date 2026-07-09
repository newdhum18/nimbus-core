# Nimbus Core V29.2 Test Report

Generated: 2026-07-09T17:48:11.926920Z

Version: 29.2-high-yield-source-autopilot

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
