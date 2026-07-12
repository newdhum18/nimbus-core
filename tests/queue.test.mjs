import test from "node:test";
import assert from "node:assert/strict";
import { consumeBatch } from "../src/queue/consumer.js";

function pausedDb() {
  const updates = [];
  return {
    updates,
    prepare(sql) {
      return {
        bind(...params) {
          return {
            async first() {
              if (sql.includes("SELECT t.*,r.status")) {
                return {
                  id: "task_1",
                  run_id: "run_1",
                  source_id: "high_001",
                  url: "https://example.com",
                  status: "queued",
                  run_status: "paused"
                };
              }
              return null;
            },
            async run() {
              updates.push({ sql, params });
              return { meta: { changes: 1 } };
            }
          };
        }
      };
    }
  };
}

test("paused queued task returns to pending and message is acknowledged", async () => {
  const DB = pausedDb();
  let acknowledged = false;
  let retried = false;
  const message = {
    body: { schema: "nimbus.queue.v1", type: "run_task", message_id: "msg_1", run_id: "run_1", task_id: "task_1", attempt: 0, enqueued_at: "2026-07-12T00:00:00.000Z" },
    ack() { acknowledged = true; },
    retry() { retried = true; }
  };

  await consumeBatch({ messages: [message] }, { DB });
  assert.equal(acknowledged, true);
  assert.equal(retried, false);
  assert.ok(DB.updates.some(({ sql }) => sql.includes("paused_before_processing")));
});

import { acquireLease } from "../src/queue/lease.js";

test("consumer can acquire a task while producer state is still dispatching", async () => {
  let capturedSql = "";
  const db = {
    prepare(sql) {
      capturedSql = sql;
      return {
        bind() {
          return { async run() { return { meta: { changes: 1 } }; } };
        }
      };
    }
  };
  assert.equal(await acquireLease(db, "task_1"), true);
  assert.match(capturedSql, /'dispatching'/);
});
