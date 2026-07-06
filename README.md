# Nimbus Core

Version: 1.3.0 V13 Clean Global

## Critical fix
- Auto Scan does not use any fixed keyword.
- No file name keyword is embedded in the code.
- General scan query label is now `GLOBAL-AUTOSCAN`.
- Added `/api/cleanup` to clean old database labels from previous versions.

## Important explanation
If old cards still display old query names, those are stored rows from the old D1 database, not the new code. Use:
Settings → Clean Old Data

## Required Cloudflare Variables
- AUTH_PIN
- Optional AUTH_SECRET
- Optional BRAVE_API_KEY

## Required Binding
- DB
