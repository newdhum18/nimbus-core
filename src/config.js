export const SYSTEM = Object.freeze({
  name: "Nimbus Core V36",
  version: "36.19.3",
  worker: "nimbus-core-v36-worker",
  pages: "nimbus-core-v36-web",
  database: "nimbus-core-v36-db",
  queue: "nimbus-core-v36-queue",
  sourceTotal: 34,
  sourceEnabledDefault: 31,
  sqlBatchSize: 20,
  sqlBatchMax: 25,
  maxCrawlDepth: 4,
  maxChildLinks: 24,
  maxPagesPerTask: 20,
  queueDispatchBatch: 10,
  queueDispatchTasks: 40,
  queueTasksPerMessage: 4,
  queueFreeDailyOperations: 10000,
  directFallbackTasks: 2,
  directFallbackFetchBudget: 20,
  directFallbackEstimatedFetchesPerTask: 8,
  taskLeaseSeconds: 60,
  maxTaskAttempts: 5,
  queueRetryDelaySeconds: 30,
  sourceDiscoveryDispatchTasks: 16,
  sourceDiscoveryTasksPerMessage: 2,
  sourceDiscoveryFetchBudget: 16,
  sourceDiscoveryDirectFetchBudget: 16,
  sourceDiscoveryLeaseSeconds: 90,
  sourceDiscoveryMaxAttempts: 3,
  maxResponseBytes: 1_000_000
});

export const RUN_STATUSES = Object.freeze([
  "created", "running", "paused", "completed", "failed", "cancelled", "recovering"
]);

export const TASK_STATUSES = Object.freeze([
  "pending", "dispatching", "queued", "running", "completed", "failed", "cancelled", "dead"
]);
