# Nimbus Core V22

Clean link-first rebuild for public indexed MEGA URL discovery.

Important: this version does not bypass login, captcha, ads, unlock pages, paywalls, credits, subscriptions, or private systems.

## Why V22 exists

V20/V21 could show Cloudflare Error 1101 because async API exceptions were not always awaited/caught, and older D1 schemas from previous versions could miss columns required by the new link-first tables. V22 fixes both.

## Deployment

1. Upload all files to GitHub.
2. Deploy on Cloudflare Pages.
3. Keep D1 binding name exactly: `DB`.
4. Set Cloudflare variable `AUTH_PIN`.
5. Optional: set `AUTH_SECRET` and `BRAVE_API_KEY`.
6. Open `/reset?v=22&fresh=1` once after deployment.
7. Login, go Settings, press Check DB, Clean Old Data, then Auto Scan.

## Notes

Brave API is optional but strongly improves reliability. Without a real search API, public search engines may return limited or blocked HTML to Cloudflare Workers.
