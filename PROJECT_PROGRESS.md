# Nimbus Core Project Progress

Real project: Mega Hunter Pro Monitor
Alias: Nimbus Core
Version: 0.7.0 Polished UI + Results Fix

## Confirmed working before V7
- Cloudflare Pages deployment works.
- D1 database binding works as `DB`.
- `/api/schema` returns ok.
- V6 API works and finds links.

## Problems found in V6
- UI layout breaks on iPhone after results appear.
- Cards overflow horizontally.
- Search results show JSON more than real cards.
- Latest list does not refresh cleanly after repeated Auto Scan.
- Results need latest-to-oldest sorting.
- PWA needs proper icons for home screen.
- Need larger result limits and time filters.

## V7 fixes
- Full responsive iPhone layout rewrite.
- Results cards cannot overflow.
- Latest list has time filters:
  - 24 hours
  - 48 hours
  - 7 days
  - All
- Latest results are always ordered newest first.
- Search Now displays result cards, not only JSON.
- Auto Scan refreshes Latest and Protected after every scan.
- Better loading/toast states.
- Better JSON error handling.
- PWA manifest includes icons.
- Service worker cache version updated to V7.
- API latest supports limit and hours.
- API search returns items and counters.
- API search scans more pages than V6.

## Current limitations
- Brave API is still not used.
- True scheduled background scan still needs a separate Cloudflare Worker Cron in a later version.
- Public discovery cannot guarantee every link on the internet; it only discovers public/indexed pages available to the current free discovery method.
