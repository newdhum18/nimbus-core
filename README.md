# Nimbus Core V21

Clean rebuild focused on link-first public indexed MEGA URL discovery.

Important: no bypassing login, captcha, ads, paywalls, credit systems, unlock pages, private accounts, or restricted systems.

Deploy to Cloudflare Pages with D1 binding named `DB` and environment variable `AUTH_PIN`.
Optional variables: `AUTH_SECRET`, `BRAVE_API_KEY`, `CRON_ENABLED`, `CRON_LIMIT`.

After deploy open:
`/?v=21&fresh=1`

Full client reset:
`/reset?v=21&fresh=1`
