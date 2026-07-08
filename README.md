# Nimbus Core V27 Full Core Build

V27 rebuild from the V26+ direction with a stronger technical core.

## Included features

- Multi-source search engine support.
- Result cleaning and duplicate removal.
- New isolated database tables: `nimbus_v27_*`.
- Improved dashboard UI.
- Link Health Checker: Alive / Dead / Unknown.
- Multi-page crawler with depth and discovered-page queue.
- JSON Source Engine with plugin-style source registration.
- Reddit public JSON deep scraper for posts and returned text fields.
- Queue Manager with priority, retries, and task states.
- Background processing via Cloudflare scheduled handler and `ctx.waitUntil`.
- Cache System for search/source responses.
- Statistics Dashboard: pages scanned, links found, health counts, success rate, recent logs.
- CSV and JSON export.

## Deploy

Upload all files to the root of your GitHub repository, wait for Cloudflare Pages deployment, then open:

`/reset?v=27&fresh=1`

Then run:

1. Login
2. Settings > Check DB
3. Settings > Clean Data
4. Scan > Start Scan
5. Scan > Process Queue
6. Scan > Check Batch

## Notes from referenced repositories

- From `galloclaudio/mega-search-links`: direct-source idea, JSON-style source thinking, simple request wrapper, custom user-agent.
- From `akosel/megalinks-scraper`: multi-source scraping idea, structured JSON storage/export, pagination/crawling concept.
- From `Titoot/mega-checker`: link validity checking idea and batch checking workflow.
