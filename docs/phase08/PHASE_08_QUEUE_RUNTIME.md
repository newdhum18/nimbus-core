# Phase 08 — Queue Runtime and Task Execution Core

## Status

`PASS LOCAL`

## Parent

- Package: `Nimbus-Core-V36-Phase-07-Runtime-Lifecycle-v1.5.0.zip`
- SHA-256: `eda19753bfbe9818e2b90101fd3b928044a67d4c89311ecd386876ad1f3a8dab`

## Implemented scope

- Versioned queue contract: `nimbus.queue.v1`.
- Minimal messages containing only message, run and task identity plus attempt metadata.
- Strict message validation and rejection of unexpected fields.
- Producer-side optimistic claiming from `pending` to `dispatching`.
- Queue-send rollback to `pending` on producer failure.
- Consumer-side cross-run protection.
- Safe duplicate delivery handling through terminal-state checks and leases.
- Lease acquisition for queued/dispatching tasks and expired running tasks.
- Run-scoped expired-lease recovery.
- Retry until the approved maximum of five attempts.
- Dead-task persistence using a minimal versioned snapshot.
- Follow-up dispatch after successful acknowledgements.
- Queue runtime recovery endpoint: `POST /api/runs/:id/queue-recover`.

## Queue message contract

```json
{
  "schema": "nimbus.queue.v1",
  "type": "run_task",
  "message_id": "msg_<uuid>",
  "run_id": "run_<uuid>",
  "task_id": "task_<uuid>",
  "attempt": 0,
  "enqueued_at": "ISO-8601"
}
```

HTML, credentials, tokens, page bodies and complete task state are forbidden in queue messages.

## Runtime invariants

1. D1 remains the durable source of truth.
2. Queue delivery is treated as at-least-once.
3. A message never authorizes work for a different run.
4. A non-expired running lease cannot be acquired again.
5. An expired running lease can be reclaimed safely.
6. Paused and recovering runs return queued work to `pending` and acknowledge the message.
7. Cancelled or terminal work is acknowledged and never replayed automatically.
8. Producer failure restores claimed tasks to `pending`.
9. Retryable failure clears the lease and keeps the task retryable.
10. Attempt exhaustion creates one `dead_tasks` record per original task.

## Cloudflare runtime settings

- Queue: `nimbus-core-v36-queue`
- Producer binding: `QUEUE`
- Consumer Worker: `nimbus-core-v36-worker`
- Batch size: 1
- Batch timeout: 2 seconds
- Maximum retries: 5
- Retry delay: 30 seconds
- Maximum concurrency: 1

## Out of scope

- Production deployment.
- Remote D1 migration.
- Live queue traffic testing.
- Search adapter expansion.
- Full crawler implementation.
- Dashboard queue monitor.

These require later deployment and feature phases.
