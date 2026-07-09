# Nimbus Core V31.0 Complete Rebuild - Verification Report

Generated: 2026-07-09 20:48:51 UTC

## Package status
- Required root files: 20 / 20
- No test folders or extra artifacts included
- Service worker cache fixed: network-only + clears old caches
- Visible older references removed
- _worker.js and queue-consumer.js synchronized

## UI checks
- Dashboard: PASS
- AutoScan: PASS
- Search: PASS
- Extract: PASS
- Archive: PASS
- Sources: PASS
- Tools: PASS
- Sources controls: Enable All / Disable All / High Yield Defaults / category filter / per-source Turn ON/OFF / Test

## Engine checks
- V31.0 Fast Source Pipeline Clean: PASS
- Source batch limit = 4: PASS
- Prevent zero-source rounds: PASS
- Search target decoder for Bing/DDG/Google: PASS
- Raw paste/rentry target handling: PASS
- MEGA folder-only extraction: PASS
- File links rejected: PASS
- Reddit/GitHub/HN/Telegram comment extractors present: PASS
- Meawfy and Keeplinks sources present: PASS
- MEGA API validator present: PASS

## Important note
This package fixes the prior cache/version regression by replacing the old service worker.
After deployment, refresh Safari once or clear website data if an old PWA cache still appears.


## V31.0 Hyper Extractor verification

Date: 2026-07-10

Local static validation completed:
- Required files: 20 / 20
- JavaScript syntax: PASS for `_worker.js`, `queue-consumer.js`, `app.js`, `service-worker.js`
- Worker/Queue sync: PASS (`_worker.js` equals `queue-consumer.js`)
- UI tabs preserved: Dashboard, AutoScan, Search, Extract, Archive, Sources, Tools
- V27 reference scan: PASS
- Source catalog: 1000 sources
- Default enabled high-yield sources: 113
- Random extraction tests: 5000 generated MEGA-folder cases, 45020 assertions PASS
- Rejects `mega.nz/file` links: PASS
- Rejects folder links without key: PASS
- Rejects false positive `example.com/mega.nz/...`: PASS
- Search target decoders: Bing `ck/a?u=a1`, DuckDuckGo `uddg`, Google `/url?q=`: PASS
- Raw conversions: Pastebin/Rentry raw variants: PASS
- Optional API providers added: Brave, SerpAPI, SearchApi.io, Tavily, Exa, Kagi
- Public OSINT providers added/kept: DuckDuckGo Lite, Brave Web, Google Web, Startpage, SearXNG, Marginalia, YaCy
- Comment target expansion: Reddit JSON, GitHub issue/pull comments, HN Algolia, Telegram public pages, Lemmy APIs, WordPress/comment feeds

Important limitation:
- JavaScript-only comments that require a real browser/headless renderer cannot be guaranteed inside Cloudflare Workers.
- Optional API providers require Cloudflare environment variables/API keys before they return real data.
