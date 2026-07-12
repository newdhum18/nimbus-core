# Known Issues and Deferred Validation

1. Phase 10 must be revalidated by GitHub Actions after replacing internal-only package-lock registry URLs with public npm registry URLs and pinning npm 10.9.2 in CI.
2. No production deployment is approved until the pull request checks pass and the user explicitly approves merging into `main`.
3. Search adapters are deterministic parser/building components; live-engine compatibility and orchestration belong to later phases.
4. Search-engine HTML can change over time, so each live adapter will require monitored fixtures and controlled runtime tests before production use.
