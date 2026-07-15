# Nimbus Core V36.15.0 — Extraction Repair Report

This release strengthens note-first and nested-link discovery without bypassing logins, paywalls, advertisements, or access controls.

## Repairs

- Extracts candidate URLs from `href`, `src`, `action`, `data-*` URL attributes, meta refresh directives, visible absolute URLs, escaped JavaScript strings, JSON payloads, and URL-safe Base64 blobs.
- Recursively decodes common redirect parameters, including Linkvertise-style `r` and `o` targets.
- Adds raw-content variants for Pastebin, Rentry, Paste.ee, Reddit JSON, and GitHub Gist raw content.
- Ranks note, paste, raw-content, redirect, article, archive, RSS, and feed surfaces ahead of analytics, static assets, login, and policy links.
- Raises recursive discovery depth to 4 and child-link allowance to 30 while preserving per-task fetch budgets.
- Raises source-discovery fetch budgets from 10 to 18 and uses a priority queue so high-value content is fetched before low-value links.
- Extracts MEGA folders from both fetched content and final redirect URLs.

## Expected behavior

A chain such as:

`source article → redirect wrapper → paste/note page → MEGA folder`

can now be followed when each public target is visible in HTML, metadata, scripts, JSON, or decodable redirect parameters. Pages that only reveal content after browser JavaScript execution still require a future browser-rendering adapter or Safari-assisted capture.
