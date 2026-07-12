import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFile } from "node:fs/promises";
import { MIGRATIONS } from "../src/db/migration-catalog.js";
import { canTransitionRun, assertRunTransition, isTerminalRunState } from "../src/runs/state-machine.js";
import { transitionRun, beginRecovery } from "../src/runs/lifecycle.js";
import { pauseRun } from "../src/runs/pause.js";
import { cancelRun } from "../src/runs/cancel.js";

function d1Adapter(sqlite) {
  const wrap = (sql, params=[]) => ({
    bind(...next) { return wrap(sql, next); },
    async first() { return sqlite.prepare(sql).get(...params) || null; },
    async all() { return { results: sqlite.prepare(sql).all(...params) }; },
    async run() { const r=sqlite.prepare(sql).run(...params); return { meta: { changes: Number(r.changes) } }; }
  });
  return { prepare: (sql)=>wrap(sql), async batch(stmts){ return Promise.all(stmts.map((s)=>s.run())); } };
}
async function database() {
  const sqlite=new DatabaseSync(":memory:"); sqlite.exec("PRAGMA foreign_keys=ON");
  for (const m of MIGRATIONS) sqlite.exec(await readFile(m.file,"utf8"));
  return { sqlite, db:d1Adapter(sqlite) };
}
async function insertRun(sqlite,id,status="created") { const now=new Date().toISOString(); sqlite.prepare(`INSERT INTO runs(id,mode,keyword,status,created_at,updated_at) VALUES(?,?,?,?,?,?)`).run(id,"autoscan","",status,now,now); }

test("run state machine allows only approved transitions",()=>{
  assert.equal(canTransitionRun("created","running"),true);
  assert.equal(canTransitionRun("running","paused"),true);
  assert.equal(canTransitionRun("paused","running"),true);
  assert.equal(canTransitionRun("completed","running"),false);
  assert.equal(isTerminalRunState("cancelled"),true);
  assert.throws(()=>assertRunTransition("completed","running","run_x"),/Cannot transition/);
});

test("lifecycle applies optimistic transitions and records events",async()=>{
  const {sqlite,db}=await database(); await insertRun(sqlite,"run_1");
  const running=await transitionRun(db,"run_1","running",{from:"created"}); assert.equal(running.status,"running"); assert.ok(running.started_at);
  const paused=await pauseRun(db,"run_1"); assert.equal(paused.status,"paused"); assert.ok(paused.paused_at);
  const resumed=await transitionRun(db,"run_1","running",{from:"paused"}); assert.equal(resumed.status,"running"); assert.equal(resumed.paused_at,null);
  assert.equal(sqlite.prepare(`SELECT COUNT(*) count FROM events WHERE run_id='run_1' AND event_type='run_state_changed'`).get().count,3);
  sqlite.close();
});

test("terminal run cannot be restarted",async()=>{
  const {sqlite,db}=await database(); await insertRun(sqlite,"run_2","running");
  const cancelled=await cancelRun(db,"run_2"); assert.equal(cancelled.status,"cancelled");
  await assert.rejects(()=>transitionRun(db,"run_2","running"),/Cannot transition/);
  sqlite.close();
});

test("recovery is explicit and idempotent once active",async()=>{
  const {sqlite,db}=await database(); await insertRun(sqlite,"run_3","running");
  const recovering=await beginRecovery(db,"run_3"); assert.equal(recovering.status,"recovering");
  const again=await beginRecovery(db,"run_3"); assert.equal(again.status,"recovering");
  sqlite.close();
});
