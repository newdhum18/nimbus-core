# Nimbus Core V34.2 Resilient Pipeline

- Queue consumer can now re-enqueue crawl children through a producer binding.
- Crawl descendants are sent to Cloudflare Queue and mirrored to D1.
- Cron drains a small D1 safety batch for orphaned tasks.
- Run progress counts all non-terminal queue states.
- Expired frontend tokens are cleared automatically.
- Sources UI keeps cached data on transient API failure.
- Repair DB refreshes dashboard and sources after completion.
- Versioned service-worker cache updated to V34.2.
