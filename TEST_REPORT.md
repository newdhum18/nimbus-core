# Nimbus Core V30.1 Verification Report

Package: `nimbus-core-v30.1-full-verified.zip`
Version: `30.1-fast-source-pipeline-fix`

## Static verification
- Required root files: 20 / 20 present.
- `_worker.js` syntax: PASS.
- `queue-consumer.js` syntax: PASS.
- `app.js` syntax: PASS.
- `service-worker.js` syntax: PASS.
- `_worker.js` and `queue-consumer.js`: identical SHA-256 content.

## Feature verification
- Catalog sources: 1000.
- Enabled default high-yield sources: 107.
- Per-batch source seed limit: 4.
- Meawfy API sources: present.
- Keeplinks sources: present.
- Reddit JSON/comment sources: present.
- Search redirect target decoder: present for Bing, DuckDuckGo, and Google.
- MEGA API folder validator function: present.
- Sources UI / enable all / disable all / high yield defaults: present.
- Folder-only extraction: present.

## Extraction tests
- Randomized complete folder links: PASS.
- Encoded URL folder links: PASS.
- JSON/comment body extraction: PASS.
- Old MEGA folder syntax extraction: PASS.
- MEGA file links rejected: PASS.
- Folder links without key rejected: PASS.

## Local test count
- Deterministic deep tests: 14 / 14 PASS.
- Randomized extraction validation: 5000 / 5000 PASS.

## Known limitations
- Local tests validate code behavior and parsing logic; live result volume depends on public source availability and external search/index responses.
- JavaScript-only pages can only be parsed if the needed MEGA link appears in HTML/JSON/RSS text returned to the Worker.
