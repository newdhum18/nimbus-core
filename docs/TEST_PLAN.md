# Test Plan

Local validation must cover:

- JavaScript syntax
- Module imports
- Fixed names
- Wrangler configuration
- No custom CPU limit
- No Cron
- Schema creation in SQLite
- Schema idempotence
- Approved tables
- No legacy tables
- Catalog 300 / enabled 80
- Batch 20 / maximum 25
- Folder extraction
- File rejection
- Missing-key rejection
- Encoded and HTML-entity extraction
- CORS restrictions
- URL safety
- Build output generation
- No committed `dist`
- No secret patterns

Live validation remains mandatory before PASS.
