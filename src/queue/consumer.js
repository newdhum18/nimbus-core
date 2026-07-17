import { acquireLease } from "./lease.js";
import { failOrDead } from "./retry.js";
import { extractDiscoveryContexts, fetchAndExtract, fetchPage } from "../search/crawler.js";
import { adapterForSource } from "../search/adapters/index.js";
import { extractMegaFolders } from "../extract/mega.js";
import { uid, nowIso } from "../db/queries.js";
import { syncRunProgress } from "../runs/progress.js";
import { recordSourceResult } from "../sources/metrics.js";
import { SYSTEM } from "../config.js";
import { validateTaskMessage } from "./contract.js";
import { validateSourceDiscoveryMessage, consumeSourceDiscoveryMessage } from "../sources/discovery-queue.js";
import { recordQueueOperations } from "./usage.js";
import { extractHttpTargets, contentVariants } from "../search/target-decoder.js";
import { learnSearchTerms } from "../search/keyword-intelligence.js";
import { discoverCandidateUrls, registerSourceCandidates } from "../sources/discovery.js";

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


async function recordExtractionRecovery(env, task, result, diagnostic) {
  if (!diagnostic || (result.links || []).length > 0) return;
  const targetUrl = result.finalUrl || task.url;
  let host = "unknown";
  try { host = new URL(targetUrl).hostname.toLowerCase().replace(/^www\./, ""); } catch {}
  const reason = diagnostic.reason || (diagnostic.dynamic ? "dynamic_content_without_mega" : "no_mega_extracted");
  await env.DB.prepare(`
    INSERT INTO extraction_recovery(
      id,run_id,task_id,source_id,url,normalized_url,host,reason,status,http_status,
      content_type,dynamic,encoded_target,embed_detected,markers_json,evidence_json,
      first_seen_at,last_seen_at
    ) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(run_id,normalized_url,reason) DO UPDATE SET
      http_status=excluded.http_status,content_type=excluded.content_type,
      dynamic=excluded.dynamic,encoded_target=excluded.encoded_target,
      embed_detected=excluded.embed_detected,markers_json=excluded.markers_json,
      evidence_json=excluded.evidence_json,last_seen_at=excluded.last_seen_at
  `).bind(
    uid("recovery"),task.run_id,task.id,task.source_id,targetUrl,targetUrl,host,reason,"open",
    Number(result.status || 0),result.contentType || "",diagnostic.dynamic ? 1 : 0,
    diagnostic.encodedTargetDetected ? 1 : 0,diagnostic.hasEmbed ? 1 : 0,
    JSON.stringify(diagnostic.dynamicMarkers || []),JSON.stringify(diagnostic.evidence || {}),
    nowIso(),nowIso()
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
  let novel = 0;
  let duplicates = 0;
  for (const link of links) {
    const seen = await env.DB.prepare(
      "SELECT 1 AS found FROM links WHERE normalized_url=? AND run_id<>? LIMIT 1"
    ).bind(link.normalizedUrl, task.run_id).first();
    if (seen) duplicates += 1; else novel += 1;
    const result = await env.DB.prepare(`
      INSERT OR IGNORE INTO links(
        id,run_id,page_id,source_id,url,normalized_url,link_type,has_key,
        validation_status,is_complete,discovered_at
      ) VALUES(?,?,?,?,?,?,?,?,?,?,?)
    `).bind(
      uid("link"),task.run_id,pageId,task.source_id,link.normalizedUrl,
      link.normalizedUrl,link.type,1,"structurally_valid",1,nowIso()
    ).run();
    if ((result.meta?.changes || 0) > 0) inserted += 1;
  }
  return { inserted, novel, duplicates };
}

export async function processTask(env, messageBody) {
  const taskId = messageBody.task_id;
  const task = await env.DB.prepare(`
    SELECT t.*,r.status run_status,s.source_type,s.name source_name
    FROM run_tasks t
    JOIN runs r ON r.id=t.run_id
    JOIN sources s ON s.id=t.source_id
    WHERE t.id=?
  `).bind(taskId).first();

  if (!task) return { action: "ack", reason: "missing_task" };
  if (task.run_id !== messageBody.run_id) {
    await event(env.DB, { runId: task.run_id, taskId, type: "queue_message_rejected", level: "warning", message: "Queue message run mismatch", details: { message_run_id: messageBody.run_id, message_id: messageBody.message_id } }).catch(() => {});
    return { action: "ack", reason: "cross_run_mismatch" };
  }
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

  const current = await env.DB.prepare(`
    SELECT t.*,s.source_type,s.name source_name
    FROM run_tasks t JOIN sources s ON s.id=t.source_id
    WHERE t.id=?
  `).bind(taskId).first();

  try {
    let result;
    if (["html", "rss", "custom", "json"].includes(String(current.source_type))) {
      const searchPage = await fetchPage(current.url);
      const collected = new Map(extractMegaFolders(searchPage.text || "").map(link => [link.normalizedUrl, link]));
      const learningContexts = extractDiscoveryContexts(searchPage.text || "");
      const visited = new Set([searchPage.finalUrl || current.url]);
      const queue = [];
      let seedTargets = [];

      if (searchPage.ok) {
        try {
          if (["html", "rss", "custom", "json"].includes(String(current.source_type))) {
            const adapter = adapterForSource({ source_type: current.source_type });
            seedTargets = adapter.parse({
              input: { source_id: current.source_id, mode: "autoscan", round: 0, query: "", template_url: current.url },
              body: searchPage.text || ""
            }).targets;
          } else {
            seedTargets = extractHttpTargets(searchPage.text || "", searchPage.finalUrl || current.url);
          }
        } catch {
          seedTargets = extractHttpTargets(searchPage.text || "", searchPage.finalUrl || current.url);
        }
      }

      for (const target of seedTargets.slice(0, SYSTEM.maxChildLinks)) {
        for (const variant of contentVariants(target)) queue.push({ url: variant, depth: 1 });
      }

      let childOk = 0;
      let childLatency = 0;
      let pagesVisited = 0;
      while (queue.length && pagesVisited < SYSTEM.maxPagesPerTask) {
        const item = queue.shift();
        if (!item || item.depth > SYSTEM.maxCrawlDepth || visited.has(item.url)) continue;
        visited.add(item.url);
        pagesVisited += 1;
        const child = await fetchAndExtract(item.url, { timeoutMs: 7000 });
        childLatency += child.latency || 0;
        if (child.ok) childOk += 1;
        for (const link of child.links || []) collected.set(link.normalizedUrl, link);
        for (const context of child.discoveryContexts || []) learningContexts.push(context);

        if (child.ok && item.depth < SYSTEM.maxCrawlDepth) {
          let documentTargets;
          try {
            const adapter = adapterForSource({ source_type: current.source_type });
            documentTargets = adapter.parse({
              input: { source_id: current.source_id, mode: "autoscan", round: item.depth, query: "", template_url: child.finalUrl || item.url },
              body: child.text || ""
            }).targets;
          } catch {
            documentTargets = extractHttpTargets(child.text || "", child.finalUrl || item.url);
          }
          const nested = documentTargets
            .filter(url => !visited.has(url))
            .slice(0, Math.max(2, Math.floor(SYSTEM.maxChildLinks / 2)));
          for (const target of nested) {
            for (const variant of contentVariants(target)) queue.push({ url: variant, depth: item.depth + 1 });
          }
        }
      }
      result = {
        ...searchPage,
        ok: searchPage.ok || childOk > 0,
        links: [...collected.values()],
        latency: (searchPage.latency || 0) + childLatency,
        targetsVisited: pagesVisited,
        discoveryContexts: [...new Set(learningContexts)].slice(0, 30),
        adapterDiagnostics: null
      };
    } else {
      result = await fetchAndExtract(current.url);
    }
    const blocked = [401, 403, 429].includes(result.status);
    const timeout = result.error?.includes("timeout") || false;

    if (!result.ok && (result.status === 0 || result.status >= 500 || result.status === 429)) {
      throw new Error(result.error || `http_${result.status}`);
    }

    const pageId = await getOrCreatePage(env, current, result);
    await recordExtractionRecovery(env, current, result, result.adapterDiagnostics).catch(() => {});
    const linkStats = await persistLinks(env, current, pageId, result.links);
    if ((result.links||[]).length && linkStats.novel > 0) {
      const discoveryText = [result.title || "", ...(result.discoveryContexts || [])].join(" ");
      if (discoveryText.trim()) {
        await learnSearchTerms(env.DB, discoveryText, Math.max(1, linkStats.novel)).catch(()=>{});
      }
    }

    // Phase 14: discover and promote new public source surfaces from successful pages.
    if (result.ok && result.text) {
      const candidates = discoverCandidateUrls(result.text, result.finalUrl || current.url, { limit: 40 });
      if (result.finalUrl && (result.links || []).length) candidates.unshift(result.finalUrl);
      await registerSourceCandidates(env.DB, {
        urls: [...new Set(candidates)],
        sourceId: current.source_id,
        autoscanRunId: current.run_id,
        megaLinksFound: linkStats.novel,
        successful: true
      }).catch(()=>{});
    }

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
      novelLinks: linkStats.novel,
      duplicateLinks: linkStats.duplicates,
      latency: result.latency
    });

    await env.DB.prepare(`
      UPDATE run_tasks
      SET status='completed',completed_at=?,lease_until=NULL,last_error=NULL,updated_at=?
      WHERE id=?
    `).bind(nowIso(), nowIso(), taskId).run();

    await event(env.DB, {
      autoscanRunId: current.run_id,
      taskId,
      type: "task_completed",
      message: "Task completed",
      details: { links_found: result.links.length, links_written: linkStats.inserted, novel_links: linkStats.novel, duplicate_links: linkStats.duplicates, targets_visited: Number(result.targetsVisited || 0), adapter_diagnostics: result.adapterDiagnostics || null }
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
      autoscanRunId: current.run_id,
      taskId,
      type: "task_failed",
      level: "error",
      message: error instanceof Error ? error.message : String(error)
    }).catch(() => {});

    const state = await failOrDead(env.DB, current, error);
    return {
      action: state === "dead" ? "ack" : "retry",
      delaySeconds: SYSTEM.queueRetryDelaySeconds,
      autoscanRunId: current.run_id,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

export async function consumeBatch(batch, env) {
  await recordQueueOperations(env.DB,{reads:batch.messages.length}).catch(()=>{});
  for (const message of batch.messages) {
    try {
      const sourceValidation = validateSourceDiscoveryMessage(message.body);
      if (sourceValidation.ok) {
        await consumeSourceDiscoveryMessage(env, sourceValidation.value);
        message.ack();
        await recordQueueOperations(env.DB,{deletes:1}).catch(()=>{});
        continue;
      }
      const validation = validateTaskMessage(message.body);
      if (!validation.ok) {
        console.warn("queue_message_rejected", validation.reason, validation.fields || []);
        message.ack();
        await recordQueueOperations(env.DB,{deletes:1}).catch(()=>{});
        continue;
      }
      const runIds=new Set();
      let retryNeeded=false;
      for(const item of validation.value.tasks){
        const result=await processTask(env,{...validation.value,task_id:item.task_id,attempt:item.attempt});
        if(result.runId)runIds.add(result.runId);
        if(result.action==='retry')retryNeeded=true;
      }
      // Task retry state is persisted in D1; acknowledge the envelope and let the
      // watchdog/producer re-dispatch only the failed task, avoiding duplicate work.
      message.ack();
      await recordQueueOperations(env.DB,{deletes:1}).catch(()=>{});
      const { dispatchPending } = await import("./producer.js");
      for(const runId of runIds){
        await dispatchPending(env,runId,SYSTEM.queueDispatchTasks).catch(error=>console.error("queue_followup_dispatch_failed",error));
      }
      if(retryNeeded)console.warn("queue_batch_contains_retryable_tasks",validation.value.message_id);
    } catch (error) {
      console.error("queue_consumer_unhandled", error);
      message.retry({ delaySeconds: SYSTEM.queueRetryDelaySeconds });
    }
  }
}
