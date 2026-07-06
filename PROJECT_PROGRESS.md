# Nimbus Core Project Progress

Version: 0.9.0 Secure Deep Search

## V9 focus

- Security: no hardcoded PIN in GitHub.
- Cloudflare variable required: AUTH_PIN.
- API login with token.
- All API routes require authorization.
- Deep public discovery via multiple public search sources.
- Better protected source classification.
- Archive page.
- More countries and All World search.

## Before upload / after upload

1. Cloudflare Pages Settings → Variables and Secrets.
2. Add AUTH_PIN.
3. Value = your private PIN.
4. Redeploy after saving variables.
5. Test /api/ping after login from the app.
