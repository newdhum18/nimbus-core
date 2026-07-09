V28 Queue Archive changes:
- folder-only extraction and search
- permanent archive endpoint `/api/archive`
- Archive UI tab
- D1 DB binding retained in wrangler.jsonc
- reduced per-request source/deep batch pressure
- ofversedrops.com and additional note/linkhub/paste sources added


## V28 Queue Archive Comments
- Added Cloudflare Queue producer support in Pages.
- Added separate Queue consumer Worker (`queue-consumer.js` + `wrangler.queue.jsonc`).
- Added permanent D1 archive table for all discovered folder links.
- Improved comment extraction from Reddit JSON, GitHub issue/pull comments, and Hacker News Algolia item/comment trees.
- AutoScan now creates Queue tasks instead of trying to finish all work in one request.
- Folder-only mode enforced; file links and missing-key folder links are rejected.
- Added source support including rentry.co and ofversedrops.com.


Hotfix4: safe queue seeding added to prevent D1/Worker 1102 subrequest limit.
