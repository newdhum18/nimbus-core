# Nimbus Core V27 Complete Zero Build

Fresh Cloudflare Pages + D1 build. It contains a new iPhone-friendly UI and one integrated backend worker.

## Upload
Upload all files to the root of the GitHub repository.

Required Cloudflare bindings:

- D1 binding name: `DB`
- Optional PIN variable: `AUTH_PIN` or `NIMBUS_PIN`

Default PIN if no variable exists: `0000`

## First Run
Open:

```text
/reset?v=27&fresh=1
```

Then open the home page and login.

## Main Features

- iPhone responsive dashboard and menu UI
- AutoScan integrated with extraction
- Multi-source engine
- JSON / HTML / RSS source support
- Source manager and plugin-like source templates
- Crawler with pagination-style discovery
- Extractor for `mega.nz/file` and `mega.nz/folder`
- Queue manager with retry and priority
- Cache system
- Link health checker: alive / dead / unknown
- Statistics dashboard
- CSV / JSON export
- Diagnostics, DB repair, clean data, hard reset
- Cloudflare scheduled worker hook

## Important
This build starts from a clean file structure. It does not depend on V24/V25/V26 table names. All data tables use `nimbus_v27_*`.
