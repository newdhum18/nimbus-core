# Nimbus Core V36 Phase 12.5 Search Audit

Version: 36.8.3

Implemented:
- Persistent Dashboard Clear that cannot be undone by polling auto-selection.
- Exact 1–100 round planning retained and regression tested.
- Search target decoding for DuckDuckGo `uddg`, Google `/url?q=`, Bing `/ck/a?u=a1...`, and common redirect parameters.
- Pastebin raw, Rentry raw, and Reddit JSON comment target variants.
- Focused crawl up to depth 2 with strict per-task page limits and SSRF protections.
- Extraction from HTML, plain text, JSON, Markdown, script text, comments, percent/HTML/JS escapes, whitespace obfuscation, and bounded base64 candidates.
- Dynamic source tier and health classification plus Yield, Speed, and Health sorting.
- GitHub and YouTube remain excluded from the source catalog; Bing remains disabled and lowest priority.

Research notes:
- Meawfy integration is based on its public JSON result pattern and remains subject to live endpoint behavior.
- Reddit comment discovery uses public result pages and public JSON variants only.
- Legacy open-source MEGA checkers informed validation separation, but their code and ambiguous status logic were not copied.
- API providers such as Brave, Kagi, SerpAPI, SearchApi.io, Tavily, and Exa require user-provided credentials and are not falsely marked active.
- Direct scraping of Google/Startpage can be blocked or change without notice; they should be optional reserve providers, not guaranteed defaults.
