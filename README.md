# Nimbus Core V30.1 Fast Source Pipeline Fix

This release fixes the major V30 runtime issue where the frontend started new runs repeatedly and later rounds could continue with no useful source state.

Key changes:
- AutoScan now uses one continuous run.
- Source slices are limited to fewer than 5 sources per seed.
- Queue ticks process smaller batches for faster response.
- Source offset no longer wraps inside the same run.
- Search target decoder and raw paste/comment crawling remain enabled.

After upload:
1. Tools → Repair DB
2. Sources → High Yield Defaults
3. AutoScan → Start V30.1 FastSearch

Nimbus Core V30.1 Fast Source Pipeline Fix

# Nimbus Core V30 HyperSearch

V30 focuses on the core issue found in V29.x: search engines were returning redirect wrapper URLs, but the app was not decoding them into real target pages before crawling. V30 adds target decoding for Bing, DuckDuckGo, and Google and follows raw paste/comment pages.

## Highlights

- Bing `/ck/a?u=a1...` decoder.
- DuckDuckGo `uddg` decoder.
- Google `/url?q=` decoder.
- Raw paste targets for Pastebin, Rentry, dpaste, hastebin, and paste.rs.
- Search engine rebalance: DuckDuckGo Lite / HTML, Brave, Google, Startpage, and Bing RSS are prioritized; Bing Web is no longer a primary default source.
- High-yield default policy: 107 enabled sources out of 1000.
- GitHub, video, and social sources remain OFF by default.
- Queue and D1 shadow queue remain safe and chunked.

## After deploy

1. Open Tools.
2. Press Repair DB.
3. Open Sources.
4. Press High Yield Defaults.
5. Run AutoScan.
