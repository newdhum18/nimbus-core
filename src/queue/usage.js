import { nowIso } from "../db/queries.js";
import { SYSTEM } from "../config.js";

function utcDay(date = new Date()) { return date.toISOString().slice(0,10); }

export async function recordQueueOperations(db, { writes=0, reads=0, deletes=0 } = {}) {
  const day=utcDay();
  await db.prepare(`INSERT INTO queue_usage(day,writes,reads,deletes,updated_at) VALUES(?,?,?,?,?)
    ON CONFLICT(day) DO UPDATE SET writes=queue_usage.writes+excluded.writes,reads=queue_usage.reads+excluded.reads,deletes=queue_usage.deletes+excluded.deletes,updated_at=excluded.updated_at`)
    .bind(day,writes,reads,deletes,nowIso()).run();
}

export async function queueUsage(db) {
  const day=utcDay();
  const row=await db.prepare("SELECT * FROM queue_usage WHERE day=?").bind(day).first();
  const writes=Number(row?.writes||0), reads=Number(row?.reads||0), deletes=Number(row?.deletes||0);
  const estimated=writes+reads+deletes;
  const limit=SYSTEM.queueFreeDailyOperations;
  return {day,writes,reads,deletes,estimated_operations:estimated,free_daily_limit:limit,percent:Math.min(100,Math.round(estimated*100/limit)),remaining_estimate:Math.max(0,limit-estimated),note:"Application estimate only; Cloudflare account-wide usage may be higher."};
}

export function isQueueLimitError(error){
  const text=String(error?.message||error||"").toLowerCase();
  return text.includes("10253") || text.includes("daily write operations limit") || text.includes("queues free tier");
}
