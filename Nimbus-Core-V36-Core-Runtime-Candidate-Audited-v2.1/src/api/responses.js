const BASE_HEADERS = Object.freeze({
  "content-type": "application/json; charset=UTF-8",
  "cache-control": "no-store",
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(), microphone=(), geolocation=()"
});

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...BASE_HEADERS, ...extraHeaders }
  });
}

export function ok(data = {}, status = 200, extraHeaders = {}) {
  return json({ ok: true, ...data }, status, extraHeaders);
}

export function fail(
  { code, message, component, runId = null, taskId = null, details = null },
  status = 400,
  extraHeaders = {}
) {
  return json({
    ok: false,
    error: {
      code,
      message,
      component,
      run_id: runId,
      task_id: taskId,
      details
    }
  }, status, extraHeaders);
}
