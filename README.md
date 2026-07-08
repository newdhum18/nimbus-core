# Nimbus Core V27 SourceBoost.3 Deep

This build continues from the working SourceBoost branch and focuses on stronger discovery.

## Main changes
- AutoScan and Keyword Search remain separated into independent iPhone-friendly pages.
- Results for AutoScan appear under AutoScan only.
- Results for Keyword Search appear under Keyword Search only.
- Deep queue processing up to 100 rounds per run, with Cloudflare time-budget stop to avoid timeout.
- More public sources: Bing RSS/Web, DuckDuckGo, Yahoo, Brave Search, Mojeek, Reddit JSON, r/megalinks JSON, GitHub code/issues/repos, Gist, GitLab, Bitbucket, Archive, Pastebin, Rentry, Paste.ee, JustPaste, ControlC, Telegraph, Ahmia, Meawfy, Linktree.
- Stronger MEGA extractor: supports https/no-protocol, mega.nz, mega.co.nz, mega.io, file/folder, old #F! format, encoded URLs, escaped slashes, JSON/RSS/HTML text.
- Reddit JSON target extraction and Reddit .json comment-page discovery from permalinks.
- Wider crawler that follows extracted targets and same-page JSON/RSS/HTML links.
- Queue Manager, Cache, Health Checker, Dashboard, Export CSV/JSON, Diagnostics.

## After upload
Open:
`https://nimbus-core-6or.pages.dev/reset?v=27&fresh=1`

Then login and use AutoScan or Keyword Search. If the run queues many pages, press **Deep Process 100 Rounds** under the same page.


## V27 SourceBoost Wide1000

This build expands the public-source catalog to 1000 deterministic source templates and improves MEGA link extraction accuracy.

Recommended Cloudflare environment variables:

- `MAX_SOURCES_PER_RUN=1000`
- `MAX_SOURCE_FETCHES=120` for stable use, or up to `240` for aggressive use
- `DEEP_ROUNDS=160` for stable use, or up to `200` for aggressive use

The app keeps searches limited to publicly available/indexed pages and does not bypass login pages, paywalls, unlock pages, or protected content.
