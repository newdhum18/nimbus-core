# Nimbus Core V28 Queue Complete - Test Report

Version: 28-queue-archive-comments-complete

Checks performed:
- JavaScript syntax check: PASS (`_worker.js`, `queue-consumer.js`)
- Queue producer binding support: PASS (`QUEUE` and `AUTOSCAN_QUEUE` fallback)
- D1 binding expected name: PASS (`DB`)
- Folder-only extraction logic: present
- Archive tables: present
- Queue consumer handler: present (`async queue(batch, env, ctx)`)
- Comment extraction targets: Reddit JSON, GitHub issues/pulls/comments, Hacker News Algolia, HTML/JSON raw extraction
- Cloudflare 1102 mitigation: queue batches and D1 fallback queue present

Deployment notes:
- Pages/Worker producer binding name can be `QUEUE`.
- Queue consumer Worker can use `wrangler.queue.jsonc` or dashboard consumer trigger.


Hotfix4: safe queue seeding added to prevent D1/Worker 1102 subrequest limit.
