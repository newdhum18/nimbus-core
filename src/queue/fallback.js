import { processTask } from "./consumer.js";
import { SYSTEM } from "../config.js";

export async function processPendingDirect(env,runId,limit=SYSTEM.directFallbackTasks,{fetchBudget=SYSTEM.directFallbackFetchBudget}={}){
  const run=await env.DB.prepare("SELECT status FROM runs WHERE id=?").bind(runId).first();
  if(!run||run.status!=="running")return{processed:0,skipped:"run_not_running",fetch_budget:fetchBudget};
  const rows=await env.DB.prepare(`SELECT id,attempts FROM run_tasks WHERE run_id=? AND status IN ('pending','failed') ORDER BY priority DESC,created_at ASC LIMIT ?`).bind(runId,Math.min(limit,SYSTEM.directFallbackTasks)).all();
  const results=[]; let estimatedFetches=0;
  for(const task of rows.results||[]){
    if(estimatedFetches>=fetchBudget)break;
    results.push(await processTask(env,{run_id:runId,task_id:task.id,attempt:Number(task.attempts||0),message_id:"direct_fallback",schema:"direct",type:"direct",enqueued_at:new Date().toISOString(),fetch_budget:Math.max(1,fetchBudget-estimatedFetches)}));
    estimatedFetches+=SYSTEM.directFallbackEstimatedFetchesPerTask;
  }
  return{processed:results.length,results,fetch_budget:fetchBudget,estimated_fetches:estimatedFetches,warning:"Direct fallback is budget-limited to protect Worker subrequest limits."};
}
