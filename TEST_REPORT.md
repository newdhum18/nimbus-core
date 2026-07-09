Nimbus Core V30.1 Fast Source Pipeline Fix - Test Report

Summary:
- Fixed slow noisy rounds by limiting source seeding to 4 sources per slice.
- Fixed frontend behavior that started a new run every outer round.
- Fixed wasted zero-source rounds by ending a run when enabled source catalog is exhausted.
- Reduced Worker timeout and queue batch sizes for faster feedback on Cloudflare Pages.
- Kept target decoder, raw paste variants, Reddit/GitHub/HN comment targets, MEGA folder-only extraction.

Static validation:
- _worker.js syntax: PASS
- queue-consumer.js syntax: PASS
- app.js syntax: PASS
- Version: 30.1-fast-source-pipeline-fix
- Seed limit <= 4: PASS
- Non-wrapping source offset: PASS
- Continuous single-run frontend autopilot: PASS
- Target redirect decoder: PASS
- Raw paste targets: PASS
- Comment target extraction: PASS

Known limits:
- Public search engines may still return dead or stale MEGA folder links.
- JavaScript-only protected pages are not bypassed.
- Search speed depends on Cloudflare/network response time and public source availability.
