import test from "node:test";
import assert from "node:assert/strict";
import { makeTaskMessage, validateTaskMessage, QUEUE_SCHEMA } from "../src/queue/contract.js";
import { acquireLease, releaseExpiredLeases } from "../src/queue/lease.js";
import { dispatchPending } from "../src/queue/producer.js";

function d1ForDispatch() {
  const state = { run: { status: "running" }, tasks: [
    { id: "task_1", attempts: 0, status: "pending" },
    { id: "task_2", attempts: 1, status: "pending" }
  ] };
  function stmt(sql, params=[]) {
    return {
      bind(...next) { return stmt(sql, next); },
      async first() {
        if (sql.includes("SELECT status FROM runs")) return state.run;
        return null;
      },
      async all() {
        if (sql.includes("SELECT id,attempts")) return { results: state.tasks.filter(t=>t.status==="pending").map(({id,attempts})=>({id,attempts})) };
        return { results: [] };
      },
      async run() {
        if (sql.includes("SET status='dispatching'")) {
          const task=state.tasks.find(t=>t.id===params[1]);
          if (task?.status==="pending") { task.status="dispatching"; return {meta:{changes:1}}; }
          return {meta:{changes:0}};
        }
        if (sql.includes("SET status='queued'")) {
          const task=state.tasks.find(t=>t.id===params[2]);
          if (task?.status==="dispatching") { task.status="queued"; return {meta:{changes:1}}; }
          return {meta:{changes:0}};
        }
        if (sql.includes("SET status='pending'")) {
          const task=state.tasks.find(t=>t.id===params[2]); if(task) task.status="pending";
          return {meta:{changes:1}};
        }
        return {meta:{changes:0}};
      }
    };
  }
  return { state, prepare:(sql)=>stmt(sql), async batch(statements){ return Promise.all(statements.map(s=>s.run())); } };
}

test("queue contract is versioned, minimal and valid",()=>{
  const body=makeTaskMessage({messageId:"msg_1",runId:"run_1",taskId:"task_1",attempt:0,enqueuedAt:"2026-07-12T00:00:00.000Z"});
  assert.equal(body.schema,QUEUE_SCHEMA);
  assert.deepEqual(Object.keys(body),["schema","type","message_id","run_id","tasks","enqueued_at"]);
  assert.deepEqual(body.tasks,[{task_id:"task_1",attempt:0}]);
  assert.equal(validateTaskMessage(body).ok,true);
  assert.equal(validateTaskMessage({...body,tasks:[]}).ok,false);
  assert.equal(validateTaskMessage({...body,schema:"nimbus.queue.v0"}).reason,"unsupported_schema");
});

test("producer dispatches selected tasks in one v2 envelope",async()=>{
  const DB=d1ForDispatch(); const sent=[];
  const env={DB,QUEUE:{async sendBatch(messages){sent.push(...messages);}}};
  const result=await dispatchPending(env,"run_1",20);
  assert.equal(result.queued,2); assert.equal(result.message_schema,QUEUE_SCHEMA);
  assert.equal(sent.length,1); assert.equal(sent[0].body.run_id,"run_1"); assert.ok(sent[0].body.message_id.startsWith("msg_"));
  assert.deepEqual(sent[0].body.tasks.map(t=>t.task_id),["task_1","task_2"]);
  assert.deepEqual(DB.state.tasks.map(t=>t.status),["queued","queued"]);
});

test("producer rolls dispatching tasks back when queue send fails",async()=>{
  const DB=d1ForDispatch();
  await assert.rejects(()=>dispatchPending({DB,QUEUE:{async sendBatch(){throw new Error("queue_down");}}},"run_1",20),/queue_down/);
  assert.deepEqual(DB.state.tasks.map(t=>t.status),["pending","pending"]);
});

test("lease acquisition supports dispatch race and expired lease recovery",async()=>{
  let sql="",params=[];
  const db={prepare(q){sql=q;return{bind(...p){params=p;return{async run(){return{meta:{changes:1}};}}}}}};
  assert.equal(await acquireLease(db,"task_1"),true);
  assert.match(sql,/status='running'/); assert.match(sql,/lease_until<=\?/); assert.equal(params[3],"task_1");
});

test("expired lease recovery is scoped to a run",async()=>{
  let sql="",params=[];
  const db={prepare(q){sql=q;return{bind(...p){params=p;return{async run(){return{meta:{changes:3}};}}}}}};
  assert.equal(await releaseExpiredLeases(db,"run_1"),3);
  assert.match(sql,/run_id=\?/); assert.equal(params.at(-1),"run_1");
});
