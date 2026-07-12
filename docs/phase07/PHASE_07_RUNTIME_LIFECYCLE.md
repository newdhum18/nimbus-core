# Nimbus Core V36 — Phase 07 Runtime and Run Lifecycle Core

## Status

PASS (local implementation and validation complete)

## Parent baseline

- Package: `Nimbus-Core-V36-Phase-06.1-Database-Core-Final-v1.4.1.zip`
- SHA-256: `e1592880903b9743d7855bf7ae26d1dbcfa3d80657f25fb57d4cd2c5e3f291e6`

## Scope delivered

1. Central run state machine.
2. Explicit legal and illegal transitions.
3. Optimistic state updates using `WHERE id=? AND status=?`.
4. Durable run-state events in D1.
5. Central lifecycle service for complete, fail and recovery operations.
6. Pause, resume and cancel refactored through the lifecycle service.
7. Progress completion routed through the lifecycle service.
8. Start failure routed through the lifecycle service.
9. Explicit recovery action and recovery state.
10. Terminal-state protection.

## Approved run states

`created`, `running`, `paused`, `recovering`, `completed`, `failed`, `cancelled`.

## Approved transitions

- created -> running | failed | cancelled
- running -> paused | recovering | completed | failed | cancelled
- paused -> running | recovering | cancelled
- recovering -> running | failed | cancelled
- completed, failed and cancelled are terminal.

## Runtime guarantees

- A terminal run cannot be restarted.
- A transition is rejected if the stored state changed concurrently.
- Every successful transition appends a `run_state_changed` event.
- Resume keeps the original `run_id`.
- Recovery returns stale dispatching, running leases and stale queued tasks to pending.
- Cancel marks all non-terminal tasks cancelled before terminalizing the run.
- Automatic completion occurs only when a running run has at least one task and all tasks are terminal.

## API actions

- `POST /api/runs/:id/pause`
- `POST /api/runs/:id/resume`
- `POST /api/runs/:id/cancel`
- `POST /api/runs/:id/recover`
- `POST /api/runs/:id/dispatch`

## Non-goals

Phase 07 did not modify production Cloudflare resources, apply remote D1 migrations, redesign Queue message schema, or implement new search/extraction features.

## Exit gate

- Full automated test suite passes.
- Source validation passes.
- Web build passes.
- Cloudflare configuration validation passes.
- Runtime validation passes.
- ZIP and internal SHA-256 manifest pass.
