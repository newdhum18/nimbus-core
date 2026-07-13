import { uid, nowIso } from "../db/queries.js";
import { buildQuery } from "../search/keyword.js";
import { autoscanQuery } from "../search/autoscan.js";
import { chunkArray } from "../db/batch.js";
import { dispatchPending } from "../queue/producer.js";
import { AppError } from "../api/errors.js";
import { transitionRun, failRun } from "./lifecycle.js";

export function withRoundIdentity(url, roundIndex) {
  const separator = String(url).includes("#") ? "&" : "#";
  return `${url}${separator}nimbus_round=${Number(roundIndex) + 1}`;
}

export function totalTasksForRounds(sourceCount, rounds) {
  return Number(sourceCount) * Number(rounds);
}

function normalizeRounds(value) {
  const rounds = Number(value ?? 1);
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 100) {
    throw new AppError("INVALID_ROUNDS", "round must be an integer between 1 and 100", "runs", 400);
  }
  return rounds;
}

export async function startRun(env, { mode, keyword = "", round = 1 }) {
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

  const rounds = normalizeRounds(round);
  const sourceRows = await env.DB.prepare(`
    SELECT s.*,
           COALESCE(s.rank_score,0) AS adaptive_rank,
           COALESCE(m.yield_rate,0) AS yield_rate,
           COALESCE(m.consecutive_failures,0) AS consecutive_failures,
           COALESCE(m.average_latency,0) AS average_latency
    FROM sources s
    LEFT JOIN source_metrics m ON m.source_id=s.id
    WHERE s.enabled=1
    ORDER BY
      (COALESCE(s.rank_score,0) + COALESCE(m.yield_rate,0) / 10.0 - COALESCE(m.consecutive_failures,0) * 2.0) DESC,
      s.priority DESC,
      s.id ASC
    LIMIT 80
  `).all();
  const sources = sourceRows.results || [];
  if (!sources.length) {
    throw new AppError("NO_ENABLED_SOURCES", "No enabled sources are available", "runs", 409);
  }

  const runId = uid("run");
  const now = nowIso();
  const totalTasks = totalTasksForRounds(sources.length, rounds);

  await env.DB.prepare(`
    INSERT INTO runs(
      id,mode,keyword,status,total_tasks,created_at,started_at,updated_at
    ) VALUES(?,?,?,?,?,?,?,?)
  `).bind(runId, mode, keyword, "created", totalTasks, now, now, now).run();

  try {
    const taskSpecs = [];
    for (let roundIndex = 0; roundIndex < rounds; roundIndex += 1) {
      const query = mode === "keyword" ? buildQuery(keyword) : autoscanQuery(roundIndex);
      for (const source of sources) {
        taskSpecs.push({ source, query, roundIndex });
      }
    }

    for (const batch of chunkArray(taskSpecs, 20)) {
      const statements = batch.map(({ source, query, roundIndex }) => {
        const baseTaskUrl = source.template_url.replaceAll("{q}", encodeURIComponent(query));
        const taskUrl = withRoundIdentity(baseTaskUrl, roundIndex);
        const adaptivePriority = Math.max(0, Number(source.priority || 0) + Number(source.adaptive_rank || 0) - roundIndex);
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
          adaptivePriority,
          now,
          now
        );
      });
      await env.DB.batch(statements);
    }

    await transitionRun(env.DB, runId, "running", { from: "created" });
    const dispatch = await dispatchPending(env, runId, 20);
    return { runId, totalTasks, rounds, sources: sources.length, strategy: "adaptive-rank-v1", dispatch };
  } catch (error) {
    await failRun(env.DB, runId, error).catch(() => {});
    throw error;
  }
}
