# Nimbus Core V27 Rewrite.3 DB Hard Reset Fix

This build fixes D1 schema drift errors including missing `scan_id`, `available_at`, and `created_at` columns.

## Important
Open after deploy:

`https://nimbus-core-6or.pages.dev/reset?v=27&fresh=1`

The reset endpoint now drops and recreates all `nimbus_v27_*` tables so old partial schemas cannot remain.

Login supports both:
- `AUTH_PIN`
- `NIMBUS_PIN`
- fallback `0000`

Current PIN in your Cloudflare screenshot: `775224`.
