# Nimbus Core V36 — Step 1 Pastetoday Foundation

Version: 36.17.0-step1

Implemented in this first stage:

- PasteToday direct source added to the official source catalog.
- PasteToday discovery added through DuckDuckGo Lite, DuckDuckGo HTML, and Wayback CDX.
- Public target URLs embedded as base64url in HTML, JSON, or inline JavaScript are detected.
- Existing Linkvertise-style `r=` public target decoding remains supported.
- MEGA folder extraction is hardened for note pages that insert harmless HTML tags into displayed links.
- Regression tests cover PasteToday target decoding and marked-up MEGA folder extraction.

No login, advertisement, access-control, or interactive-gate bypass is implemented. The code only processes URLs and page content already returned publicly.

## Deployment test

1. Upload this folder to the repository root and deploy through the current workflow.
2. Use **Restore autonomous defaults** once so the four PasteToday catalog entries are inserted.
3. Switch source control to Manual.
4. Disable all sources, then enable `PasteToday public notes` first.
5. Run one Quick discovery round.
6. Review the Pipeline for PasteToday note URLs and MEGA folder evidence.
