# Nimbus Core V34 — Resilient Search

## Core reliability

- One reusable run ID instead of a new run per round.
- Resume, pause, snapshot, and progress APIs.
- Durable progress counters and completion state.
- Queue leases, dead-letter handling, expired-lease recovery, and retry backoff retained.
- Cron resumes the latest active run before creating a new AutoScan run.
- Global 30-day visited URL registry prevents re-fetching previously scanned pages unless forced.
- Run source cursor is persisted in D1.

## Source strategy

- 1000 sources remain available with permanent ON/OFF controls.
- Default enabled list reduced and reordered to 84 evidence-ranked sources.
- Priority is given to Meawfy JSON, Reddit JSON/comments, archives, paste/raw pages, and selected lightweight search engines.
- Broad duplicate filler templates, social/video sites, and code hosts remain OFF by default.

## Performance

- Source timeout reduced from 11 seconds to 7 seconds.
- Request budget reduced from 26 seconds to 22 seconds.
- Frontend polling consolidated around run snapshots.
- Result refreshes occur periodically instead of after every queue item.
- Service worker changed to network-first and clears legacy caches.

## User experience

- Overall run progress percentage.
- Completed, total, and remaining task counters.
- Resume and Pause buttons.
- Active run ID survives page reload through localStorage.
- V34 naming is used across the visible interface and API.
