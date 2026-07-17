import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { SYSTEM } from "../src/config.js";

test("fixed system identity", () => {
  assert.equal(SYSTEM.worker, "nimbus-core-v36-worker");
  assert.equal(SYSTEM.pages, "nimbus-core-v36-web");
  assert.equal(SYSTEM.database, "nimbus-core-v36-db");
  assert.equal(SYSTEM.queue, "nimbus-core-v36-queue");
  assert.equal(SYSTEM.version, "37.1.1");
});

test("worker configuration is clean", async () => {
  const config = JSON.parse(await readFile("wrangler.worker.jsonc", "utf8"));
  assert.equal(config.name, SYSTEM.worker);
  assert.equal(config.main, "src/worker.js");
  assert.equal(config.compatibility_date, "2026-07-11");
  assert.equal(config.limits, undefined);
  assert.deepEqual(config.triggers.crons, ["*/1 * * * *"]);
  assert.equal(config.d1_databases[0].binding, "DB");
  assert.equal(config.queues.producers[0].binding, "QUEUE");
  assert.equal(config.queues.consumers[0].max_concurrency, 1);
});

test("Pages has no backend bindings", async () => {
  const config = JSON.parse(await readFile("wrangler.pages.jsonc", "utf8"));
  assert.equal(config.name, SYSTEM.pages);
  assert.equal(config.pages_build_output_dir, "./dist");
  assert.equal(config.d1_databases, undefined);
  assert.equal(config.queues, undefined);
});
