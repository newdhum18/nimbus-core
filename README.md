# Nimbus Core V15 Link First

## What changed
- Full rebuild of Auto Scan engine.
- Auto Scan is Link-First, not keyword-first.
- No visible query labels on cards.
- No time filters.
- No country filters.
- More button continues with cursor and scans deeper.
- Manual search remains optional and separate.
- Archive supports pagination and delete.
- Cleanup removes old query/region labels from D1.

## Required Cloudflare
Variables:
- AUTH_PIN
Optional:
- AUTH_SECRET
- BRAVE_API_KEY

Binding:
- DB

## After upload
1. Open site with ?v=15&fresh=1
2. Settings
3. Clear App Cache
4. Check DB
5. Clean Old Data
6. Auto Scan
7. More
