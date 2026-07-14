# Nimbus Core V36 — Zero Foundation

Nimbus Core is a Cloudflare Pages + Worker + D1 + Queue application for discovering, extracting, organizing, and validating publicly available MEGA folder links.

## Current baseline

- Version: 36.13.4
- Node.js: 22+
- Worker: `nimbus-core-v36-worker`
- Pages: `nimbus-core-v36-web`
- D1: `nimbus-core-v36-db` (`DB`)
- Queue: `nimbus-core-v36-queue` (`QUEUE`)
- Schema version: 10

## Validate

```bash
npm ci
npm run validate:source
npm run baseline:verify
npm run build:web
npm run check:cloudflare
npm run check:runtime
```

## Database

Use numbered migrations for local and remote databases:

```bash
npm run db:migrate:local
npm run db:apply:remote
```

The `backup/` directory contains a clean SQLite reference and combined SQL reference for inspection and recovery planning. It contains no secrets or production data.

## Source Discovery search providers

Autonomous discovery can use an official indexed-search provider instead of relying only on public HTML result pages, which may return bot-filtered or empty responses to Cloudflare Workers.

Recommended runtime secret:

- `BRAVE_SEARCH_API_KEY` — Brave Search API subscription token.

Optional runtime variable:

- `SEARXNG_BASE_URL` — URL of a trusted SearXNG instance that exposes JSON results.

The Worker exposes `GET /api/source-discovery/providers` so the UI and diagnostics can confirm which providers are configured. API keys must be stored as Cloudflare Worker secrets and must never be committed to GitHub.
