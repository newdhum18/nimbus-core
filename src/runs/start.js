import { uid, nowIso } from "../db/queries.js";
import { buildAdaptiveQueries } from "../search/keyword.js";
import { autoscanQuery } from "../search/autoscan.js";
import { chunkArray } from "../db/batch.js";
import { dispatchPending } from "../queue/producer.js";
import { AppError } from "../api/errors.js";
import { transitionRun, failRun } from "./lifecycle.js";
import { chooseSources } from "../sources/intelligence.js";
import { seedSources } from "../sources/defaults.js";
import { SYSTEM } from "../config.js";

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

export async function startRun(env, { mode, keyword = "", category = "tools", round = 1, auto_generate = false }) {
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
  const sourceCount = Number((await env.DB.prepare("SELECT COUNT(*) AS total FROM sources").first())?.total || 0);
  if (sourceCount !== SYSTEM.sourceTotal) {
    await seedSources(env.DB, { preserveEnabled: false });
  }
  const sourceRows = await env.DB.prepare(`
    SELECT s.*,
           COALESCE(m.requests,0) AS requests,
           COALESCE(m.successes,0) AS successes,
           COALESCE(m.failures,0) AS failures,
           COALESCE(m.blocks,0) AS blocks,
           COALESCE(m.novel_links,0) AS novel_links,
           COALESCE(m.duplicate_links,0) AS duplicate_links,
           COALESCE(m.zero_yield_runs,0) AS zero_yield_runs,
           COALESCE(m.consecutive_failures,0) AS consecutive_failures,
           COALESCE(m.average_latency,0) AS average_latency,
           m.cooldown_until,m.intelligence_state
    FROM sources s
    LEFT JOIN source_metrics m ON m.source_id=s.id
    WHERE s.enabled=1 OR COALESCE(m.intelligence_state,'explore')='explore'
    ORDER BY s.priority DESC,s.id ASC
  `).all();
  const sourcePool = sourceRows.results || [];
  if (!sourcePool.length) {
    throw new AppError("NO_ENABLED_SOURCES", "No autonomous sources are available", "runs", 409);
  }
  const roundSelections = Array.from({ length: rounds }, (_, roundIndex) =>
    chooseSources(sourcePool, { roundIndex, maxSources: Math.min(24, sourcePool.length) })
  );
  const sources = roundSelections[0] || [];

  const runId = uid("run");
  const now = nowIso();
  const totalTasks = roundSelections.reduce((sum, rows) => sum + rows.length, 0);

  await env.DB.prepare(`
    INSERT INTO runs(
      id,mode,keyword,status,total_tasks,created_at,started_at,updated_at
    ) VALUES(?,?,?,?,?,?,?,?)
  `).bind(runId, mode, keyword, "created", totalTasks, now, now, now).run();

  try {
    const taskSpecs = [];
    const adaptiveQueries = mode === "keyword"
      ? await buildAdaptiveQueries(env.DB,{keyword:auto_generate?"":keyword,category,rounds,seed:`${runId}:${category}`})
      : [];
    for (let roundIndex = 0; roundIndex < rounds; roundIndex += 1) {
      const query = mode === "keyword" ? adaptiveQueries[roundIndex] : autoscanQuery(roundIndex);
      for (const source of roundSelections[roundIndex]) {
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
    return { runId, totalTasks, rounds, sources: sources.length, category: mode === "keyword" ? category : null, generated_queries: mode === "keyword" ? adaptiveQueries : [], strategy: "autonomous-70-20-10-v2", dispatch };
  } catch (error) {
    await failRun(env.DB, runId, error).catch(() => {});
    throw error;
  }
}
