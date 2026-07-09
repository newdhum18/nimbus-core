# Nimbus Core V28 Queue Archive

One-button HyperSearch for public, complete MEGA folder links only.

## Highlights
- Folder-only mode: ignores `mega.nz/file` and incomplete folder links without `#key`.
- Permanent D1 archive: every valid folder link is saved automatically.
- Balanced source rotation: paste/note/linkhub/code/archive/reddit sources are sampled before generic engines.
- Source labels prefer the real source template, not only the search engine host.
- Added ofversedrops.com and more note/link-in-bio/paste sources.
- Safer batch scheduler to reduce Cloudflare 1102 resource-limit errors.

## Deploy
Upload all files to the GitHub repository root and redeploy Cloudflare Pages.
D1 binding must be named `DB`.


## V28 Queue Archive Comments
- Added Cloudflare Queue producer support in Pages.
- Added separate Queue consumer Worker (`queue-consumer.js` + `wrangler.queue.jsonc`).
- Added permanent D1 archive table for all discovered folder links.
- Improved comment extraction from Reddit JSON, GitHub issue/pull comments, and Hacker News Algolia item/comment trees.
- AutoScan now creates Queue tasks instead of trying to finish all work in one request.
- Folder-only mode enforced; file links and missing-key folder links are rejected.
- Added source support including rentry.co and ofversedrops.com.
