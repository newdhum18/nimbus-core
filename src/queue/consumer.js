import { acquireLease } from "./lease.js";
import { failOrDead } from "./retry.js";
import { fetchAndExtract } from "../search/crawler.js";
import { uid, nowIso } from "../db/queries.js";
import { syncRunProgress } from "../runs/progress.js";
import { recordSourceResult } from "../sources/metrics.js";
import { SYSTEM } from "../config.js";

async function event(db, {
  runId = null,
  taskId = null,
  type,
  level = "info",
  message,
  details = null
}) {
  await db.prepare(`
    INSERT INTO events(id,run_id,task_id,event_type,level,message,details_json,created_at)
    VALUES(?,?,?,?,?,?,?,?)
  `).bind(
    uid("event"),
    runId,
    taskId,
    type,
    level,
    message,
    details ? JSON.stringify(details) : null,
    nowIso()
  ).run();
}

async function getOrCreatePage(env, task, result) {
  const normalizedUrl = result.finalUrl || task.url;
  const existing = await env.DB.prepare(
    "SELECT id FROM pages WHERE run_id=? AND normalized_url=?"
  ).bind(task.run_id, normalizedUrl).first();

  if (existing?.id) return existing.id;

  const pageId = uid("page");
  await env.DB.prepare(`
    INSERT INTO pages(
      id,run_id,source_id,url,normalized_url,status_code,content_type,
      crawl_depth,fetched_at,error_message
    ) VALUES(?,?,?,?,?,?,?,?,?,?)
  `).bind(
    pageId,
    task.run_id,
    task.source_id,
    task.url,
    normalizedUrl,
    result.status,
    result.contentType,
    0,
    nowIso(),
    result.error
  ).run();
  return pageId;
}

async function persistLinks(env, task, pageId, links) {
  let inserted = 0;
  for (const link of links) {
    const result = await env.DB.prepare(`
      INSERT OR IGNORE INTO links(
        id,run_id,page_id,source_id,url,normalized_url,link_type,has_key,
        validation_status,is_complete,discovered_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      uid("link"),
      task.run_id,
      pageId,
      task.source_id,
      link.normalizedUrl,
      link.normalizedUrl,
      link.type,
      1,
      "valid",
      1,
      nowIso()
    ).run();
    if ((result.meta?.changes || 0) > 0) inserted += 1;
  }
  return inserted;
}

async function processTask(env, taskId) {
  const task = await env.DB.prepare(`
    SELECT t.*,r.status run_status
    FROM run_tasks t
    JOIN runs r ON r.id=t.run_id
    WHERE t.id=?
  `).bind(taskId).first();

  if (!task) return { action: "ack", reason: "missing_task" };
  if (["completed", "cancelled", "dead"].includes(task.status)) {
    return { action: "ack", reason: "terminal_task" };
  }
  if (task.run_status === "cancelled") {
    await env.DB.prepare(`
      UPDATE run_tasks
      SET status='cancelled',completed_at=?,lease_until=NULL,updated_at=?
      WHERE id=? AND status NOT IN ('completed','dead','cancelled')
    `).bind(nowIso(), nowIso(), taskId).run();
    return { action: "ack", reason: "cancelled_run" };
  }
  if (task.run_status === "paused") {
    await env.DB.prepare(`
      UPDATE run_tasks
      SET status='pending',lease_until=NULL,last_error='paused_before_processing',updated_at=?
      WHERE id=? AND status IN ('queued','dispatching','failed')
    `).bind(nowIso(), taskId).run();
    return { action: "ack", reason: "paused_run_returned_to_pending" };
  }
  if (task.run_status === "recovering") {
    await env.DB.prepare(`
      UPDATE run_tasks
      SET status='pending',lease_until=NULL,last_error='recovering_before_processing',updated_at=?
      WHERE id=? AND status IN ('queued','dispatching','failed')
    `).bind(nowIso(), taskId).run();
    return { action: "ack", reason: "recovering_run_returned_to_pending" };
  }
  if (task.run_status !== "running") {
    return { action: "ack", reason: "run_not_running" };
  }

  if (!(await acquireLease(env.DB, taskId))) {
    return { action: "ack", reason: "lease_not_acquired" };
  }

  const current = await env.DB.prepare("SELECT * FROM run_tasks WHERE id=?").bind(taskId).first();

  try {
    const result = await fetchAndExtract(current.url);
    const blocked = [401, 403, 429].includes(result.status);
    const timeout = result.error?.includes("timeout") || false;

    if (!result.ok && (result.status === 0 || result.status >= 500 || result.status === 429)) {
      throw new Error(result.error || `http_${result.status}`);
    }

    const pageId = await getOrCreatePage(env, current, result);
    const insertedLinks = await persistLinks(env, current, pageId, result.links);

    await env.DB.prepare(`
      INSERT INTO visited_urls(
        normalized_url,first_run_id,last_run_id,first_seen_at,last_seen_at,visit_count
      ) VALUES(?,?,?,?,?,1)
      ON CONFLICT(normalized_url) DO UPDATE SET
        last_run_id=excluded.last_run_id,
        last_seen_at=excluded.last_seen_at,
        visit_count=visited_urls.visit_count+1
    `).bind(
      result.finalUrl || current.url,
      current.run_id,
      current.run_id,
      nowIso(),
      nowIso()
    ).run();

    await recordSourceResult(env.DB, current.source_id, {
      success: result.ok,
      timeout,
      blocked,
      linksFound: result.links.length,
      validLinks: result.links.length,
      latency: result.latency
    });

    await env.DB.prepare(`
      UPDATE run_tasks
      SET status='completed',completed_at=?,lease_until=NULL,last_error=NULL,updated_at=?
      WHERE id=?
    `).bind(nowIso(), nowIso(), taskId).run();

    await event(env.DB, {
      runId: current.run_id,
      taskId,
      type: "task_completed",
      message: "Task completed",
      details: { links_found: result.links.length, links_written: insertedLinks }
    });

    const progress = await syncRunProgress(env.DB, current.run_id);
    return { action: "ack", found: result.links.length, progress, runId: current.run_id };
  } catch (error) {
    await recordSourceResult(env.DB, current.source_id, {
      success: false,
      timeout: String(error).includes("timeout"),
      linksFound: 0,
      validLinks: 0,
      latency: 0
    }).catch(() => {});

    await event(env.DB, {
      runId: current.run_id,
      taskId,
      type: "task_failed",
      level: "error",
      message: error instanceof Error ? error.message : String(error)
    }).catch(() => {});

    const state = await failOrDead(env.DB, current, error);
    return {
      action: state === "dead" ? "ack" : "retry",
      delaySeconds: SYSTEM.queueRetryDelaySeconds,
      runId: current.run_id,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function consumeBatch(batch, env) {
  for (const message of batch.messages) {
    try {
      const body = message.body || {};
      if (body.type !== "run_task" || !body.taskId) {
        message.ack();
        continue;
      }

      const result = await processTask(env, body.taskId);
      if (result.action === "retry") {
        message.retry({ delaySeconds: result.delaySeconds || SYSTEM.queueRetryDelaySeconds });
      } else {
        message.ack();
        if (result.runId) {
          const { dispatchPending } = await import("./producer.js");
          await dispatchPending(env, result.runId, SYSTEM.queueDispatchBatch).catch((error) => {
            console.error("queue_followup_dispatch_failed", error);
          });
        }
      }
    } catch (error) {
      console.error("queue_consumer_unhandled", error);
      message.retry({ delaySeconds: SYSTEM.queueRetryDelaySeconds });
    }
  }
}
