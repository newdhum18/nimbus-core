import { SYSTEM } from "../config.js";
import { currentSchemaVersion } from "../db/migrations.js";

export async function diagnostics(env) {
  const [runs, sources, tasks, links, recentErrors, schemaVersion] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) total FROM runs").first(),
    env.DB.prepare("SELECT COUNT(*) total,SUM(enabled) enabled FROM sources").first(),
    env.DB.prepare("SELECT status,COUNT(*) total FROM run_tasks GROUP BY status").all(),
    env.DB.prepare("SELECT COUNT(*) total FROM links").first(),
    env.DB.prepare(`
      SELECT id,run_id,task_id,event_type,level,message,created_at
      FROM events
      WHERE level='error'
      ORDER BY created_at DESC
      LIMIT 20
    `).all(),
    currentSchemaVersion(env.DB)
  ]);

  return {
    system: SYSTEM,
    schemaVersion,
    runs: Number(runs?.total || 0),
    sources: {
      total: Number(sources?.total || 0),
      enabled: Number(sources?.enabled || 0)
    },
    tasks: tasks.results || [],
    links: Number(links?.total || 0),
    recentErrors: recentErrors.results || []
  };
}
