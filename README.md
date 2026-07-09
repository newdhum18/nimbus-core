# Nimbus Core V28 Queue Archive Hotfix5 Sources

A Cloudflare Pages + D1 + Queue based MEGA folder discovery interface.

## Main additions

- Dedicated Sources tab.
- Enable/disable sources from the UI.
- High-yield default source selection.
- Folder-only MEGA extraction.
- Permanent D1 archive.
- Smaller AutoPilot source slices to reduce Cloudflare Worker load.

## Required bindings

- `DB` -> D1 database `nimbus-db`
- `QUEUE` -> Queue `nimbus-autoscan-queue`

## After deployment

Recommended first step if old queue rows remain:

1. Open Dashboard.
2. Click Clean Data from Tools if old queue count remains high.
3. Click Repair DB.
4. Open Sources and review enabled sources.
5. Run AutoScan.
