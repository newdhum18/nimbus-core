Nimbus Core V28 Queue Archive Comments - Test Report

Version: 28-queue-archive-comments

Code checks:
- JavaScript syntax check: PASS (_worker.js, queue-consumer.js)
- Cloudflare Pages producer config: PASS (wrangler.jsonc)
- Cloudflare Queue consumer worker config: PASS (wrangler.queue.jsonc)
- D1 archive table: PASS
- Folder-only extraction: PASS
- File-link rejection: PASS
- Missing-key folder rejection: PASS
- Reddit comment JSON targets: PASS
- GitHub issue/pull comments API targets: PASS
- Hacker News Algolia item/comment targets: PASS
- ofversedrops.com source: PASS
- rentry.co source: PASS

Extraction tests:
- 500 / 500 PASS
- Covered plain folder URLs, URL-encoded links, HTML hrefs, JSON/comment text, false positives, file links, and missing-key folders.

Notes:
- Cloudflare Pages can produce Queue messages, but Pages Functions cannot currently act as Queue consumers.
- This package includes a separate Worker consumer file: queue-consumer.js
- Deploy the Pages project normally, then deploy queue consumer using wrangler.queue.jsonc.
