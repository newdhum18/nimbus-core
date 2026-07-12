# Phase 10 GitHub Branch Upload Guide

## Safety model

- Stable branch: `main`
- Development branch: `phase-10-search-adapters`
- Branch validation workflow: `.github/workflows/validate-phase.yml`
- Production deployment workflow: `.github/workflows/deploy-worker.yml`

The phase validation workflow runs for non-main pushes and pull requests and contains no deployment step or Cloudflare secrets. The deployment workflow remains restricted to pushes to `main` or a manual run.

## Required sequence

1. Confirm that the current repository `main` is the approved Phase 09 baseline.
2. Create `phase-10-search-adapters` from `main`.
3. Upload the contents of this package to that branch, preserving hidden folders such as `.github`.
4. Commit the changes on the phase branch only.
5. Open **Actions** and wait for **Validate Phase Branch**.
6. Confirm that install, tests, web build, Wrangler dry-run, local runtime, and resource-name checks all pass.
7. Open a pull request from `phase-10-search-adapters` into `main`.
8. Do not merge while any check is pending or failed.
9. After approval, merge into `main`; only then can the main deployment workflow run.
10. Record the merged commit SHA, create tag `v36-phase-10-v1.8.0`, download the source archive, and calculate the final SHA-256.

## Rollback

Before merge: keep `main` unchanged and fix or delete the phase branch.
After merge: revert the pull request or reset to the recorded Phase 09 tag/commit according to repository policy. Never delete the prior phase package or its SHA-256 reference.
