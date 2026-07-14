import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildDiscoverySeeds } from "../src/sources/discovery-runs.js";

const html=await readFile(new URL("../public/index.html",import.meta.url),"utf8");
const app=await readFile(new URL("../public/app.js",import.meta.url),"utf8");
const migration=await readFile(new URL("../src/db/migrations/0008_source_intelligence_center.sql",import.meta.url),"utf8");

test("Source Intelligence Center has independent controls and progress",()=>{
  for(const id of ["startSourceDiscovery","sourceDiscoveryRounds","sourceDiscoveryProgress","sourceCandidateList","promoteCandidates"]) assert.match(html,new RegExp(`id="${id}"`));
  assert.match(app,/\/api\/source-discovery\/start/);
  assert.match(app,/\/api\/source-discovery\/runs/);
});

test("source discovery persistence is separate from AutoScan",()=>{
  assert.match(migration,/CREATE TABLE IF NOT EXISTS source_discovery_runs/);
  assert.match(migration,/CREATE TABLE IF NOT EXISTS source_discovery_tasks/);
  assert.match(migration,/CREATE TABLE IF NOT EXISTS source_graph_edges/);
});

test("MEGA validator no longer uses a generic not-found marker",async()=>{
  const validator=await readFile(new URL("../src/results/mega-validation.js",import.meta.url),"utf8");
  assert.doesNotMatch(validator,/\/not found\/i/);
  assert.match(validator,/structurally_valid/);
});

test("automatic queue fallback is fetch-budget limited",async()=>{
  const producer=await readFile(new URL("../src/queue/producer.js",import.meta.url),"utf8");
  const fallback=await readFile(new URL("../src/queue/fallback.js",import.meta.url),"utf8");
  assert.match(producer,/fallback_automatic:true/);
  assert.match(fallback,/fetchBudget/);
});

test("source discovery runs in Cloudflare queue and watchdog, not browser polling",async()=>{
  const queue=await readFile(new URL("../src/sources/discovery-queue.js",import.meta.url),"utf8");
  const watchdog=await readFile(new URL("../src/queue/watchdog.js",import.meta.url),"utf8");
  assert.match(queue,/source_discovery_batch/);
  assert.match(queue,/dispatchSourceDiscovery/);
  assert.match(watchdog,/recoverSourceDiscoveryRuntime/);
  assert.match(app,/setInterval\(\(\)=>loadSourceDiscovery/);
  assert.doesNotMatch(app,/setInterval\(\(\)=>processSourceDiscoveryBatch/);
});

test("domain intelligence, graph and partial outcomes are persisted",async()=>{
  const migration9=await readFile(new URL("../src/db/migrations/0009_source_discovery_runtime.sql",import.meta.url),"utf8");
  const discovery=await readFile(new URL("../src/sources/discovery.js",import.meta.url),"utf8");
  assert.match(migration9,/source_candidate_domains/);
  assert.match(migration9,/outcome IN \('pending','success','partial','failure'\)/);
  assert.match(discovery,/source_graph_edges/);
  assert.match(discovery,/quality_grade/);
});
