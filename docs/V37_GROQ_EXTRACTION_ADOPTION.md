# V37 Groq Extraction Adoption

## Adopted tools and evidence standard

Nimbus V37 accepts research evidence only when a real public source page is discovered through Web Search and then opened with Visit Website. Search snippets alone never promote a source.

## Adopted bounded extraction methods

- visible text
- anchor `href`
- static HTML attributes
- JSON, XML and CDATA text
- static JavaScript string literals without execution
- decimal and hexadecimal HTML entities
- bounded repeated percent decoding
- escaped slash and underscore normalization
- bounded Unicode and hexadecimal escapes
- bounded Base64/Base64URL decoding
- deterministic deduplication
- folder-only structural validation

## Source lifecycle

`candidate → fixture_validated → live_fetch_validated → enabled`

A new source remains disabled by default until both fixture and controlled live-fetch validation pass.

## Research-verified sources

### ULVIS Paste

- Domain: `paste.ulvis.net`
- Evidence page: `https://paste.ulvis.net/xMc4Xjvf`
- Evidence: direct public visible text
- Generic extractor: sufficient for the inspected page
- Lifecycle: candidate
- Default: disabled

### Pastebin

- Domain: `pastebin.com`
- Evidence page: `https://pastebin.com/eEUnV3gF`
- Evidence: direct public visible text
- Generic extractor: sufficient for the inspected page
- Lifecycle: candidate
- Default: disabled

### Pastemode

- Domain: `pastemode.com`
- Evidence page: `https://pastemode.com/mCRPQ3bQ8O`
- Observed result: `Loading Please wait...`
- Static MEGA evidence: not established
- Classification: requires browser review
- Lifecycle: candidate
- Default: disabled

## Security boundaries

V37 does not bypass authentication, CAPTCHA, paywalls, access controls, anti-bot systems, timers or ad-completion signals. It does not use third-party bypass services, execute arbitrary page JavaScript, access private/local destinations, or open/download/inspect MEGA contents.

## Operational adoption in V37.0.1

The verified ULVIS and Pastebin evidence pages are present in the source catalog as disabled `custom` candidates. Pastemode is present only as a disabled browser-review candidate. Sanitized fixtures cover all three observed page shapes. V37.0.1 also enforces structural-only MEGA validation and does not fetch MEGA destinations.
