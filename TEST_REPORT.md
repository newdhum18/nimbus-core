# Nimbus Core V30 Test Report

Version: 30.0-target-decoder-search-engine

Status: PASS

Local checks completed:
- JavaScript syntax check for `_worker.js`: PASS
- JavaScript syntax check for `queue-consumer.js`: PASS
- MEGA folder extraction: PASS
- MEGA file rejection: PASS
- Encoded MEGA extraction: PASS
- Bing `/ck/a?u=a1...` target decoder: PASS
- DuckDuckGo `uddg=` target decoder: PASS
- Google `/url?q=` target decoder support: PRESENT
- Rentry raw target generation: PASS
- Pastebin raw target generation: PASS
- 1000-source catalog retained: PASS
- High-yield enabled sources: 107
- GitHub/social/video disabled by default: PASS
- D1 source policy refresh on version change: PASS

Important note: public search results can still return zero if indexed pages do not contain complete `mega.nz/folder/<id>#<key>` links. V30 fixes the major decoder issue that previously caused Bing/DDG/Google result wrappers to be ignored.
