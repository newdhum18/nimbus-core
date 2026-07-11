import { AppError } from "./errors.js";

export function requireDb(env) {
  if (!env?.DB) {
    throw new AppError("DB_BINDING_UNAVAILABLE", "D1 binding is unavailable", "d1", 503);
  }
  return env.DB;
}

export function requireQueue(env) {
  if (!env?.QUEUE) {
    throw new AppError("QUEUE_BINDING_UNAVAILABLE", "Queue binding is unavailable", "queue", 503);
  }
  return env.QUEUE;
}

export function positiveInt(value, { name, min = 1, max = 100, fallback = min } = {}) {
  if (value === undefined || value === null || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    throw new AppError(
      "INVALID_PARAMETER",
      `${name || "value"} must be an integer between ${min} and ${max}`,
      "validation",
      400
    );
  }
  return parsed;
}

export function nonEmptyString(value, { name = "value", max = 500 } = {}) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > max) {
    throw new AppError(
      "INVALID_PARAMETER",
      `${name} must be a non-empty string up to ${max} characters`,
      "validation",
      400
    );
  }
  return normalized;
}
