# Nimbus Core V36.16.2

## Active source-discovery recovery

- Reconciles every active source-discovery run, not only the newest row.
- Closes orphaned active runs that have no task rows.
- Closes runs whose tasks are already terminal.
- Automatically cancels stale non-terminal tasks after the safe lease window.
- Lists active runs first so the iPhone UI selects the real blocking run.
- Adds POST /api/source-discovery/active/cancel for emergency cancellation.
- When Start receives an active-run lock, the UI selects that run and enables its valid controls.
- No D1 migration is required.

Validation: 157/157 tests passed; configuration, Cloudflare dry-run, local runtime, web build, baseline, and release checks passed.
