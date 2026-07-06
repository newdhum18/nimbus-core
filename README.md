# Nimbus Core

Version: 0.6.0 Stable API Fix

## Fixed
- Prevents Cloudflare Error 1101 by catching backend errors.
- Adds `/api/ping`.
- Makes `/api/schema` return JSON.
- Confirms temporary PIN: `775224`.

## Required Binding
D1 database binding must be named exactly:

`DB`

Database:

`nimbus_core_db`

## Test order
1. `/api/ping`
2. `/api/schema`
3. Login with `775224`
4. Search Now
5. Auto Scan Now
