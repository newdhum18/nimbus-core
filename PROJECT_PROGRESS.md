# V22 Progress

- Rebuilt exception handling around all API routes.
- Added JSON-only API failures so the UI should not display Cloudflare HTML error pages.
- Added D1 schema migration using PRAGMA table_info + ALTER TABLE.
- Added Bing RSS adapter before HTML parsing.
- Removed country/time/fixed-keyword Auto Scan logic.
- Kept Manual Search separate from Auto Scan.
- Added reset route `/reset?v=22&fresh=1`.
- Tested module import and auth/ping routes locally.
