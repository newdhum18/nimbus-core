Next:
- add pagination and source filters in Archive
- optional scheduled background drain
- optional KV/R2 backup export


## V28 Queue Archive Comments
- Added Cloudflare Queue producer support in Pages.
- Added separate Queue consumer Worker (`queue-consumer.js` + `wrangler.queue.jsonc`).
- Added permanent D1 archive table for all discovered folder links.
- Improved comment extraction from Reddit JSON, GitHub issue/pull comments, and Hacker News Algolia item/comment trees.
- AutoScan now creates Queue tasks instead of trying to finish all work in one request.
- Folder-only mode enforced; file links and missing-key folder links are rejected.
- Added source support including rentry.co and ofversedrops.com.
