# Nimbus Core V36.19.1 — Pre-upload correction

## Corrections

1. `pastetoday_direct` is now a genuine deterministic direct test against the public note supplied for validation:
   `https://pastetoday.com/wic5vif7en`.
2. Public discovery through DuckDuckGo is separated into `pastetoday_search`; a search-provider failure can no longer be confused with an adapter failure.
3. The production GitHub workflow now verifies migration 0013, the `extraction_recovery` table, and both PasteToday source rows before deploying the Worker.
4. Version and release metadata updated to `36.19.1`.

## Isolated test meaning

Enable only `PasteToday direct validation` to test the PasteToday fetch/extract/embed path without depending on a search engine. Enable `PasteToday public discovery` separately when testing discovery coverage.
