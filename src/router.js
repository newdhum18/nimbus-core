import { ok, fail } from "./api/responses.js";
import { AppError, errorDetails } from "./api/errors.js";
import { corsHeaders } from "./api/cors.js";
import { requireDb, requireQueue, positiveInt, nonEmptyString } from "./api/validation.js";
import { SYSTEM } from "./config.js";
import { health, bindings } from "./diagnostics/health.js";
import { diagnostics } from "./diagnostics/report.js";
import { sourceCatalog } from "./sources/catalog.js";
import { seedSources } from "./sources/defaults.js";
import { listSources, getSource, sourceSummary, setSourceEnabled, setSourcesEnabled, setAllSources, restoreHighYieldDefaults, refreshSourceRanks } from "./sources/service.js";
import { startRun } from "./runs/start.js";
import { pauseRun } from "./runs/pause.js";
import { resumeRun } from "./runs/resume.js";
import { cancelRun } from "./runs/cancel.js";
import { recoverTasks } from "./runs/recovery.js";
import { getRun, listRuns } from "./runs/read.js";
import { dispatchPending } from "./queue/producer.js";
import { recoverQueueRuntime } from "./queue/recovery.js";
import { listResults, resultsToCsv } from "./results/service.js";
import { repairDatabase } from "./db/repair.js";
import { extractMegaFolders } from "./extract/mega.js";
import { KEYWORD_CATEGORIES, keywordSuggestions, normalizeCategory } from "./search/keyword-intelligence.js";
import { sourceDiscoverySummary, promoteQualifiedCandidates } from "./sources/discovery.js";
import { queueUsage } from "./queue/usage.js";
import { processPendingDirect } from "./queue/fallback.js";
import { validateMegaFolderUrl, validateStoredLinks } from "./results/mega-validation.js";
import { startSourceDiscovery, processSourceDiscoveryStep, sourceDiscoveryRun, listSourceDiscoveryRuns, sourceDiscoveryAction, cancelActiveSourceDiscoveryRuns } from "./sources/discovery-runs.js";

async function requestBody(request) {
  return request.json().catch(() => ({}));
}

function runActionRoute(pathname) {
  return /^\/api\/runs\/([^/]+)\/(pause|resume|cancel|recover|dispatch|queue-recover)$/.exec(pathname);
}

function runDetailRoute(pathname) {
  return /^\/api\/runs\/([^/]+)$/.exec(pathname);
}

function runResultsRoute(pathname) {
  return /^\/api\/runs\/([^/]+)\/(results|export\.json|export\.csv)$/.exec(pathname);
}

function sourceActionRoute(pathname) {
  return /^\/api\/sources\/([^/]+)\/(enable|disable)$/.exec(pathname);
}

function sourceDetailRoute(pathname) {
  return /^\/api\/sources\/([^/]+)$/.exec(pathname);
}

function normalizeErrorPayload(details) {
  const nested = details.details && typeof details.details === "object" ? details.details : {};
  return {
    code: details.code,
    message: details.message,
    component: details.component,
    runId: nested.run_id ?? nested.runId ?? null,
    taskId: nested.task_id ?? nested.taskId ?? null,
    details: details.details
  };
}

function csvResponse(csv, filename, cors) {
  const headers = new Headers(cors);
  headers.set("content-type", "text/csv; charset=utf-8");
  headers.set("content-disposition", `attachment; filename="${filename}"`);
  return new Response(csv, { status: 200, headers });
}

export async function route(request, env) {
  const url = new URL(request.url);
  const cors = corsHeaders(request);

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });

  try {
    if (url.pathname === "/" && request.method === "GET") {
      return ok({
        system: SYSTEM,
        endpoints: [
          "/health", "/bindings", "/api/status", "/api/diagnostics",
          "/api/sources", "/api/runs", "/api/repair"
        ]
      }, 200, cors);
    }

    if (url.pathname === "/health" && request.method === "GET") return ok(health(), 200, cors);
    if (url.pathname === "/bindings" && request.method === "GET") return ok(bindings(env), 200, cors);
    if (url.pathname === "/api/status" && request.method === "GET") {
      return ok({ system: SYSTEM, bindings: bindings(env) }, 200, cors);
    }
    if (url.pathname === "/api/diagnostics" && request.method === "GET") {
      requireDb(env);
      return ok(await diagnostics(env), 200, cors);
    }
    if (url.pathname === "/api/foundation/db-test" && request.method === "GET") {
      const db = requireDb(env);
      const value = (await db.prepare("SELECT 1 value").first())?.value;
      return ok({ component: "d1", value }, 200, cors);
    }
    if (url.pathname === "/api/queue/usage" && request.method === "GET") return ok(await queueUsage(requireDb(env)),200,cors);
    if (url.pathname === "/api/foundation/queue-test" && request.method === "POST") {
      requireQueue(env);
      await env.QUEUE.send({ type: "foundation_test", sentAt: new Date().toISOString() });
      return ok({ component: "queue-producer", message: `Test message sent to ${SYSTEM.queue}.` }, 202, cors);
    }



    if (url.pathname === "/api/search/categories" && request.method === "GET") {
      return ok({ categories: Object.keys(KEYWORD_CATEGORIES) }, 200, cors);
    }
    if (url.pathname === "/api/search/suggestions" && request.method === "GET") {
      const category = normalizeCategory(url.searchParams.get("category") || "tools");
      const limit = positiveInt(url.searchParams.get("limit"), { name: "limit", min: 1, max: 30, fallback: 12 });
      const seed = url.searchParams.get("seed") || Date.now();
      return ok(await keywordSuggestions(requireDb(env), { category, limit, seed }), 200, cors);
    }

    if (url.pathname === "/api/mega/validate" && request.method === "POST") {
      const data=await requestBody(request);
      const link=nonEmptyString(data.url,{name:"url",max:500});
      return ok(await validateMegaFolderUrl(link),200,cors);
    }
    if (url.pathname === "/api/mega/validate-stored" && request.method === "POST") {
      const data=await requestBody(request);
      const limit=positiveInt(data.limit,{name:"limit",min:1,max:30,fallback:10});
      return ok(await validateStoredLinks(requireDb(env),{runId:data.run_id||null,limit}),200,cors);
    }
    if (url.pathname === "/api/extract" && request.method === "POST") {
      const data = await requestBody(request);
      const text = nonEmptyString(data.text, { name: "text", max: 1_000_000 });
      const links = extractMegaFolders(text, { allowLegacy: data.allowLegacy !== false });
      return ok({ total: links.length, links }, 200, cors);
    }

    if (url.pathname === "/api/repair" && request.method === "POST") {
      requireDb(env);
      return ok(await repairDatabase(env), 200, cors);
    }


    if (url.pathname === "/api/source-discovery/runs" && request.method === "GET") {
      return ok(await listSourceDiscoveryRuns(requireDb(env), { limit: positiveInt(url.searchParams.get("limit"), { name:"limit", min:1, max:100, fallback:20 }) }), 200, cors);
    }
    if (url.pathname === "/api/source-discovery/start" && request.method === "POST") {
      const data=await requestBody(request);
      return ok(await startSourceDiscovery(env,{rounds:data.rounds,profile:data.profile}),201,cors);
    }
    if (url.pathname === "/api/source-discovery/active/cancel" && request.method === "POST") {
      return ok(await cancelActiveSourceDiscoveryRuns(requireDb(env)),200,cors);
    }
    const sourceDiscoveryMatch=/^\/api\/source-discovery\/runs\/([^/]+)(?:\/(step|pause|resume|cancel|recover))?$/.exec(url.pathname);
    if(sourceDiscoveryMatch){
      const [,id,action]=sourceDiscoveryMatch;
      if(request.method==="GET"&&!action)return ok(await sourceDiscoveryRun(requireDb(env),id),200,cors);
      if(request.method==="POST"&&action==="step")return ok(await processSourceDiscoveryStep(env,id),200,cors);
      if(request.method==="POST"&&action){
        const result=await sourceDiscoveryAction(requireDb(env),id,action);
        if(["resume","recover"].includes(action)) await processSourceDiscoveryStep(env,id).catch(()=>{});
        return ok(result,200,cors);
      }
    }

    if (url.pathname === "/api/sources/catalog" && request.method === "GET") {
      const catalog = sourceCatalog();
      return ok({ total: catalog.length, enabled: catalog.filter((source) => source.enabled).length }, 200, cors);
    }
    if (url.pathname === "/api/sources" && request.method === "GET") {
      const db = requireDb(env);
      const enabledParam = url.searchParams.get("enabled");
      let enabled = null;
      if (enabledParam !== null) {
        if (!["true", "false", "1", "0"].includes(enabledParam)) {
          throw new AppError("INVALID_PARAMETER", "enabled must be true, false, 1 or 0", "validation", 400);
        }
        enabled = enabledParam === "true" || enabledParam === "1";
      }
      const limit = positiveInt(url.searchParams.get("limit"), { name: "limit", min: 1, max: 300, fallback: 100 });
      const offset = Number(url.searchParams.get("offset") || 0);
      return ok(await listSources(db, {
        enabled,
        limit,
        offset,
        category: url.searchParams.get("category"),
        sourceType: url.searchParams.get("source_type"),
        search: url.searchParams.get("search"),
        sort: url.searchParams.get("sort") || "priority"
      }), 200, cors);
    }
    if (url.pathname === "/api/sources/control-mode" && request.method === "GET") {
      const db=requireDb(env);const row=await db.prepare("SELECT value FROM settings WHERE key='source_control_mode'").first();
      return ok({mode:["automatic","manual"].includes(row?.value)?row.value:"automatic"},200,cors);
    }
    if (url.pathname === "/api/sources/control-mode" && request.method === "POST") {
      const db=requireDb(env);const data=await requestBody(request);const mode=String(data.mode||"");
      if(!["automatic","manual"].includes(mode))throw new AppError("INVALID_PARAMETER","mode must be automatic or manual","sources",400);
      await db.prepare("INSERT INTO settings(key,value,updated_at) VALUES('source_control_mode',?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at").bind(mode,new Date().toISOString()).run();
      return ok({mode,locked:mode==="manual"},200,cors);
    }
    if (url.pathname === "/api/results/recovery" && request.method === "GET") {
      const db=requireDb(env);const limit=positiveInt(url.searchParams.get("limit"),{name:"limit",min:1,max:200,fallback:100});
      const rows=await db.prepare(`SELECT host,root_url,state,family,quality_grade,confidence,rejection_reason,last_error,extracted_links,pages_tested,last_seen_at FROM source_candidate_domains WHERE state IN ('blocked','candidate','testing','sandbox') AND (blocked_fetches>0 OR failed_fetches>0 OR extracted_links>0 OR rejection_reason IS NOT NULL) ORDER BY CASE WHEN extracted_links>0 THEN 0 ELSE 1 END,blocked_fetches DESC,failed_fetches DESC,last_seen_at DESC LIMIT ?`).bind(limit).all().catch(()=>({results:[]}));
      const items=(rows.results||[]).map(r=>({host:r.host,root_url:r.root_url,url:r.root_url,state:r.state,family:r.family,quality_grade:r.quality_grade,confidence:r.confidence,reason:r.rejection_reason||r.last_error||(Number(r.extracted_links||0)>0?"MEGA signal detected but extraction or validation is incomplete.":"The page was blocked, dynamic, or failed automatic parsing."),mega_signals:Number(r.extracted_links||0),pages_tested:Number(r.pages_tested||0),last_seen_at:r.last_seen_at}));
      return ok({total:items.length,blocked:items.filter(x=>x.state==='blocked').length,dynamic:items.filter(x=>/dynamic|javascript|blocked/i.test(x.reason)).length,encoded:items.filter(x=>/encoded|redirect|parameter/i.test(x.reason)).length,items},200,cors);
    }
    if (url.pathname === "/api/sources/summary" && request.method === "GET") {
      return ok(await sourceSummary(requireDb(env)), 200, cors);
    }
    if (url.pathname === "/api/sources/discovery" && request.method === "GET") {
      return ok(await sourceDiscoverySummary(requireDb(env)), 200, cors);
    }
    if (url.pathname === "/api/sources/discovery/promote" && request.method === "POST") {
      return ok(await promoteQualifiedCandidates(requireDb(env), { limit: 20 }), 200, cors);
    }
    if (url.pathname === "/api/sources/ranks/refresh" && request.method === "POST") {
      return ok(await refreshSourceRanks(requireDb(env)), 200, cors);
    }
    if (url.pathname === "/api/sources/bulk" && request.method === "POST") {
      const data = await requestBody(request);
      if (typeof data.enabled !== "boolean") {
        throw new AppError("INVALID_PARAMETER", "enabled must be a boolean", "validation", 400);
      }
      return ok(await setSourcesEnabled(requireDb(env), data.source_ids, data.enabled), 200, cors);
    }
    if (url.pathname === "/api/sources/reset" && request.method === "POST") {
      const db = requireDb(env);
      return ok(await seedSources(db, { preserveEnabled: true }), 200, cors);
    }
    if (url.pathname === "/api/sources/high-yield-defaults" && request.method === "POST") {
      return ok(await restoreHighYieldDefaults(requireDb(env)), 200, cors);
    }
    if (url.pathname === "/api/sources/enable-all" && request.method === "POST") {
      return ok(await setAllSources(requireDb(env), true), 200, cors);
    }
    if (url.pathname === "/api/sources/disable-all" && request.method === "POST") {
      return ok(await setAllSources(requireDb(env), false), 200, cors);
    }
    const sourceMatch = sourceActionRoute(url.pathname);
    if (sourceMatch && request.method === "POST") {
      const [, sourceId, action] = sourceMatch;
      return ok(await setSourceEnabled(requireDb(env), sourceId, action === "enable"), 200, cors);
    }
    const sourceDetail = sourceDetailRoute(url.pathname);
    if (sourceDetail && request.method === "GET") {
      return ok(await getSource(requireDb(env), sourceDetail[1]), 200, cors);
    }

    if (url.pathname === "/api/runs/start" && request.method === "POST") {
      requireDb(env); requireQueue(env);
      const data = await requestBody(request);
      if (!["autoscan", "keyword"].includes(data.mode)) {
        throw new AppError("INVALID_MODE", "mode must be autoscan or keyword", "runs", 400);
      }
      if (data.mode === "keyword") {
        data.category = normalizeCategory(data.category || "tools");
        data.auto_generate = data.auto_generate === true;
        if (!data.auto_generate) data.keyword = nonEmptyString(data.keyword, { name: "keyword", max: 200 });
      }
      return ok(await startRun(env, data), 201, cors);
    }
    if (url.pathname === "/api/runs" && request.method === "GET") {
      const limit = positiveInt(url.searchParams.get("limit"), { name: "limit", min: 1, max: 100, fallback: 50 });
      return ok({ runs: await listRuns(requireDb(env), limit) }, 200, cors);
    }

    const runAction = runActionRoute(url.pathname);
    if (runAction && request.method === "POST") {
      const [, runId, action] = runAction;
      const db = requireDb(env);
      let result;
      if (action === "pause") result = await pauseRun(db, runId);
      if (action === "resume") { requireQueue(env); result = await resumeRun(env, runId); }
      if (action === "cancel") result = await cancelRun(db, runId);
      if (action === "recover") result = await recoverTasks(db, runId);
      if (action === "dispatch") { requireQueue(env); result = await dispatchPending(env, runId, SYSTEM.queueDispatchBatch); }
      if (action === "queue-recover") { requireQueue(env); result = await recoverQueueRuntime(env, runId); }
      if (result === false) {
        throw new AppError("RUN_STATE_CONFLICT", `Cannot ${action} run in its current state`, "runs", 409, { run_id: runId });
      }
      return ok({ run_id: runId, action, result }, 200, cors);
    }

    const fallbackMatch=/^\/api\/runs\/([^/]+)\/direct-fallback$/.exec(url.pathname);
    if(fallbackMatch && request.method==="POST") return ok(await processPendingDirect(env,fallbackMatch[1]),200,cors);

    const resultsMatch = runResultsRoute(url.pathname);
    if (resultsMatch && request.method === "GET") {
      const [, runId, format] = resultsMatch;
      const limit = format === "results"
        ? positiveInt(url.searchParams.get("limit"), { name: "limit", min: 1, max: 500, fallback: 100 })
        : 10000;
      const offset = Number(url.searchParams.get("offset") || 0);
      if (!Number.isInteger(offset) || offset < 0) throw new AppError("INVALID_PARAMETER", "offset must be zero or greater", "validation", 400);
      const payload = await listResults(requireDb(env), runId, { limit, offset });
      if (format === "export.csv") return csvResponse(resultsToCsv(payload.results), `nimbus-${runId}.csv`, cors);
      return ok(payload, 200, cors);
    }

    const detailMatch = runDetailRoute(url.pathname);
    if (detailMatch && request.method === "GET") {
      return ok(await getRun(requireDb(env), detailMatch[1]), 200, cors);
    }

    const knownPath = [
      "/", "/health", "/bindings", "/api/status", "/api/diagnostics",
      "/api/foundation/db-test", "/api/foundation/queue-test", "/api/queue/usage", "/api/mega/validate", "/api/mega/validate-stored", "/api/search/categories", "/api/search/suggestions", "/api/extract", "/api/repair",
      "/api/sources/catalog", "/api/sources", "/api/sources/summary", "/api/sources/reset",
      "/api/sources/discovery", "/api/sources/discovery/promote",
      "/api/sources/high-yield-defaults", "/api/sources/enable-all", "/api/sources/disable-all",
      "/api/sources/bulk", "/api/sources/ranks/refresh",
      "/api/runs/start", "/api/runs"
    ].includes(url.pathname) || Boolean(runAction || detailMatch || resultsMatch || sourceMatch || sourceDetail || fallbackMatch);

    if (knownPath) return fail({ code: "METHOD_NOT_ALLOWED", message: "The HTTP method is not allowed for this endpoint", component: "router" }, 405, cors);
    return fail({ code: "NOT_FOUND", message: "The requested endpoint does not exist", component: "router" }, 404, cors);
  } catch (error) {
    const details = errorDetails(error);
    return fail(normalizeErrorPayload(details), details.status, cors);
  }
}
