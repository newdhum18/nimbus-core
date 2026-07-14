import { uid, nowIso } from "../db/queries.js";
import { SYSTEM } from "../config.js";
import { makeTaskBatchMessage } from "./contract.js";
import { recordQueueOperations, isQueueLimitError } from "./usage.js";

export async function dispatchPending(env, runId, limit = SYSTEM.queueDispatchTasks) {
  const run = await env.DB.prepare("SELECT status FROM runs WHERE id=?").bind(runId).first();
  if (!run || run.status !== "running") return { queued: 0, skipped: "run_not_running" };
  const boundedLimit=Math.min(Math.max(Number(limit)||1,1),SYSTEM.queueDispatchTasks);
  const rows=await env.DB.prepare(`SELECT id,attempts FROM run_tasks WHERE run_id=? AND status IN ('pending','failed') ORDER BY priority DESC,created_at ASC,id ASC LIMIT ?`).bind(runId,boundedLimit).all();
  const tasks=rows.results||[];
  if(!tasks.length)return{queued:0,messages:0};
  const now=nowIso();
  const marked=await env.DB.batch(tasks.map(task=>env.DB.prepare(`UPDATE run_tasks SET status='dispatching',updated_at=? WHERE id=? AND run_id=? AND status IN ('pending','failed')`).bind(now,task.id,runId)));
  const selected=tasks.filter((_,i)=>marked[i]?.meta?.changes===1);
  if(!selected.length)return{queued:0,messages:0};
  const groups=[];
  for(let i=0;i<selected.length;i+=SYSTEM.queueTasksPerMessage)groups.push(selected.slice(i,i+SYSTEM.queueTasksPerMessage));
  const messages=groups.map(group=>makeTaskBatchMessage({messageId:uid("msg"),runId,tasks:group.map(t=>({task_id:t.id,attempt:Number(t.attempts||0)})),enqueuedAt:now}));
  try{
    await env.QUEUE.sendBatch(messages.map(body=>({body})));
    await recordQueueOperations(env.DB,{writes:messages.length}).catch(()=>{});
    const queuedAt=nowIso();
    await env.DB.batch(selected.map(task=>env.DB.prepare(`UPDATE run_tasks SET status='queued',queued_at=?,updated_at=? WHERE id=? AND run_id=? AND status='dispatching'`).bind(queuedAt,queuedAt,task.id,runId)));
    return{queued:selected.length,messages:messages.length,tasks_per_message:SYSTEM.queueTasksPerMessage,message_schema:messages[0]?.schema||null};
  }catch(error){
    const message=error instanceof Error?error.message:String(error);
    await env.DB.batch(selected.map(task=>env.DB.prepare(`UPDATE run_tasks SET status='pending',last_error=?,updated_at=? WHERE id=? AND run_id=? AND status='dispatching'`).bind(message,nowIso(),task.id,runId)));
    if(isQueueLimitError(error)){
      const { processPendingDirect } = await import("./fallback.js");
      const fallback = await processPendingDirect(env,runId,SYSTEM.directFallbackTasks,{fetchBudget:SYSTEM.directFallbackFetchBudget}).catch(fallbackError=>({processed:0,error:String(fallbackError?.message||fallbackError)}));
      return{queued:0,messages:0,queue_limit:true,fallback_available:true,fallback_automatic:true,fallback,error:message};
    }
    throw error;
  }
}
