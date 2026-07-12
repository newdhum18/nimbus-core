import { AppError } from "../api/errors.js";

export const QUEUE_SCHEMA = "nimbus.queue.v1";
export const QUEUE_MESSAGE_TYPE = "run_task";

export function makeTaskMessage({ messageId, runId, taskId, attempt = 0, enqueuedAt = new Date().toISOString() }) {
  if (!messageId || !runId || !taskId) {
    throw new AppError("INVALID_QUEUE_MESSAGE", "message_id, run_id and task_id are required", "queue", 500);
  }
  return Object.freeze({
    schema: QUEUE_SCHEMA,
    type: QUEUE_MESSAGE_TYPE,
    message_id: messageId,
    run_id: runId,
    task_id: taskId,
    attempt: Number.isInteger(attempt) && attempt >= 0 ? attempt : 0,
    enqueued_at: enqueuedAt
  });
}

export function validateTaskMessage(body) {
  if (!body || typeof body !== "object") return { ok: false, reason: "body_not_object" };
  if (body.schema !== QUEUE_SCHEMA) return { ok: false, reason: "unsupported_schema" };
  if (body.type !== QUEUE_MESSAGE_TYPE) return { ok: false, reason: "unsupported_type" };
  for (const field of ["message_id", "run_id", "task_id", "enqueued_at"]) {
    if (typeof body[field] !== "string" || body[field].trim() === "") return { ok: false, reason: `missing_${field}` };
  }
  if (!Number.isInteger(body.attempt) || body.attempt < 0) return { ok: false, reason: "invalid_attempt" };
  if (Number.isNaN(Date.parse(body.enqueued_at))) return { ok: false, reason: "invalid_enqueued_at" };
  const allowed = new Set(["schema", "type", "message_id", "run_id", "task_id", "attempt", "enqueued_at"]);
  const forbidden = Object.keys(body).filter((key) => !allowed.has(key));
  if (forbidden.length) return { ok: false, reason: "unexpected_fields", fields: forbidden };
  return { ok: true, value: body };
}
