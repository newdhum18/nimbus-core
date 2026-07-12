import test from "node:test";
import assert from "node:assert/strict";
import { route } from "../src/router.js";

const env = {};

test("health route works without bindings", async () => {
  const response = await route(new Request("https://worker.test/health"), env);
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.service, "nimbus-core-v36-worker");
});

test("bindings route reports false bindings", async () => {
  const response = await route(new Request("https://worker.test/bindings"), env);
  const body = await response.json();
  assert.equal(body.db, false);
  assert.equal(body.queue, false);
});

test("unknown route returns structured 404 with CORS", async () => {
  const request = new Request("https://worker.test/unknown", {
    headers: { origin: "https://nimbus-core-v36-web.pages.dev" }
  });
  const response = await route(request, env);
  const body = await response.json();
  assert.equal(response.status, 404);
  assert.equal(body.ok, false);
  assert.equal(body.error.code, "NOT_FOUND");
  assert.equal(
    response.headers.get("access-control-allow-origin"),
    "https://nimbus-core-v36-web.pages.dev"
  );
});

test("known endpoint with wrong method returns 405", async () => {
  const response = await route(new Request("https://worker.test/health", {
    method: "POST"
  }), env);
  const body = await response.json();
  assert.equal(response.status, 405);
  assert.equal(body.error.code, "METHOD_NOT_ALLOWED");
});

test("run state conflict exposes run_id in the standard error envelope", async () => {
  const fakeDb = {
    prepare(sql) {
      return {
        bind() { return this; },
        async first() { return sql.includes("SELECT * FROM runs") ? { id: "run_123", status: "completed" } : null; },
        async run() { return { meta: { changes: 0 } }; }
      };
    }
  };
  const response = await route(new Request("https://worker.test/api/runs/run_123/pause", {
    method: "POST"
  }), { DB: fakeDb });
  const body = await response.json();
  assert.equal(response.status, 409);
  assert.equal(body.error.code, "RUN_STATE_CONFLICT");
  assert.equal(body.error.run_id, "run_123");
});
