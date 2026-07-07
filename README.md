# Nimbus Core V23

Clean-room Link-First rebuild for Cloudflare Pages + Worker + D1.

Important policy: public indexed discovery only. This code does not bypass login, captcha, credits, paywalls, unlock pages, advertisements, or private systems.

## Deploy

1. Upload all files at repository root.
2. Cloudflare Pages D1 binding must be named `DB`.
3. Add environment variable `AUTH_PIN`.
4. Optional: `AUTH_SECRET`, `BRAVE_API_KEY`.
5. Open `/reset?v=23&fresh=1` after deploy.
6. Login, then Settings → Check DB → Clean Old Data → Auto Scan.

## Fixes over V22

- No `ALTER TABLE ... DEFAULT datetime()` usage.
- D1 migration uses safe nullable columns only.
- API always returns JSON, not Cloudflare HTML error pages.
- Auto Scan uses MEGA URL shapes only.
