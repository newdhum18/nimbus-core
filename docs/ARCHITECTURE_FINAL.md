# Nimbus Core V36 Final Architecture

## Authority boundaries

- GitHub `main` is the code source of truth.
- Cloudflare Dashboard settings are bootstrap evidence only.
- Pages serves static frontend assets only.
- Worker owns HTTP API, D1 and Queue.
- D1 owns durable state.
- Queue owns asynchronous delivery, not business state.

## Runtime flow

```text
Browser / iPhone
       |
       v
Cloudflare Pages (static UI)
       |
       v
Cloudflare Worker Router
       |
       +--> Diagnostics / API validation
       +--> D1 repositories
       +--> Queue producer
                    |
                    v
             Cloudflare Queue
                    |
                    v
              Queue consumer
                    |
                    +--> lease task
                    +--> fetch public page
                    +--> extract folder links
                    +--> persist page/link/evidence
                    +--> update source metrics
                    +--> update run progress
                    +--> dispatch next slice
```

## Module ownership

- `src/api`: envelopes, CORS and request validation.
- `src/db`: schema, queries, migrations, batching and repair.
- `src/runs`: lifecycle, read model, progress and recovery.
- `src/queue`: producer, consumer, lease and retry.
- `src/search`: query building, crawl and ranking.
- `src/extract`: normalization, redirects and folder extraction.
- `src/sources`: deterministic catalogue, state and metrics.
- `src/results`: pagination and exports.
- `src/diagnostics`: operational status.

## Stability rules

1. Worker entry stays below 40 lines.
2. Router coordinates only and contains no SQL-heavy business workflows.
3. Every long operation becomes a Queue task.
4. Queue message identity always contains the real D1 task ID.
5. Completed, cancelled and dead tasks are not automatically replayed.
6. Source mutations are blocked while a run is running, paused or recovering.
7. All list endpoints use explicit limits.
8. All D1 bulk writes use chunks of 20, maximum 25 initially.
9. No release number appears in table names.
10. No ZIP, generated `dist`, `.wrangler`, secrets or `node_modules` enters Git.
