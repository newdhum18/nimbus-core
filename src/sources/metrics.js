import { nowIso } from "../db/queries.js";
import { calculateSourceRank } from "./ranking.js";

export async function recordSourceResult(db, sourceId, {
  success, timeout=false, blocked=false, linksFound=0, validLinks=0,
  novelLinks=0, duplicateLinks=0, latency=0
}) {
  const now=nowIso();
  await db.prepare(`
    INSERT INTO source_metrics(
      source_id,requests,successes,failures,timeouts,blocks,links_found,valid_links,
      yield_rate,average_latency,consecutive_failures,last_success_at,last_failure_at,updated_at,
      novel_links,duplicate_links,zero_yield_runs,last_novel_at,cooldown_until,intelligence_state
    ) VALUES(?,1,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(source_id) DO UPDATE SET
      requests=source_metrics.requests+1,
      successes=source_metrics.successes+excluded.successes,
      failures=source_metrics.failures+excluded.failures,
      timeouts=source_metrics.timeouts+excluded.timeouts,
      blocks=source_metrics.blocks+excluded.blocks,
      links_found=source_metrics.links_found+excluded.links_found,
      valid_links=source_metrics.valid_links+excluded.valid_links,
      novel_links=source_metrics.novel_links+excluded.novel_links,
      duplicate_links=source_metrics.duplicate_links+excluded.duplicate_links,
      yield_rate=((source_metrics.novel_links+excluded.novel_links)*100.0)/(source_metrics.requests+1),
      average_latency=((source_metrics.average_latency*source_metrics.requests)+excluded.average_latency)/(source_metrics.requests+1),
      consecutive_failures=CASE WHEN excluded.successes=1 THEN 0 ELSE source_metrics.consecutive_failures+1 END,
      zero_yield_runs=CASE WHEN excluded.novel_links>0 THEN 0 ELSE source_metrics.zero_yield_runs+1 END,
      last_success_at=COALESCE(excluded.last_success_at,source_metrics.last_success_at),
      last_failure_at=COALESCE(excluded.last_failure_at,source_metrics.last_failure_at),
      last_novel_at=COALESCE(excluded.last_novel_at,source_metrics.last_novel_at),
      cooldown_until=CASE
        WHEN source_metrics.consecutive_failures+excluded.failures>=4 THEN datetime('now','+30 minutes')
        ELSE source_metrics.cooldown_until END,
      intelligence_state=CASE
        WHEN source_metrics.consecutive_failures+excluded.failures>=6 THEN 'quarantined'
        WHEN source_metrics.zero_yield_runs+CASE WHEN excluded.novel_links>0 THEN 0 ELSE 1 END>=8 THEN 'disabled'
        WHEN source_metrics.novel_links+excluded.novel_links>0 THEN 'proven'
        WHEN source_metrics.requests+1<3 THEN 'explore'
        ELSE 'observe' END,
      updated_at=excluded.updated_at
  `).bind(
    sourceId, success?1:0, success?0:1, timeout?1:0, blocked?1:0,
    linksFound, validLinks, novelLinks*100, latency, success?0:1,
    success?now:null, success?null:now, now,
    novelLinks, duplicateLinks, novelLinks>0?0:1, novelLinks>0?now:null, null,
    novelLinks>0?'proven':'explore'
  ).run();

  const row=await db.prepare(`SELECT s.priority,s.rank_score,m.* FROM sources s JOIN source_metrics m ON m.source_id=s.id WHERE s.id=?`).bind(sourceId).first();
  if(row){
    const rank=calculateSourceRank({...row,valid_links:Number(row.novel_links||0)},Number(row.priority||50));
    const state=String(row.intelligence_state||'explore');
    const enabled=!['quarantined','disabled'].includes(state);
    await db.prepare(`UPDATE sources SET rank_score=?,enabled=?,updated_at=? WHERE id=?`).bind(rank,enabled?1:0,now,sourceId).run();
  }
}
