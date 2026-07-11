# API Specification — Foundation

## Public foundation

- `GET /`
- `GET /health`
- `GET /bindings`
- `GET /api/status`
- `GET /api/diagnostics`
- `GET /api/foundation/db-test`

## Sources foundation

- `GET /api/sources/catalog`
- `GET /api/sources`
- `POST /api/sources/reset`

## Runs foundation

- `GET /api/runs`
- `POST /api/runs/start`
- `POST /api/runs/:id/pause`
- `POST /api/runs/:id/resume`
- `POST /api/runs/:id/cancel`
- `POST /api/runs/:id/dispatch`

## Error envelope

```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Explanation",
    "component": "component",
    "run_id": null,
    "task_id": null,
    "details": null
  }
}
```
