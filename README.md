Nimbus Core V20 - Cleanroom Link-First Rebuild

This version was rebuilt from scratch as a public-indexed MEGA link discovery PWA for Cloudflare Pages + Worker + D1.

Core principle:
Auto Scan searches MEGA URL shapes, not fixed file names, categories, countries, or time labels.

Allowed behavior:
- Query public search engines and public web pages.
- Extract visible public MEGA URLs only.
- Store discovered MEGA links in D1.
- Store blocked or Tor-only pages as manual sources.

Not supported:
- No login bypass.
- No paywall bypass.
- No captcha bypass.
- No advertisement or unlock bypass.
- No private account access.
- No IP hiding or proxy evasion.

Required Cloudflare variables:
- AUTH_PIN

Optional variables:
- AUTH_SECRET
- BRAVE_API_KEY
- CRON_ENABLED=true
- CRON_LIMIT=60

Required D1 binding:
- DB

Deploy steps:
1. Upload all files to GitHub repository root.
2. Cloudflare Pages must bind D1 as DB.
3. Add AUTH_PIN in Cloudflare environment variables.
4. Deploy.
5. Open /?v=20&fresh=1
6. Login.
7. Settings > Check DB.
8. Settings > Clean Old Data.
9. Auto Scan > Auto Scan.
10. Auto Scan > More.
