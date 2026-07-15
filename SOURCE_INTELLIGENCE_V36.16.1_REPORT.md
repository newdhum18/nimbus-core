# Nimbus Core V36.16.1 — Source Intelligence Upgrade

This release reorganizes Sources into Control, Discovery, and Pipeline views optimized for iPhone Safari. Automatic mode permits adaptive source management; Manual mode locks the exact operator-selected source set. Candidate presentation is domain-level and shows evidence, pages tested, MEGA signals, novelty, alive links, duplicates, grade, confidence, and the decision reason. Results now includes an Extraction Recovery view for blocked, dynamic, encoded, redirect-based, or otherwise unresolved pages.

No new D1 migration is required. The control mode is persisted in the existing `settings` table.


## Hotfix
Stale source-discovery locks are reconciled before a new run is started.
