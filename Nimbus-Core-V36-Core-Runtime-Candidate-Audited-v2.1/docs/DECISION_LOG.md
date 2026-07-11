# Decision Log

- V36 is a clean rewrite.
- Legacy packages are requirement references only.
- GitHub is the source of truth.
- Pages is static frontend only.
- Worker owns API, D1 and Queue.
- npm is the only package manager.
- `package-lock.json` is the only approved lockfile.
- No custom CPU limits.
- No Cron before live tests.
- No internal login.
- Folder-only MEGA results.
- Database operations are batched.
