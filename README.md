# Nimbus Core V29.2 High-Yield Source Autopilot

HyperSearch Sources Engine with Queue/Archive, source controls, MEGA folder-only extraction, enhanced comment targets, and MEGA API folder validation.

Highlights:
- Sources page with enable/disable controls.
- High-yield defaults and social/video/code sources disabled by default.
- Meawfy API and Keeplinks priority sources.
- D1 Archive for permanent MEGA folder results.
- Continuous slice seeding so AutoScan keeps moving without D1 bursts.
- Reddit/GitHub/HN/Telegram comment-target expansion.
- MEGA API validator for folder health where network allows.


## V29.2 High-Yield Source Autopilot

This release focuses on result quality and lower Cloudflare cost:
- Auto-applies a new source policy (`v29.2-high-yield-lean-120`).
- Keeps 1000 sources available, but enables only 101 high-yield sources by default.
- Disables GitHub/GitLab/Bitbucket/video/social/filler sources by default.
- Prioritizes Meawfy API, Reddit JSON/comments, Archive, Keeplinks, OfverseDrops, paste sites, and public note/link-hub sources.
- Reduces Bing noise by using only targeted RSS/Web templates by default.
- Maintains MEGA folder-only extraction and comment-target expansion.
