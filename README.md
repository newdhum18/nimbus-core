# Nimbus Core V27 Core Build

This package rebuilds the project from the V26+ base and adds the requested V27 engineering features without adding the separate policy/keyword-control step.

## Added in V27

- Multi-source discovery engine.
- Query builder for MEGA file/folder patterns.
- Page extraction engine using HTML text, attributes, and link regex.
- Queue Manager for discovered source pages.
- Cache System for fetched pages and health checks.
- Link Health Checker with clear statuses.
- Manual Review source list for indirect pages such as Meawfy, Linktree, and Linkvertise-style pages.
- Dashboard with counts by domain, health status, queue status, and recent logs.
- CSV/JSON export.
- New isolated D1 tables: `nimbus_v27_*`.

## What was learned from the referenced repositories

1. galloclaudio/mega-search-links
   - Inspired direct-source/JSON-source thinking.
   - Inspired clean class-like separation between searching and processing.
   - Inspired custom User-Agent usage for stable public HTTP requests.

2. akosel/megalinks-scraper
   - Inspired multi-source scraping and storing discovered links in structured JSON.
   - Inspired deeper extraction from comments/pages, not only search-result titles.
   - Inspired the queue-based discovery workflow.

3. Titoot/mega-checker
   - Inspired link health checking for single links and bulk batches.
   - Inspired keeping a visible result beside each link instead of only storing URLs.

4. Provided Python snippet
   - Used as the design basis for regex extraction from both raw HTML and visible page text.
   - Added normalization, deduplication, type parsing, source metadata, and D1 persistence.

## Cloudflare setup

Upload all files to the root of your GitHub repository, deploy with Cloudflare Pages, and bind D1 as `DB`.

Required environment variable:

- `AUTH_PIN`

Optional:

- `AUTH_SECRET`
- `BRAVE_API_KEY`

After deployment open:

`/reset?v=27&fresh=1`

Then use:

1. Login
2. Check DB
3. Auto Scan
4. Process Queue
5. Check Link Health
6. Dashboard
7. Export CSV
