# V32 Change Log

## Critical fixes

1. Fixed cross-run queue deduplication by including `run_id` in task identity.
2. Added safe conditional queue claiming to reduce duplicate processing.
3. Added task leases and automatic recovery of abandoned running tasks.
4. Added dead-letter handling and exponential retry delays.
5. Removed the full duplicated application from `queue-consumer.js`.
6. Added canonical SQL schema and migration tracking.
7. Added run heartbeat and stage state.
8. Added response classification and CAPTCHA/block detection.
9. Added persistent source performance metrics and an API endpoint.
10. Preserved folder-only extraction, key enforcement, redirect decoders, raw targets, archive, exports, and source ON/OFF policy.

## Important limitation

A real browser/headless crawler cannot be made operational by source code alone without provisioning a Cloudflare Browser Rendering, Browserless, Playwright, or equivalent service. This package prepares the HTTP/parser/queue foundation but does not claim that JavaScript-only pages are fully rendered.
