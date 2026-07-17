# Nimbus Core V36.20.1

## Corrected
- Manual source mode no longer allows source metrics to change enabled/disabled state.
- DELETE is now allowed by Worker CORS and source delete requests reach the API.
- Deleted catalog sources are recorded in `source_tombstones` and are not restored by catalog reset.
- Direct sources can be added while a run exists; deletion is blocked only when that exact source still has an active task.
- Custom direct sources now use a dedicated crawler that follows useful same-host pages and public note/redirect destinations.
- Nested crawling now reuses the source-specific adapter instead of falling back to generic extraction.
- Migration 0015 adds persistent source deletion state.

## Verification
- 179 Node tests passed.
- Configuration validation passed.
- Release validation passed.
- Web build passed.
- Local migrations 0001 through 0015 applied with the local migration runner.
- Baseline verification passed.

## Important limitation
No crawler can guarantee extraction from every public website. Pages that require browser-only JavaScript, login, CAPTCHA, or anti-bot interaction are recorded for recovery instead of being falsely reported as successfully extracted.
