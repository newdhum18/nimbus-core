# Nimbus Core V34 Test Report

Version: `34.0-resilient-orchestrator`

## Automated checks

- Worker JavaScript syntax: PASS
- Queue consumer syntax: PASS
- MEGA folder normalization: PASS
- Reject MEGA file links: PASS
- Reject folder links without keys: PASS
- Redirect decoding: PASS
- Raw Pastebin/Rentry variants: PASS
- 1000-source catalog generation: PASS
- Evidence-ranked default policy: PASS (84 enabled by default)
- Resumable run API presence: PASS
- Progress snapshot API presence: PASS
- Global visited-URL deduplication: PASS
- V34 service-worker cache isolation: PASS
- Legacy V29 frontend endpoint usage: REMOVED

Total automated assertions: 25.

## Deployment tests still required

Cloudflare D1, Queue binding, Cron trigger, external source availability, rate limits, CAPTCHA behavior, and iOS background suspension require live staging tests after deployment. Local tests do not claim that every external source is currently reachable.
