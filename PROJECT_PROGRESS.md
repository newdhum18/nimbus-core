Nimbus Core V27.1 Fixed AutoScan Build

Problem found from user screenshots:
- D1 queue table existed but was missing the `available_at` column.
- `CREATE TABLE IF NOT EXISTS` did not repair old tables.
- Process Queue, Diagnostics, and Reset Cursor failed when SQL referenced `available_at`.
- AutoScan was not clearly visible as a separate button.

Fixes implemented:
- Rebuilt schema bootstrap to create tables, then inspect each table with PRAGMA table_info, then ALTER missing columns.
- Added `available_at` migration and queue defaults.
- Added `/api/autoscan` endpoint.
- Added AutoScan button to UI.
- Updated reset instructions.
- Updated docs.
