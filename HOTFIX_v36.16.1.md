# Nimbus Core V36.16.1 Hotfix

Fixes stale source-discovery single-run locks. Before starting a new discovery, the Worker now reconciles the previous active run from its task states. Fully completed task sets are finalized automatically; genuinely running, paused, or recovering runs continue to block a duplicate run with a precise status-bearing error.
