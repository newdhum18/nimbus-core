# Nimbus Core V36.19.2 — Source synchronization and OfverseDrops extraction

- Adds migration 0014 to guarantee PasteToday and OfverseDrops exist in production D1 after deployment.
- Adds a dedicated OfverseDrops adapter that follows useful same-site article pages.
- Decodes publicly visible Linkvertise base64url destination parameters and follows PasteToday note/embed variants.
- Keeps asset, tracking and unrelated links out of the crawl queue.
- Updates deployment verification through migration 0014 and verifies all three required sources.
- Adds isolated adapter tests and updates schema/version assertions.
