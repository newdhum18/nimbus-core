import { recoverQueueRuntime } from "./recovery.js";
import { dispatchPending } from "./producer.js";
import { SYSTEM } from "../config.js";

export async function runQueueWatchdog(env){
  const active=await env.DB.prepare("SELECT id,status FROM runs WHERE status IN ('running','recovering') ORDER BY updated_at DESC LIMIT 1").first();
  if(!active)return {ok:true,active:false};
  const recovery=await recoverQueueRuntime(env,active.id).catch(error=>({error:String(error)}));
  const dispatch=await dispatchPending(env,active.id,SYSTEM.queueDispatchBatch).catch(error=>({error:String(error)}));
  return {ok:!recovery?.error&&!dispatch?.error,active:true,run_id:active.id,recovery,dispatch};
}
