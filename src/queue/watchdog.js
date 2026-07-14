import { recoverQueueRuntime } from "./recovery.js";
import { dispatchPending } from "./producer.js";
import { SYSTEM } from "../config.js";
import { recoverSourceDiscoveryRuntime } from "../sources/discovery-queue.js";

export async function runQueueWatchdog(env){
  const active=await env.DB.prepare("SELECT id,status FROM runs WHERE status IN ('running','recovering') ORDER BY updated_at DESC LIMIT 1").first();
  const sourceActive=await env.DB.prepare("SELECT id,status FROM source_discovery_runs WHERE status IN ('running','recovering') ORDER BY updated_at DESC LIMIT 1").first();
  const source=sourceActive?await recoverSourceDiscoveryRuntime(env,sourceActive.id).catch(error=>({error:String(error)})):null;
  if(!active)return {ok:!source?.error,active:false,source_discovery:source};
  const recovery=await recoverQueueRuntime(env,active.id).catch(error=>({error:String(error)}));
  const dispatch=await dispatchPending(env,active.id,SYSTEM.queueDispatchBatch).catch(error=>({error:String(error)}));
  return {ok:!recovery?.error&&!dispatch?.error&&!source?.error,active:true,run_id:active.id,recovery,dispatch,source_discovery:source};
}
