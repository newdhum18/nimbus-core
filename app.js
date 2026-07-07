const $ = id => document.getElementById(id);
const cfg = window.NIMBUS_CONFIG || {};
let token = localStorage.getItem('nimbus_token') || '';
let archiveOffset = 0;
const pageSize = 60;

async function api(path, opt = {}) {
  const headers = { 'content-type': 'application/json', ...(opt.headers || {}) };
  if (token) headers.authorization = 'Bearer ' + token;
  const res = await fetch((cfg.apiBase || '') + path, { ...opt, headers, cache: 'no-store' });
  const raw = await res.text();
  let data;
  try { data = JSON.parse(raw); } catch { data = { ok: false, error: raw || res.statusText, status: res.status }; }
  if (!res.ok) throw data;
  return data;
}

function boot() {
  bind();
  if (token) showApp(); else showLogin();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/service-worker.js?v=22').catch(() => {});
}
document.addEventListener('DOMContentLoaded', boot);

function bind() {
  $('loginBtn').onclick = login;
  document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => switchView(b.dataset.view));
  $('scanBtn').onclick = () => runScan(false);
  $('moreBtn').onclick = () => runScan(true);
  $('resetCursorBtn').onclick = resetCursor;
  $('manualBtn').onclick = manualSearch;
  $('archiveSearchBtn').onclick = () => { archiveOffset = 0; loadArchive(false); };
  $('archiveMoreBtn').onclick = () => { archiveOffset += pageSize; loadArchive(true); };
  $('sourcesBtn').onclick = loadSources;
  $('pingBtn').onclick = ping;
  $('schemaBtn').onclick = schema;
  $('cleanupBtn').onclick = cleanup;
  $('cacheBtn').onclick = clearCache;
  $('logoutBtn').onclick = logout;
  $('exportJsonBtn').onclick = () => download('/api/export?format=json', 'nimbus-core-v22-export.json');
  $('exportCsvBtn').onclick = () => download('/api/export?format=csv', 'nimbus-core-v22-export.csv');
}

async function login() {
  try {
    const data = await api('/api/login', { method: 'POST', body: JSON.stringify({ pin: $('pinInput').value.trim() }) });
    token = data.token;
    localStorage.setItem('nimbus_token', token);
    $('loginMsg').textContent = 'Login OK';
    showApp();
  } catch (e) { $('loginMsg').textContent = 'Login failed: ' + (e.error || e.message || 'unknown'); }
}
function showLogin() { $('loginView').classList.remove('hidden'); $('appView').classList.add('hidden'); }
function showApp() { $('loginView').classList.add('hidden'); $('appView').classList.remove('hidden'); ping().then(loadDashboard).catch(showApiError); }
function logout() { token = ''; localStorage.removeItem('nimbus_token'); showLogin(); }
function switchView(id) {
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.view === id));
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  $(id).classList.remove('hidden');
  if (id === 'dashboard') loadDashboard();
  if (id === 'archive') { archiveOffset = 0; loadArchive(false); }
  if (id === 'sources') loadSources();
}
function showApiError(e) { $('apiText').textContent = 'Offline'; $('apiDot').style.background = 'var(--danger)'; console.warn(e); }

async function ping() {
  const d = await api('/api/ping');
  $('apiDot').style.background = 'var(--ok)';
  $('apiText').textContent = 'Online';
  $('statVersion').textContent = d.version || 'V22';
  $('settingsLog').textContent = JSON.stringify(d, null, 2);
  return d;
}
async function schema() { $('settingsLog').textContent = JSON.stringify(await api('/api/schema'), null, 2); }
async function cleanup() { $('settingsLog').textContent = JSON.stringify(await api('/api/cleanup', { method: 'POST', body: '{}' }), null, 2); }
async function resetCursor() { $('scanLog').textContent = JSON.stringify(await api('/api/reset-cursor', { method: 'POST', body: '{}' }), null, 2); }

async function loadDashboard() {
  try {
    const s = await api('/api/stats');
    $('statLinks').textContent = s.links || 0;
    $('statManual').textContent = s.manual || 0;
    const l = await api('/api/latest?limit=20');
    renderLinks($('latestList'), l.items || [], false);
  } catch (e) { console.warn(e); }
}
async function runScan(more) {
  $('scanLog').textContent = more ? 'Continuing deeper scan...' : 'Starting link-first scan...';
  try {
    const d = await api('/api/search', { method: 'POST', body: JSON.stringify({ limitPages: more ? 120 : 75 }) });
    $('scanLog').textContent = JSON.stringify({ ok: d.ok, mode: d.mode, cursor_before: d.cursor_before, cursor_after: d.cursor_after, pages_scanned: d.pages_scanned, mega_found: d.mega_found, new_links: d.new_links, manual_sources: d.manual_sources, engines_used: d.engines_used }, null, 2);
    renderLinks($('scanList'), d.items || [], false);
    loadDashboard();
  } catch (e) { $('scanLog').textContent = 'Scan error:\n' + JSON.stringify(e, null, 2); }
}
async function manualSearch() {
  const q = $('manualQ').value.trim();
  if (!q) { $('manualLog').textContent = 'Write a keyword first.'; return; }
  $('manualLog').textContent = 'Searching manual mode...';
  try {
    const d = await api('/api/search', { method: 'POST', body: JSON.stringify({ q, limitPages: 70 }) });
    $('manualLog').textContent = JSON.stringify({ ok: d.ok, mode: d.mode, pages_scanned: d.pages_scanned, mega_found: d.mega_found, new_links: d.new_links, manual_sources: d.manual_sources }, null, 2);
    renderLinks($('manualList'), d.items || [], false);
    loadDashboard();
  } catch (e) { $('manualLog').textContent = JSON.stringify(e, null, 2); }
}
async function loadArchive(append) {
  const q = encodeURIComponent($('archiveQ').value.trim());
  const d = await api(`/api/archive?limit=${pageSize}&offset=${archiveOffset}&q=${q}`);
  renderLinks($('archiveList'), d.items || [], append);
}
async function loadSources() {
  const d = await api('/api/manual-sources?limit=140');
  renderSources($('sourcesList'), d.items || []);
}
function renderLinks(box, items, append) {
  if (!append) box.innerHTML = '';
  if (!items.length && !append) { box.innerHTML = '<p class="muted">No links yet.</p>'; return; }
  for (const x of items) {
    const el = document.createElement('article');
    el.className = 'card';
    el.innerHTML = `<div class="card-head"><h3>${esc(x.title || 'MEGA Link')}</h3><span class="pill">${esc(x.link_type || 'link')} · ${Number(x.confidence || 0)}%</span></div><a class="url" href="${escAttr(x.mega_url)}" target="_blank" rel="noreferrer">${esc(x.mega_url)}</a><div class="meta">Source: ${esc(x.source_host || 'unknown')} · First: ${esc(x.first_seen_at || '')} · Last: ${esc(x.last_seen_at || '')} · Hits: ${Number(x.hit_count || 0)}<br>${esc(x.confidence_reason || '')}</div><div class="card-actions"><a href="${escAttr(x.mega_url)}" target="_blank" rel="noreferrer">Open MEGA</a>${x.source_url ? `<a href="${escAttr(x.source_url)}" target="_blank" rel="noreferrer">Source</a>` : ''}<button data-id="${Number(x.id || 0)}">Delete</button></div>`;
    el.querySelector('button')?.addEventListener('click', async () => { await api('/api/delete-link', { method: 'POST', body: JSON.stringify({ id: x.id }) }); el.remove(); loadDashboard(); });
    box.appendChild(el);
  }
}
function renderSources(box, items) {
  box.innerHTML = '';
  if (!items.length) { box.innerHTML = '<p class="muted">No manual sources.</p>'; return; }
  for (const x of items) {
    const el = document.createElement('article');
    el.className = 'card';
    el.innerHTML = `<div class="card-head"><h3>${esc(x.title || 'Manual Source')}</h3><span class="pill">Manual</span></div><a class="url" href="${escAttr(x.source_url)}" target="_blank" rel="noreferrer">${esc(x.source_url)}</a><div class="meta">${esc(x.reason || 'Manual review')} · ${esc(x.last_seen_at || '')}</div>`;
    box.appendChild(el);
  }
}
async function download(path, name) {
  const res = await fetch(path, { headers: { authorization: 'Bearer ' + token }, cache: 'no-store' });
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
async function clearCache() {
  try {
    if ('caches' in window) { const keys = await caches.keys(); await Promise.all(keys.map(k => caches.delete(k))); }
    if ('serviceWorker' in navigator) { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(r => r.update())); }
    $('settingsLog').textContent = 'Cache cleared. Reopen: /?v=22&fresh=1 or use /reset';
  } catch (e) { $('settingsLog').textContent = 'Cache clear failed: ' + e.message; }
}
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m])); }
function escAttr(s) { return esc(s).replace(/`/g, ''); }
