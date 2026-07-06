# Nimbus Core V10

Private PWA for collecting publicly indexed MEGA links only.

## Required Cloudflare variables
- `AUTH_PIN` for login.
- `AUTH_SECRET` optional stronger token signing secret.
- `BRAVE_API_KEY` optional but recommended for real search quality.
- `CRON_SECRET` optional for `/api/cron`.
- `AUTO_KEYWORDS` optional comma-separated auto scan keywords.

## Required D1 binding
- Binding name: `DB`

## V10 search engines
- Brave Search API when configured.
- DuckDuckGo HTML.
- Bing HTML.
- Ahmia clear-web search.
- OnionLand clear-web search.
- OnionEngine clear-web search.
- Source-focused queries for rentry.co, paste sites, GitHub, Reddit, and other public pages.

Direct `.onion` fetching is not performed inside Cloudflare Workers because Tor access is required. V10 uses clear-web indexes for onion-discovery related search terms.
