# Queue Specification

Producer and consumer:
`nimbus-core-v36-worker`

Initial settings:
- batch 1
- timeout 2
- retries 5
- delay 30
- concurrency 1

State flow:

```text
pending → dispatching → queued → running → completed
                         |
                         +→ failed → pending
                                      |
                                      +→ dead
```

Completed, cancelled and dead tasks are never replayed automatically.
