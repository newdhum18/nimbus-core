import { SYSTEM } from "../config.js";

export function chunkArray(items, size = SYSTEM.sqlBatchSize) {
  if (!Array.isArray(items)) throw new TypeError("items must be an array");
  if (!Number.isInteger(size) || size < 1 || size > SYSTEM.sqlBatchMax) {
    throw new RangeError(`batch size must be between 1 and ${SYSTEM.sqlBatchMax}`);
  }
  const chunks = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

export async function runInBatches(items, size, handler) {
  if (typeof handler !== "function") throw new TypeError("handler must be a function");
  const results = [];
  const errors = [];
  for (const [index, batch] of chunkArray(items, size).entries()) {
    try {
      results.push(await handler(batch, index));
    } catch (error) {
      errors.push({
        index,
        message: error instanceof Error ? error.message : String(error)
      });
    }
  }
  return { ok: errors.length === 0, results, errors };
}
