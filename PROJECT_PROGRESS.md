Nimbus Core V27 - Project Progress

V25 confirmed working in Cloudflare with real Auto Scan results.
V27 builds on V25 without changing the stable D1 table layer.

Changes:
- Built dynamic pattern generator instead of short static pattern list.
- Added many public indexed source domains.
- Added optional adult public indexed source-domain expansion.
- Added URLScan adapter.
- Increased engine result limits.
- Increased scan batch from 5 to configurable default 8.
- Increased page fetch cap from 27 to 50.
- Added fake/example MEGA link filtering.
- Added safety blocked manual-review logic for illegal abuse terms.

Known limits:
- Cloudflare Worker still cannot access .onion directly.
- Search engines can throttle or change result markup.
- This app does not bypass any protection systems.
