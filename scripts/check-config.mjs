import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const worker = JSON.parse(await readFile("wrangler.worker.jsonc", "utf8"));
const pages = JSON.parse(await readFile("wrangler.pages.jsonc", "utf8"));

assert.equal(worker.name, "nimbus-core-v36-worker");
assert.equal(worker.main, "src/worker.js");
assert.equal(worker.compatibility_date, "2026-07-11");
assert.equal(worker.d1_databases?.[0]?.binding, "DB");
assert.equal(worker.d1_databases?.[0]?.database_name, "nimbus-core-v36-db");
assert.equal(worker.queues?.producers?.[0]?.binding, "QUEUE");
assert.equal(worker.queues?.producers?.[0]?.queue, "nimbus-core-v36-queue");
assert.equal(worker.queues?.consumers?.[0]?.queue, "nimbus-core-v36-queue");
assert.equal(worker.queues?.consumers?.[0]?.max_batch_size, 1);
assert.equal(worker.queues?.consumers?.[0]?.max_batch_timeout, 2);
assert.equal(worker.queues?.consumers?.[0]?.max_retries, 5);
assert.equal(worker.queues?.consumers?.[0]?.retry_delay, 30);
assert.equal(worker.queues?.consumers?.[0]?.max_concurrency, 1);
assert.equal("limits" in worker, false);
assert.deepEqual(worker.triggers?.crons, ["*/1 * * * *"]);

assert.equal(pages.name, "nimbus-core-v36-web");
assert.equal(pages.pages_build_output_dir, "./dist");
assert.equal("d1_databases" in pages, false);
assert.equal("queues" in pages, false);

console.log("Configuration validation PASS");
