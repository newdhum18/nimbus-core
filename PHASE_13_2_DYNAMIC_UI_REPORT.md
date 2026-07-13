# Phase 13.2 Dynamic Source UI Report

Version: 36.9.2

## Scope

This hotfix removes the final user-interface dependencies on the retired 300/80 source model.

## Verified changes

- Sources title is catalog-agnostic before data loads.
- After loading, the title displays live total and active counts from `/api/sources/summary`.
- Bulk-enable confirmation refers to all available sources without a fixed number.
- Bulk-disable confirmation refers to all available sources without a fixed number.
- Restore action and confirmation refer to autonomous defaults without a fixed enabled count.
- Runtime validation remains dynamic and catalog-driven.
