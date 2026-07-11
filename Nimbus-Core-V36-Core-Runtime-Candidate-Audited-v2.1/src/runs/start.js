import { uid, nowIso } from "../db/queries.js";
import { buildQuery } from "../search/keyword.js";
import { autoscanQuery } from "../search/autoscan.js";
import { chunkArray } from "../db/batch.js";
import { dispatchPending } from "../queue/producer.js";
import { AppError } from "../api/errors.js";

export async function startRun(env, { mode, keyword = "", round = 0 }) {
  const active = await env.DB.prepare(
    "SELECT id,status FROM runs WHERE status IN ('running','paused','recovering') LIMIT 1"
  ).first();
  if (active) {
    throw new AppError(
      "ACTIVE_RUN_EXISTS",
      `Active run already exists: ${active.id}`,
      "runs",
      409,
      { run_id: active.id, status: active.status }
    );
  }

  const query = mode === "keyword" ? buildQuery(keyword) : autoscanQuery(round);
  const sourceRows = await env.DB.prepare(
    "SELECT * FROM sources WHERE enabled=1 ORDER BY priority DESC LIMIT 80"
  ).all();
  const sources = sourceRows.results || [];
  if (!sources.length) {
    throw new AppError("NO_ENABLED_SOURCES", "No enabled sources are available", "runs", 409);
  }

  const runId = uid("run");
  const now = nowIso();

  await env.DB.prepare(`
    INSERT INTO runs(
      id,mode,keyword,status,total_tasks,created_at,started_at,updated_at
    ) VALUES(?,?,?,?,?,?,?,?)
  `).bind(runId, mode, keyword, "created", sources.length, now, now, now).run();

  try {
    for (const batch of chunkArray(sources, 20)) {
      const statements = batch.map((source) => {
        const taskUrl = source.template_url.replaceAll("{q}", encodeURIComponent(query));
        return env.DB.prepare(`
          INSERT INTO run_tasks(
            id,run_id,source_id,url,task_type,status,priority,created_at,updated_at
          ) VALUES(?,?,?,?,?,?,?,?,?)
        `).bind(
          uid("task"),
          runId,
          source.id,
          taskUrl,
          "search",
          "pending",
          source.priority,
          now,
          now
        );
      });
      await env.DB.batch(statements);
    }

    await env.DB.prepare(
      "UPDATE runs SET status='running',updated_at=? WHERE id=? AND status='created'"
    ).bind(nowIso(), runId).run();

    const dispatch = await dispatchPending(env, runId, 20);
    return { runId, totalTasks: sources.length, dispatch };
  } catch (error) {
    await env.DB.prepare(`
      UPDATE runs
      SET status='failed',error_message=?,completed_at=?,updated_at=?
      WHERE id=?
    `).bind(
      error instanceof Error ? error.message : String(error),
      nowIso(),
      nowIso(),
      runId
    ).run();
    throw error;
  }
}
