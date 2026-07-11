import { nowIso } from "../db/queries.js";

export async function recordSourceResult(
  db,
  sourceId,
  {
    success,
    timeout = false,
    blocked = false,
    linksFound = 0,
    validLinks = 0,
    latency = 0
  }
) {
  const now = nowIso();
  await db.prepare(`
    INSERT INTO source_metrics(
      source_id,requests,successes,failures,timeouts,blocks,links_found,valid_links,
      yield_rate,average_latency,consecutive_failures,last_success_at,last_failure_at,updated_at
    ) VALUES(?,1,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(source_id) DO UPDATE SET
      requests=source_metrics.requests+1,
      successes=source_metrics.successes+excluded.successes,
      failures=source_metrics.failures+excluded.failures,
      timeouts=source_metrics.timeouts+excluded.timeouts,
      blocks=source_metrics.blocks+excluded.blocks,
      links_found=source_metrics.links_found+excluded.links_found,
      valid_links=source_metrics.valid_links+excluded.valid_links,
      yield_rate=((source_metrics.valid_links+excluded.valid_links)*100.0)/(source_metrics.requests+1),
      average_latency=((source_metrics.average_latency*source_metrics.requests)+excluded.average_latency)/(source_metrics.requests+1),
      consecutive_failures=CASE WHEN excluded.successes=1 THEN 0 ELSE source_metrics.consecutive_failures+1 END,
      last_success_at=COALESCE(excluded.last_success_at,source_metrics.last_success_at),
      last_failure_at=COALESCE(excluded.last_failure_at,source_metrics.last_failure_at),
      updated_at=excluded.updated_at
  `).bind(
    sourceId,
    success ? 1 : 0,
    success ? 0 : 1,
    timeout ? 1 : 0,
    blocked ? 1 : 0,
    linksFound,
    validLinks,
    validLinks * 100,
    latency,
    success ? 0 : 1,
    success ? now : null,
    success ? null : now,
    now
  ).run();
}
