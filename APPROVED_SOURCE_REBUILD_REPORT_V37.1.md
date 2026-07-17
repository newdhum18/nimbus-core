# Nimbus Core V37.1 — Approved Source Rebuild Report

## Decision
The previous source catalog was removed. Nimbus Core now starts from a clean list containing only six manually verified public note/paste platforms.

## Approved order
1. Rentry — `rentry.co`
2. ControlC — `controlc.com`
3. JustPaste.it — `justpaste.it`
4. Telegraph — `telegra.ph`
5. Pastemode — `pastemode.com`
6. Pastelink — `pastelink.net`

All six are enabled by default. Every previous index, archive, aggregator, code host, unverified paste service, reserve source, and synthetic duplicate was removed from the runtime catalog.

## Access chain
1. Discover indexed public note URLs through an exact-domain DuckDuckGo Lite query.
2. Reject results whose final hostname is not the source domain.
3. Fetch the public note through normal HTTP.
4. For Rentry, try `/raw/<slug>` first and fall back to the visible page.
5. For the other five platforms, fetch the canonical public page directly.
6. Scan visible text, anchor `href` values, and HTML for complete literal MEGA folder URLs.
7. Decode harmless HTML/Markdown escaping, preserve case, support optional subfolder suffixes, and deduplicate.
8. Do not follow advertisements, shorteners, unlock pages, login flows, or unrelated intermediates.

## Database behavior
Migration `0016_approved_note_sources_reset.sql` deletes the old source and tombstone rows and inserts the six approved sources. The API reset path also removes obsolete catalog rows transactionally.

## Validation
The automated suite checks exact catalog membership, ordering, enabled defaults, unique templates, direct-access policy, transactional reset behavior, Rentry raw access, and canonical direct page variants for all other approved platforms.
