# Phase 10 UI Recovery

## Purpose

Restore an operational iPhone-first interface while preserving the approved V36 Phase 10 core.

## Real backend integration

The interface calls the current V36 routes:

- `POST /api/runs/start` with `mode: autoscan`
- `POST /api/runs/start` with `mode: keyword`
- `GET /api/runs`
- `GET /api/runs/:id`
- `POST /api/runs/:id/pause`
- `POST /api/runs/:id/resume`
- `POST /api/runs/:id/cancel`
- `POST /api/runs/:id/dispatch`
- `POST /api/runs/:id/queue-recover`
- `GET /api/runs/:id/results`
- `GET /api/runs/:id/export.json`
- `GET /api/runs/:id/export.csv`
- `GET /api/sources`
- `GET /api/sources/summary`
- `POST /api/sources/:id/enable`
- `POST /api/sources/:id/disable`
- `POST /api/sources/high-yield-defaults`
- `POST /api/sources/ranks/refresh`
- `GET /api/diagnostics`

## Scope

This is not a mock UI. AutoScan and Keyword Search create real V36 runs and dispatch real queue tasks.

Search success still depends on:

- enabled source templates
- public source availability
- Cloudflare outbound access
- Queue consumer health
- page response formats
- current Phase 10 adapter support

## Acceptance gate

The build must fail if the Foundation placeholder is present or if required application screens are missing.
