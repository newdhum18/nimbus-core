import test from "node:test";
import assert from "node:assert/strict";
import { chunkArray, runInBatches } from "../src/db/batch.js";

test("300 items use fifteen batches of twenty", () => {
  const chunks = chunkArray(Array.from({ length: 300 }, (_, index) => index), 20);
  assert.equal(chunks.length, 15);
  assert.equal(chunks.every((chunk) => chunk.length === 20), true);
});

test("oversized batch is rejected", () => {
  assert.throws(() => chunkArray([1], 26), RangeError);
});

test("invalid handler is rejected", async () => {
  await assert.rejects(() => runInBatches([1], 1, null), TypeError);
});

test("partial failures are reported", async () => {
  const result = await runInBatches([1, 2, 3, 4], 2, async (_, index) => {
    if (index === 1) throw new Error("expected");
    return index;
  });
  assert.equal(result.ok, false);
  assert.equal(result.results.length, 1);
  assert.equal(result.errors.length, 1);
});
