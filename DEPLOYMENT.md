# Deployment — Zero Foundation v36.13.2

## Branch workflow

1. Push to a feature branch.
2. Require all GitHub checks to pass.
3. Deploy a Cloudflare preview.
4. Apply remote D1 migrations through the workflow.
5. Verify `/health`, `/bindings`, `/api/foundation/db-test`, `/api/sources/catalog`, and `/api/diagnostics`.
6. Test Source Discovery and AutoScan separately on iPhone Safari.
7. Merge to `main` only after PASS.

## Fixed resources

- Pages: `nimbus-core-v36-web`
- Worker: `nimbus-core-v36-worker`
- D1: `nimbus-core-v36-db`
- Queue: `nimbus-core-v36-queue`
- Bindings: `DB`, `QUEUE`

## Queue efficiency

Source Discovery packs 8 tasks into each Queue message and dispatches up to 32 tasks per pump. Concurrency remains conservative to protect the Cloudflare free tier. The in-app Queue counter is an application estimate, not the account-wide Cloudflare billing counter.
