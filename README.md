# Nimbus Core V27 Source Boost

Fresh Cloudflare Pages + D1 build focused on stronger public-source discovery.

## Main changes
- Separate AutoScan page and Keyword Search page.
- Results appear directly under each page.
- Integrated extractor; no separate standalone extractor workflow.
- Multi-source engine: Bing RSS, DuckDuckGo HTML, Yahoo, Reddit JSON, r/megalinks JSON, GitHub search, Archive, Pastebin, Rentry, Ahmia, Meawfy web, Linktree web.
- JSON/HTML/RSS/XML source templates through Source Manager.
- Queue Manager, Cache, Crawler, Health Checker, Dashboard, CSV/JSON export.
- D1 tables use `nimbus_v27sb_*` to avoid collisions with old broken schemas.

## Cloudflare requirements
- Pages Functions enabled.
- D1 binding name: `DB`.
- Optional variable: `AUTH_PIN` or `NIMBUS_PIN`.

## Reset URL
`/reset?v=27&fresh=1`
