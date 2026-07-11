import test from "node:test";
import assert from "node:assert/strict";
import { access, readdir, readFile } from "node:fs/promises";

const required = [
  "src/worker.js",
  "src/router.js",
  "src/api/responses.js",
  "src/api/errors.js",
  "src/api/cors.js",
  "src/db/schema.sql",
  "src/db/batch.js",
  "src/queue/producer.js",
  "src/queue/consumer.js",
  "src/runs/start.js",
  "src/runs/progress.js",
  "src/extract/mega.js",
  "docs/ARCHITECTURE.md"
];

test("approved modules exist", async () => {
  for (const path of required) await access(path);
});

test("source package does not contain dist", async () => {
  const root = await readdir(".");
  assert.equal(root.includes("dist"), false);
});

test("no old resource names in configs", async () => {
  const content =
    await readFile("wrangler.worker.jsonc", "utf8") +
    await readFile("wrangler.pages.jsonc", "utf8");
  assert.doesNotMatch(content, /nimbus-autoscan-queue|nimbus_core_db|"nimbus-db"/);
});

test("worker remains small and modular", async () => {
  const worker = await readFile("src/worker.js", "utf8");
  assert.ok(worker.length < 1000);
  assert.match(worker, /route/);
  assert.match(worker, /consumeBatch/);
});
