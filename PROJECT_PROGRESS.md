Nimbus Core V28 Hotfix5 Sources

Implemented a dedicated Sources manager and high-yield default source policy.

This version focuses on performance and control:
- Sources tab added.
- Each source can be turned ON/OFF.
- Default sources are filtered to likely MEGA folder discovery locations.
- GitHub and other repository platforms are no longer active default sources.
- AutoScan runs smaller repeated slices to avoid Cloudflare D1/subrequest limits.
- D1 stores source enable/disable overrides.
