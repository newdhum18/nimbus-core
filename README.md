# Nimbus Core

Version: 0.9.0 Secure Deep Search

## Required Cloudflare variables

Add this in Cloudflare Pages → Settings → Variables and Secrets:

AUTH_PIN

Value: your private PIN.

Optional:

AUTH_SECRET

## Required binding

D1 binding must be:

DB

## Fixes

- Removed hardcoded PIN from frontend files.
- Login now uses `/api/login`.
- API routes require a session token.
- Expanded public discovery mode with DuckDuckGo + Bing.
- Added All World search option.
- Increased result limits.
- Improved protected-source classification.
- Added Archive page.
