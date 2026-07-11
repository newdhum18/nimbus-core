export const SYSTEM = Object.freeze({
  name: "Nimbus Core V36 Clean Foundation",
  version: "36.1.0",
  worker: "nimbus-core-v36-worker",
  pages: "nimbus-core-v36-web",
  database: "nimbus-core-v36-db",
  queue: "nimbus-core-v36-queue",
  sourceTotal: 300,
  sourceEnabledDefault: 80,
  sqlBatchSize: 20,
  sqlBatchMax: 25,
  maxCrawlDepth: 2,
  maxChildLinks: 10,
  maxPagesPerTask: 20,
  queueDispatchBatch: 20,
  taskLeaseSeconds: 60,
  maxTaskAttempts: 5,
  queueRetryDelaySeconds: 30,
  maxResponseBytes: 1_000_000
});

export const RUN_STATUSES = Object.freeze([
  "created", "running", "paused", "completed", "failed", "cancelled", "recovering"
]);

export const TASK_STATUSES = Object.freeze([
  "pending", "dispatching", "queued", "running", "completed", "failed", "cancelled", "dead"
]);
