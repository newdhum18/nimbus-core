import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chunkItems, deriveDiscoveryOutcome } from "../src/sources/discovery-runs.js";
import { calculateSourceGrade } from "../src/sources/discovery.js";

test("source discovery task creation is chunked within D1-safe limits",()=>{
  const chunks=chunkItems(Array.from({length:101},(_,i)=>i),20);
  assert.equal(chunks.length,6);
  assert.ok(chunks.every(c=>c.length<=20));
  assert.equal(chunks.flat().length,101);
});

test("source discovery outcomes distinguish success partial and failure",()=>{
  assert.deepEqual(deriveDiscoveryOutcome({total:10,completed:10,failed:0,cancelled:0}),{status:"completed",outcome:"success"});
  assert.deepEqual(deriveDiscoveryOutcome({total:10,completed:8,failed:2,cancelled:0}),{status:"completed",outcome:"partial"});
  assert.deepEqual(deriveDiscoveryOutcome({total:10,completed:0,failed:10,cancelled:0}),{status:"failed",outcome:"failure"});
});

test("quality grade rewards alive novel yield and penalizes blocking",()=>{
  const strong=calculateSourceGrade({pagesTested:10,novelLinks:12,aliveLinks:8,deadLinks:1,unknownLinks:1,successfulFetches:10});
  const weak=calculateSourceGrade({pagesTested:20,novelLinks:0,aliveLinks:0,deadLinks:0,unknownLinks:0,failedFetches:8,blockedFetches:4});
  assert.ok(["A","B"].includes(strong));
  assert.equal(weak,"D");
});

test("hardening migration records graph provenance and discovery fingerprints",async()=>{
  const sql=await readFile(new URL("../src/db/migrations/0010_zero_foundation_hardening.sql",import.meta.url),"utf8");
  assert.match(sql,/origin_source_id/);
  assert.match(sql,/origin_host/);
  assert.match(sql,/input_fingerprint/);
  assert.match(sql,/from_source_id/);
});

test("source UI renders dynamic candidate metrics and partial outcomes",async()=>{
  const app=await readFile(new URL("../public/app.js",import.meta.url),"utf8");
  assert.match(app,/extracted_links/);
  assert.match(app,/alive_links/);
  assert.match(app,/outcome===\"partial\"/);
});
