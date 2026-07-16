# Nimbus Core V36 Step 2 — PasteToday Adapter

Version: 36.18.0-step2

This step turns PasteToday from a catalog-only source into a source-specific extraction adapter.

Implemented:

- A dedicated `pastetoday` source type and adapter.
- Site-scoped public note discovery under the single `pastetoday_direct` source.
- Canonical note and `/embed/<slug>` traversal for every discovered public note.
- Dynamic-page signals (`Loading Please wait`, fetch/XHR markers, embed surfaces) recorded in task diagnostics.
- PasteToday-only search result filtering so unrelated search-result domains are not crawled by this source.
- Nested PasteToday document traversal through the same adapter.
- Regression tests for canonical/embed expansion, dynamic detection, and adapter parsing.

No D1 migration is required for Step 2.

Recommended isolated test after deployment:

1. Restore source defaults once.
2. Select Manual mode.
3. Disable every source.
4. Enable only `PasteToday note discovery`.
5. Run one Keyword Search or AutoScan round.
6. Inspect task events for `adapter_diagnostics`, `targets_visited`, and extracted folder links.

Step 3 will complete persistent unresolved-page evidence, site-specific endpoint learning, and final isolated-source certification.
