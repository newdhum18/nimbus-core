# Nimbus Core V30 — Report Ready Wide Scan

V30 keeps the stable V25 database tables and upgrades the discovery engine.

## Core guarantees
- No content categories.
- No content keyword blocklist.
- No hidden result filter.
- All structurally valid public MEGA links are displayed.
- Health status is shown for every link: live, unavailable, or unverified.
- Unavailable links remain visible instead of being deleted.
- The requested Telegram source prefix is excluded and cleanup removes it.

## 10 accuracy improvements
1. Wider pattern rotation with more public indexed surfaces.
2. Larger Auto Scan batch capacity.
3. More pages fetched per batch.
4. More parallel page fetch workers.
5. More parallel MEGA health checks.
6. Added generic public HTML search adapter.
7. Added Mojeek adapter.
8. Added OnionLand web adapter.
9. Added OnionEngine web adapter.
10. Added Audit and Report Package APIs.

Deployment reset:
`/reset?v=30&fresh=1`
