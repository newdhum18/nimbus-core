# Deployment

## Prerequisites

- Node.js 22 or newer
- npm
- Cloudflare authentication
- Approved D1 database ID

## Worker

1. Replace the D1 ID placeholder in `wrangler.worker.jsonc`.
2. Run `npm ci`.
3. Run `npm run validate`.
4. Run `npm run check:release`.
5. Apply schema with `npm run db:apply:remote`.
6. Deploy with `npm run deploy:worker`.
7. Test `/health`, `/bindings`, `/api/status`, and `/api/diagnostics`.

## Pages

Current source directory: `public`  
Build command: `npm run build:web`  
Build output: `dist`

Do not add Pages Functions.
Remove unused Pages DB/QUEUE bindings only as a documented Cloudflare change.

## Disabled

- Cron
- Cloudflare Access
- Custom CPU limits
