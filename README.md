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
