# Changelog

## 36.13.4 — Source Recovery and Mobile UI Repair

- Decode DuckDuckGo, Google, and Bing search wrappers during source discovery.
- Profile discovered example pages before generic domain endpoints.
- Reduce Queue workload to two discovery tasks per message and six fetches per task.
- Reconcile source-discovery status and progress from live task counts.
- Make the first AutoScan round cover every explicitly enabled source.
- Compact and reorganize the Sources interface for iPhone.
- Add regression tests for wrapped target decoding and enabled-source AutoScan coverage.
- Remove the obsolete hidden-files patch archive from the runtime package.


## 36.13.4 — Official provider recovery and discovery diagnostics
- Added optional Brave Search API and SearXNG JSON provider integrations.
- Added provider capability and per-task diagnostics endpoints.
- Prevented direct source probes with no outbound links from being misreported as search failures.
- Made missing indexed-search provider configuration explicit instead of repeating blind retries.
