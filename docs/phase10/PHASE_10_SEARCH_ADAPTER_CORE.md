# Phase 10 — Search Adapter Core

Status: PASS LOCAL / READY FOR GITHUB BRANCH VALIDATION
Version: 36.6.0

## Scope

Phase 10 adds a versioned adapter contract, deterministic request construction, HTML and RSS result parsers, URL normalization, adapter registry, and branch-only GitHub Actions validation. It does not perform production deployment and does not enable deep search orchestration.

## Boundaries

- AutoScan and Keyword Search remain separate modes.
- Adapters output public HTTP(S) target pages only.
- MEGA extraction remains in the extraction layer.
- No SQL, Queue, Run lifecycle, or Source Manager behavior is changed.
- No live search-engine calls are required by automated tests.

## GitHub safety

`.github/workflows/validate-phase.yml` runs on non-main branches and pull requests without Cloudflare credentials and without deployment. `.github/workflows/deploy-worker.yml` remains restricted to `main`.
