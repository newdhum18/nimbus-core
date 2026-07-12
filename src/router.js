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
    if (url.pathname === "/api/foundation/queue-test" && request.method === "POST") {
      requireQueue(env);
      await env.QUEUE.send({ type: "foundation_test", sentAt: new Date().toISOString() });
      return ok({ component: "queue-producer", message: `Test message sent to ${SYSTEM.queue}.` }, 202, cors);
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
    if (url.pathname === "/api/sources/summary" && request.method === "GET") {
      return ok(await sourceSummary(requireDb(env)), 200, cors);
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
      if (data.mode === "keyword") data.keyword = nonEmptyString(data.keyword, { name: "keyword", max: 200 });
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
      "/api/foundation/db-test", "/api/foundation/queue-test", "/api/extract", "/api/repair",
      "/api/sources/catalog", "/api/sources", "/api/sources/summary", "/api/sources/reset",
      "/api/sources/high-yield-defaults", "/api/sources/enable-all", "/api/sources/disable-all",
      "/api/sources/bulk", "/api/sources/ranks/refresh",
      "/api/runs/start", "/api/runs"
    ].includes(url.pathname) || Boolean(runAction || detailMatch || resultsMatch || sourceMatch || sourceDetail);

    if (knownPath) return fail({ code: "METHOD_NOT_ALLOWED", message: "The HTTP method is not allowed for this endpoint", component: "router" }, 405, cors);
    return fail({ code: "NOT_FOUND", message: "The requested endpoint does not exist", component: "router" }, 404, cors);
  } catch (error) {
    const details = errorDetails(error);
    return fail(normalizeErrorPayload(details), details.status, cors);
  }
}
