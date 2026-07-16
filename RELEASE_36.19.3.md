# Nimbus Core V36.19.3

## Critical fix

The fresh/local D1 schema now accepts the `ofversedrops` source type. V36.19.2 added the type in migration 0014 but left `src/db/schema.sql` on the previous constraint, causing `/api/sources/reset` to fail during GitHub Actions runtime validation.

## Regression protection

A schema test now verifies that the fresh schema accepts every supported source adapter type, including `pastetoday` and `ofversedrops`.

## Deployment

No new D1 migration is required. Existing remote databases already receive the correct constraint from migration 0014.
