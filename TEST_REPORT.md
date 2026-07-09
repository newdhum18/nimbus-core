# Nimbus Core V28 Hotfix5 Sources Verified Test Report

Version: `28-queue-archive-comments-hotfix5-sources`

## Automated local checks

- JavaScript syntax check: PASS
- Queue consumer syntax check: PASS
- Queue consumer version synced with `_worker.js`: PASS
- MEGA folder extraction tests: 1000/1000 PASS
- Negative validation tests: 600/600 PASS
  - MEGA file links rejected
  - Folder links without `#key` rejected
  - False positive `example.com/mega.nz/...` rejected
- Built-in catalog size: 1000 sources
- Default enabled high-yield sources: 342
- Low-yield default sources disabled: PASS
  - GitHub/GitLab/Bitbucket
  - YouTube/Vimeo/TikTok
  - Instagram/Facebook/LinkedIn/Pinterest
- Sources tab present: PASS
- Source toggle API present: PASS
- D1 source override support present: PASS
- Queue handler present: PASS
- D1 shadow queue present: PASS

## Notes

These tests are local/static plus extraction simulation tests. Live Cloudflare behavior still depends on deployed bindings:
- D1 binding: `DB`
- Queue binding: `QUEUE`
- Queue name: `nimbus-autoscan-queue`
