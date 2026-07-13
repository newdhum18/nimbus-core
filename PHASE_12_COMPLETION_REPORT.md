# Nimbus Core V36 — Phase 11.5 + Phase 12 Source Report

Version: 36.8.0
Status: SOURCE PASS — DEPLOYMENT VERIFICATION REQUIRED

## Phase 11.5 UI/UX final polish

- Developer Center drawer activated from the header menu.
- Header system check now checks Worker, D1, Queue, bindings and diagnostics with live checking feedback.
- Dashboard command toolbar added: Refresh, Pause, Resume, Cancel, Recover, Dispatch and Clear.
- Run commands are state-aware and invalid commands are hidden/disabled.
- Current-run card now includes live progress, remaining tasks, speed, elapsed time and terminal actions.
- Dashboard history is compact and shows run number, state, result count and date.
- Raw JSON was removed from normal search workflows and retained only under developer details.
- AutoScan, Keyword and Extract share consistent operation status and summaries.
- Results now include clearer run selection, filtering, search, summaries and export/copy tools.
- Sources now support fast search, enabled filters, sort modes, progressive loading and performance badges.
- System Maintenance Center includes diagnostics, bindings, recovery, queue dispatch, cache cleanup, reload and local logout.
- iPhone safe-area, sticky navigation, compact controls, empty states and loading skeletons retained.

## Phase 12 search optimization

- Enabled sources are selected using adaptive rank, yield, failure and latency signals instead of priority alone.
- AutoScan and Keyword accept an explicit round count from 1 to 100.
- Round task priorities degrade slightly by round to preserve fair queue ordering.
- Run list responses include result counts for compact History and Results selection.
- Existing folder-only extraction, queue contract, D1 schema and single-active-run guard remain unchanged.

## Verification

- Automated tests: 94/94 PASS
- JavaScript syntax: PASS
- Configuration validation: PASS
- Web build: PASS
- Cloudflare Worker dry-run: PASS
- D1 and Queue bindings detected by Wrangler dry-run: PASS

## Remaining deployment gate

The package must be deployed to a feature branch and verified on the real Cloudflare preview and iPhone Safari before FINAL PASS.
