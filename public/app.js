const API = "https://nimbus-core-v36-worker.newdhum18.workers.dev";
const $ = (selector) => document.querySelector(selector);
const state = { runs: [], currentRunId: localStorage.getItem("nimbus.currentRunId") || "", sourceOffset: 0, sourceLimit: 100, poll: null };

function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => node.classList.remove("show"), 2600);
}

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: { "content-type": "application/json", ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({ ok: false, error: { message: `HTTP ${response.status}` } }));
  if (!response.ok || data.ok === false) {
    const error = new Error(data?.error?.message || `HTTP ${response.status}`);
    error.code = data?.error?.code || "HTTP_ERROR";
    error.details = data?.error?.details || null;
    throw error;
  }
  return data;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
}

function metric(value, label) {
  return `<div class="metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`;
}

function showPage(pageId) {
  document.querySelectorAll(".page,.tab").forEach((node) => node.classList.remove("active"));
  $(`#${pageId}`).classList.add("active");
  document.querySelector(`.tab[data-page="${pageId}"]`).classList.add("active");
}

document.querySelectorAll(".tab").forEach((button) => button.addEventListener("click", () => {
  showPage(button.dataset.page);
  if (button.dataset.page === "extract") resetExtract();
  if (button.dataset.page === "archive") loadArchive().catch(reportError);
  if (button.dataset.page === "results") loadResults().catch(reportError);
  if (button.dataset.page === "sources") loadSources().catch(reportError);
}));

function reportError(error, target = null) {
  console.error(error);
  const message = `${error.code ? `${error.code}: ` : ""}${error.message}`;
  if (target) target.textContent = message;
  toast(message);
}

function progressFor(run, counts = {}) {
  const total = Number(run?.total_tasks || 0);
  const done = ["completed", "failed", "cancelled", "dead"].reduce((sum, key) => sum + Number(counts[key] || 0), 0);
  return total ? Math.min(100, Math.round((done / total) * 100)) : 0;
}

async function checkConnection() {
  try {
    const data = await api("/health");
    $("#connection").textContent = `${data.service || "Worker"} — ${data.status || "healthy"}`;
    $("#connection").className = "status ok";
  } catch (error) {
    $("#connection").textContent = `Worker unavailable — ${error.message}`;
    $("#connection").className = "status bad";
  }
}

async function loadRuns() {
  const data = await api("/api/runs?limit=30");
  state.runs = data.runs || [];
  if (!state.currentRunId && state.runs[0]?.id) setCurrentRun(state.runs[0].id);
  if (state.currentRunId && !state.runs.some((run) => run.id === state.currentRunId) && state.runs[0]?.id) setCurrentRun(state.runs[0].id);
  renderRuns();
  updateRunSelect();
  return state.runs;
}

function setCurrentRun(runId) {
  state.currentRunId = runId || "";
  localStorage.setItem("nimbus.currentRunId", state.currentRunId);
}

function updateRunSelect() {
  const select = $("#resultRun");
  select.innerHTML = state.runs.map((run) => `<option value="${escapeHtml(run.id)}">${escapeHtml(run.mode)} · ${escapeHtml(run.status)} · ${escapeHtml(run.id.slice(0, 14))}</option>`).join("");
  if (state.currentRunId) select.value = state.currentRunId;
}

function renderRuns() {
  $("#recentRuns").innerHTML = state.runs.length ? state.runs.map((run) => `
    <div class="item">
      <div class="item-main">
        <strong>${escapeHtml(run.mode)} · ${escapeHtml(run.status)}</strong>
        <small>${escapeHtml(run.id)}${run.keyword ? ` · ${escapeHtml(run.keyword)}` : ""}</small>
      </div>
      <button class="secondary select-run" data-run-id="${escapeHtml(run.id)}" type="button">Open</button>
    </div>`).join("") : '<p class="muted">No runs yet.</p>';
  document.querySelectorAll(".select-run").forEach((button) => button.addEventListener("click", async () => {
    setCurrentRun(button.dataset.runId);
    await loadCurrentRun();
    toast("Run selected");
  }));
}

async function loadCurrentRun() {
  if (!state.currentRunId) {
    $("#currentRunLabel").textContent = "No run selected.";
    $("#runState").textContent = "idle";
    $("#runState").className = "pill neutral";
    $("#progressBar").style.width = "0%";
    return;
  }
  const data = await api(`/api/runs/${encodeURIComponent(state.currentRunId)}`);
  const run = data.run;
  const counts = data.task_counts || {};
  const progress = progressFor(run, counts);
  $("#currentRunLabel").textContent = `${run.mode}${run.keyword ? ` · ${run.keyword}` : ""} · ${run.id}`;
  $("#runState").textContent = run.status;
  $("#runState").className = `pill ${run.status || "neutral"}`;
  $("#progressBar").style.width = `${progress}%`;
  if (["running", "recovering"].includes(run.status)) startPolling(); else stopPolling();
}

async function loadGlobalMetrics() {
  const data = await api("/api/diagnostics");
  const taskMap = Object.fromEntries((data.tasks || []).map((row) => [row.status, Number(row.total || 0)]));
  $("#metrics").innerHTML =
    metric(data.sources?.enabled || 0, "SOURCES ON") +
    metric(Math.max(0, Number(data.sources?.total || 0) - Number(data.sources?.enabled || 0)), "SOURCES OFF") +
    metric(data.runs || 0, "RUNS") +
    metric(data.links || 0, "LINKS") +
    metric(taskMap.pending || 0, "PENDING") +
    metric(taskMap.queued || 0, "QUEUED") +
    metric(taskMap.completed || 0, "COMPLETED") +
    metric((taskMap.failed || 0) + (taskMap.dead || 0), "FAILED / DEAD");
}

async function refreshDashboard() {
  await Promise.all([checkConnection(), loadRuns(), loadGlobalMetrics()]);
  await loadCurrentRun();
}

async function startRun(mode) {
  const log = mode === "autoscan" ? $("#autoLog") : $("#keywordLog");
  const body = { mode };
  if (mode === "autoscan") body.round = Number($("#autoRound").value || 0);
  if (mode === "keyword") {
    body.keyword = $("#keywordInput").value.trim();
    if (!body.keyword) throw new Error("Enter a keyword first.");
  }
  log.textContent = "Starting…";
  const data = await api("/api/runs/start", { method: "POST", body: JSON.stringify(body) });
  setCurrentRun(data.runId);
  log.textContent = JSON.stringify(data, null, 2);
  await refreshDashboard();
  showPage("dashboard");
  toast(`${mode === "autoscan" ? "AutoScan" : "Keyword search"} started`);
}

async function runAction(action) {
  if (!state.currentRunId) throw new Error("Select a run first.");
  const data = await api(`/api/runs/${encodeURIComponent(state.currentRunId)}/${action}`, { method: "POST" });
  toast(`${action} accepted`);
  await refreshDashboard();
  return data;
}

function startPolling() {
  if (state.poll) return;
  state.poll = setInterval(() => refreshDashboard().catch(console.error), 5000);
}
function stopPolling() {
  if (state.poll) clearInterval(state.poll);
  state.poll = null;
}

function resetExtract() {
  if (!$("#extractLog").textContent) $("#extractLog").textContent = "Ready.";
}

async function extractLinks() {
  const text = $("#extractText").value;
  if (!text.trim()) throw new Error("Paste text or HTML first.");
  $("#extractLog").textContent = "Extracting…";
  const data = await api("/api/extract", { method: "POST", body: JSON.stringify({ text, allowLegacy: true }) });
  $("#extractLog").textContent = `${data.total} valid complete folder link(s).`;
  $("#extractList").innerHTML = data.links.length ? data.links.map((link) => `
    <div class="result"><a href="${escapeHtml(link.normalizedUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.normalizedUrl)}</a><small>${escapeHtml(link.type)}</small></div>`).join("") : '<p class="muted">No valid complete folder links found.</p>';
}

async function loadArchive() {
  if (!state.runs.length) await loadRuns();
  const terminal = state.runs.filter((run) => ["completed", "failed", "cancelled"].includes(run.status));
  $("#archiveList").innerHTML = terminal.length ? terminal.map((run) => `
    <div class="item">
      <div class="item-main"><strong>${escapeHtml(run.mode)} · ${escapeHtml(run.status)}</strong><small>${escapeHtml(run.id)}${run.keyword ? ` · ${escapeHtml(run.keyword)}` : ""}</small></div>
      <button class="secondary archive-open" data-run-id="${escapeHtml(run.id)}" type="button">Open</button>
    </div>`).join("") : '<p class="muted">No completed or terminal runs yet.</p>';
  document.querySelectorAll(".archive-open").forEach((button) => button.addEventListener("click", async () => {
    setCurrentRun(button.dataset.runId);
    updateRunSelect();
    showPage("results");
    await loadResults();
  }));
}

async function loadResults() {
  if (!state.runs.length) await loadRuns();
  const runId = $("#resultRun").value || state.currentRunId;
  if (!runId) {
    $("#resultSummary").textContent = "No run selected.";
    $("#resultList").innerHTML = "";
    return;
  }
  setCurrentRun(runId);
  const data = await api(`/api/runs/${encodeURIComponent(runId)}/results?limit=500&offset=0`);
  $("#resultSummary").textContent = `${data.total} result(s) · run ${data.run_status}`;
  $("#resultList").innerHTML = data.results.length ? data.results.map((result) => `
    <div class="result">
      <a href="${escapeHtml(result.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(result.url)}</a>
      <small>${escapeHtml(result.link_type)} · ${escapeHtml(result.validation_status)} · ${escapeHtml(result.source_name || "unknown source")}</small>
    </div>`).join("") : '<p class="muted">No results yet. Running tasks may still be processing.</p>';
}

function openExport(format) {
  const runId = $("#resultRun").value || state.currentRunId;
  if (!runId) return toast("Select a run first");
  window.open(`${API}/api/runs/${encodeURIComponent(runId)}/export.${format}`, "_blank", "noopener");
}

async function loadSources() {
  const [summary, data] = await Promise.all([
    api("/api/sources/summary"),
    api(`/api/sources?limit=${state.sourceLimit}&offset=${state.sourceOffset}&search=${encodeURIComponent($("#sourceSearch").value.trim())}&sort=priority`)
  ]);
  $("#sourceMetrics").innerHTML =
    metric(summary.total || 0, "TOTAL") +
    metric(summary.enabled || 0, "ENABLED") +
    metric(Math.max(0, Number(summary.total || 0) - Number(summary.enabled || 0)), "DISABLED") +
    metric(summary.default_enabled || 80, "DEFAULT ON");
  $("#sourceList").innerHTML = data.sources?.length ? data.sources.map((source) => `
    <label class="source">
      <input type="checkbox" data-source-id="${escapeHtml(source.id)}" ${Number(source.enabled) ? "checked" : ""}>
      <span><strong>${escapeHtml(source.name)}</strong><small>${escapeHtml(source.category || "uncategorized")} · ${escapeHtml(source.source_type || "unknown")} · priority ${escapeHtml(source.priority)} · rank ${escapeHtml(source.rank_score ?? 0)}</small></span>
    </label>`).join("") : '<p class="muted">No matching sources.</p>';
  document.querySelectorAll("[data-source-id]").forEach((checkbox) => checkbox.addEventListener("change", async () => {
    checkbox.disabled = true;
    try {
      await api(`/api/sources/${encodeURIComponent(checkbox.dataset.sourceId)}/${checkbox.checked ? "enable" : "disable"}`, { method: "POST" });
      toast("Source updated");
      await loadSources();
    } catch (error) {
      checkbox.checked = !checkbox.checked;
      reportError(error);
    } finally {
      checkbox.disabled = false;
    }
  }));
}

async function loadTool(path, method = "GET") {
  const target = $("#toolsLog");
  target.textContent = "Loading…";
  try {
    target.textContent = JSON.stringify(await api(path, { method }), null, 2);
  } catch (error) {
    reportError(error, target);
  }
}

$("#refreshAll").onclick = () => refreshDashboard().catch(reportError);
$("#reloadDashboard").onclick = () => refreshDashboard().catch(reportError);
$("#startAuto").onclick = () => startRun("autoscan").catch((error) => reportError(error, $("#autoLog")));
$("#startKeyword").onclick = () => startRun("keyword").catch((error) => reportError(error, $("#keywordLog")));
$("#pauseRun").onclick = () => runAction("pause").catch(reportError);
$("#resumeRun").onclick = () => runAction("resume").catch(reportError);
$("#cancelRun").onclick = () => runAction("cancel").catch(reportError);
$("#recoverRun").onclick = () => runAction("queue-recover").catch(reportError);
$("#dispatchRun").onclick = () => runAction("dispatch").catch(reportError);
$("#resultRun").onchange = () => { setCurrentRun($("#resultRun").value); loadResults().catch(reportError); };
$("#extractBtn").onclick = () => extractLinks().catch((error) => reportError(error, $("#extractLog")));
$("#reloadArchive").onclick = () => loadArchive().catch(reportError);
$("#reloadResults").onclick = () => loadResults().catch(reportError);
$("#exportJson").onclick = () => openExport("json");
$("#exportCsv").onclick = () => openExport("csv");
$("#reloadSources").onclick = () => loadSources().catch(reportError);
$("#sourceSearch").oninput = () => { clearTimeout(state.searchTimer); state.searchTimer = setTimeout(() => loadSources().catch(reportError), 350); };
$("#restoreDefaults").onclick = async () => { try { await api("/api/sources/high-yield-defaults", { method: "POST" }); await loadSources(); toast("Default 80 sources restored"); } catch (error) { reportError(error); } };
$("#refreshRanks").onclick = async () => { try { await api("/api/sources/ranks/refresh", { method: "POST" }); await loadSources(); toast("Ranks refreshed"); } catch (error) { reportError(error); } };
$("#loadDiagnostics").onclick = () => loadTool("/api/diagnostics");
$("#loadBindings").onclick = () => loadTool("/bindings");

refreshDashboard().catch(reportError);
