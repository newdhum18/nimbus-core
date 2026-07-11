# Test Report — Nimbus Core V36 Core Runtime Candidate v2.0

Version: 36.1.0
Date: 2026-07-11

## Local result

- Configuration validation: PASS
- JavaScript syntax: PASS
- Node tests: 49 PASS / 0 FAIL
- Web build: PASS
- npm audit: 0 vulnerabilities
- Source catalogue: 300 total / 80 enabled defaults
- Worker entry: modular bootstrap
- Pages config: no DB or Queue bindings
- Versioned database tables: none

## New runtime coverage

- Request parameter validation
- Source list and state-service foundation
- Run list and run-detail read model
- Results pagination
- JSON and CSV export foundation
- Idempotent repair inspection/recovery foundation
- Queue foundation test endpoint
- Final architecture and Feature Matrix documents

## Not proven locally

- Remote D1 apply
- Live Cloudflare Queue retry/dead path
- Long-running live scan
- Live source behavior
- Production deployment

Decision: LOCAL PASS / REMOTE REVIEW REQUIRED
