# Nimbus Core Progress - V27 Core Build

## Starting point

The rebuild starts from V26+ and keeps the working PWA + Cloudflare Worker + D1 structure.

## Requested repository ideas integrated as original implementation

- Direct-source concept from `galloclaudio/mega-search-links`.
- Multi-source scraper and structured storage concept from `akosel/megalinks-scraper`.
- Link status checking concept from `Titoot/mega-checker`.
- Regex + BeautifulSoup-style extraction concept from the provided Python example.

## Implemented V27 features

- `nimbus_v27_links` for extracted MEGA URLs.
- `nimbus_v27_sources` for manual-review source pages.
- `nimbus_v27_queue` for pending page processing.
- `nimbus_v27_cache` for page and health cache.
- `nimbus_v27_logs` for scan and health history.
- Multi-engine discovery: Bing RSS, DuckDuckGo Lite, Ahmia public web, Brave API optional.
- Extract From URL.
- Process Queue.
- Link Health Checker.
- Dashboard.
- CSV/JSON Export.

## Not included in this step

The separate final policy/keyword-control step was intentionally not added in this build, per user instruction.
