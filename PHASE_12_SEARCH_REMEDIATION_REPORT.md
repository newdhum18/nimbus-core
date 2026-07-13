# Nimbus Core V36 Phase 12 Search Remediation

Version: 36.8.2

## Corrected

- Dashboard Clear now resets Dashboard-visible run/link/task counters without deleting archived D1 results.
- Multi-round planning creates exactly enabled_sources × selected_rounds tasks.
- Every source/round task retains a unique identity.
- Search result pages are parsed into child targets and up to the configured child-link limit is crawled.
- Full fetched text is scanned, including comments rendered in HTML/JSON responses.
- Extractor handles raw, escaped, entity-encoded, and percent-encoded MEGA folder URLs.

## Approved default source policy

- 80 enabled defaults.
- Direct MEGA indexes: Meawfy API, Meawfy search, OfverseDrops search.
- Reddit comment discovery.
- DDG Lite and DDG HTML queries against high-value paste/community/archive domains.
- Bing is reserve-only and lowest priority.
- GitHub and YouTube are excluded.

## Deployment note

After deployment, use **Sources → Restore 80 defaults** once to replace the old D1 source catalog with the new approved catalog. This action is blocked while a run is active.
