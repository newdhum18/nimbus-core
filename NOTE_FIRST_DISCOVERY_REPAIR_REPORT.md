# Nimbus Core V36.15.0 — Note-First Recursive Discovery Repair

## Root cause
The iPhone Shortcut executes JavaScript inside Safari's fully rendered DOM. It can therefore see links inserted by page scripts after load. The Worker previously fetched only server-returned HTML, collapsed results to domain roots, sampled a small fixed endpoint set, and did not recursively follow note pages or decode Linkvertise-style base64 redirect parameters. This caused large domain counts but low proven-source promotion.

## Repairs
- Decode nested redirect parameters including `r`, `o`, `redirect`, `redirect_url`, `continue`, and `link`.
- Decode URL-safe Base64 redirect destinations used by Linkvertise-style URLs.
- Add note/raw variants such as `paste.ee/p/...` -> `paste.ee/r/...`.
- Classify paste/note services as a dedicated `note` family and prioritize proven note sources.
- Recursively crawl useful same-host pages, note services, and redirect services to depth 2.
- Preserve up to four concrete example pages instead of relying mainly on the domain root.
- Increase source-discovery fetch budget from 6 to 10.
- Add regression tests for nested redirect and note extraction.

## Validation
- 152 automated tests passed.
- `npm run validate:source` passed.

## Important limitation
Cloudflare Workers do not execute arbitrary page JavaScript like Safari. Pages whose links appear only after client-side rendering can still require an official API, an HTML-accessible endpoint, or a browser-rendering service. The repair improves static HTML, embedded JSON/JavaScript text, redirect decoding, and recursive note traversal without bypassing access controls.
