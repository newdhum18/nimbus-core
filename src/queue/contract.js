import { AppError } from "../api/errors.js";

export const QUEUE_SCHEMA = "nimbus.queue.v2";
export const QUEUE_MESSAGE_TYPE = "run_task_batch";

export function makeTaskBatchMessage({ messageId, runId, tasks, enqueuedAt = new Date().toISOString() }) {
  if (!messageId || !runId || !Array.isArray(tasks) || !tasks.length) {
    throw new AppError("INVALID_QUEUE_MESSAGE", "message_id, run_id and non-empty tasks are required", "queue", 500);
  }
  return Object.freeze({
    schema: QUEUE_SCHEMA,
    type: QUEUE_MESSAGE_TYPE,
    message_id: messageId,
    run_id: runId,
    tasks: tasks.map((task) => ({ task_id: String(task.task_id), attempt: Math.max(0, Number(task.attempt || 0)) })),
    enqueued_at: enqueuedAt
  });
}

// Backward-compatible helper used by older tests/callers.
export function makeTaskMessage({ messageId, runId, taskId, attempt = 0, enqueuedAt }) {
  return makeTaskBatchMessage({ messageId, runId, tasks: [{ task_id: taskId, attempt }], enqueuedAt });
}

export function validateTaskMessage(body) {
  if (!body || typeof body !== "object") return { ok: false, reason: "body_not_object" };
  // Accept v1 during rolling deployment so queued messages are not lost.
  if (body.schema === "nimbus.queue.v1" && body.type === "run_task") {
    if (!["message_id","run_id","task_id","enqueued_at"].every((f) => typeof body[f] === "string" && body[f].trim())) return { ok:false, reason:"invalid_v1_message" };
    return { ok:true, value:{ schema:QUEUE_SCHEMA,type:QUEUE_MESSAGE_TYPE,message_id:body.message_id,run_id:body.run_id,tasks:[{task_id:body.task_id,attempt:Number(body.attempt||0)}],enqueued_at:body.enqueued_at } };
  }
  if (body.schema !== QUEUE_SCHEMA) return { ok: false, reason: "unsupported_schema" };
  if (body.type !== QUEUE_MESSAGE_TYPE) return { ok: false, reason: "unsupported_type" };
  for (const field of ["message_id", "run_id", "enqueued_at"]) {
    if (typeof body[field] !== "string" || body[field].trim() === "") return { ok: false, reason: `missing_${field}` };
  }
  if (!Array.isArray(body.tasks) || body.tasks.length < 1 || body.tasks.length > 25) return { ok:false, reason:"invalid_tasks" };
  for (const task of body.tasks) {
    if (!task || typeof task.task_id !== "string" || !task.task_id.trim()) return { ok:false, reason:"invalid_task_id" };
    if (!Number.isInteger(task.attempt) || task.attempt < 0) return { ok:false, reason:"invalid_attempt" };
  }
  if (Number.isNaN(Date.parse(body.enqueued_at))) return { ok: false, reason: "invalid_enqueued_at" };
  return { ok: true, value: body };
}
