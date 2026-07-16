# Nimbus Core V36.19.0 — Step 3 PasteToday Complete

This release completes the three-step PasteToday extraction foundation.

## Runtime changes

- PasteToday is now a valid first-class `source_type` in D1.
- Migration 0013 safely rebuilds the sources constraint and creates `extraction_recovery`.
- The PasteToday adapter follows canonical and embed variants, detects public content endpoints, parses JavaScript/JSON URL values, and extracts escaped MEGA folder URLs.
- Zero-result dynamic pages are persisted with reason, HTTP state, markers, embed status, encoded-target status, and evidence.
- Results → Recovery now reads real extraction failures instead of approximating them from discovery candidates.
- Manual single-source testing is supported by disabling every source except `pastetoday_direct` after restoring defaults.

## Test protocol

1. Deploy Worker and apply D1 migrations.
2. Deploy Pages.
3. Restore autonomous defaults once.
4. Select Manual source control.
5. Disable all sources.
6. Enable only `PasteToday note discovery` (`pastetoday_direct`).
7. Start AutoScan with one round.
8. Review Results and Results → Recovery.

A result count above zero proves end-to-end extraction for pages found during the run. A zero result is no longer silent: Recovery records where extraction stopped and why.
