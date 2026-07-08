const VERSION = '27.0.0-full-core-build';
const DB_PREFIX = 'nimbus_v27';
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
const CACHE_TTL_SECONDS = 60 * 60 * 6;
const DEFAULT_QUEUE_LIMIT = 18;
const MAX_DEPTH = 2;
const MAX_PAGE_BYTES = 1200000;

const SEARCH_PATTERNS = [
  '"mega.nz/folder/"',
  '"mega.nz/file/"',
  '"mega.nz/#F!"',
  '"mega.nz/#!"',
  'site:rentry.co "mega.nz/folder/"',
  'site:rentry.co "mega.nz/file/"',
  'site:pastebin.com "mega.nz/folder/"',
  'site:pastebin.com "mega.nz/file/"',
  'site:reddit.com "mega.nz/folder/"',
  'site:reddit.com "mega.nz/file/"',
  'site:github.com "mega.nz/folder/"',
  'site:github.com "mega.nz/file/"',
  'site:archive.org "mega.nz/folder/"',
  'site:archive.org "mega.nz/file/"'
];

const DEFAULT_JSON_SOURCES = [
  {
    name: 'github_code_search_web',
    type: 'html',
    enabled: 1,
    endpoint: 'https://github.com/search?q={q}+mega.nz&type=code',
    note: 'Public GitHub web search fallback. Parsed as HTML links.'
  },
  {
    name: 'reddit_public_search_json',
    type: 'json',
    enabled: 1,
    endpoint: 'https://www.reddit.com/search.json?q={q}%20mega.nz&sort=relevance&limit=25',
    note: 'Public Reddit JSON search, posts and returned selftext/url fields.'
  }
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/reset') return resetPage(url);
    if (!url.pathname.startsWith('/api/')) return serveAsset(request, env);
    return handleApi(request, env, ctx);
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(processQueue(env, { limit: 25, reason: 'scheduled' }));
  }
};

async function serveAsset(request, env) {
  if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') return env.ASSETS.fetch(request);
  return new Response('Nimbus Core asset binding is not available.', { status: 500, headers: { 'content-type': 'text/plain;charset=utf-8' } });
}

async function handleApi(request, env, ctx) {
  const headers = corsHeaders();
  try {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/api/ping') return json(await publicStatus(env), 200, headers);
    if (path === '/api/login') return json(await login(request, env), 200, headers);
    if (path === '/api/session') return json(await session(request, env), 200, headers);

    const auth = await requireAuth(request, env);
    if (!auth.ok) return json(auth, 401, headers);

    if (path === '/api/schema') return json(await schema(env), 200, headers);
    if (path === '/api/search') return json(await startSearch(request, env, ctx), 200, headers);
    if (path === '/api/process-queue') return json(await processQueue(env, { limit: Number(url.searchParams.get('limit') || DEFAULT_QUEUE_LIMIT), reason: 'manual' }), 200, headers);
    if (path === '/api/extract-url') return json(await extractFromUrl(request, env, ctx), 200, headers);
    if (path === '/api/health-check') return json(await healthCheck(request, env, ctx), 200, headers);
    if (path === '/api/latest') return json(await latest(env, url), 200, headers);
    if (path === '/api/archive') return json(await archive(env, url), 200, headers);
    if (path === '/api/pages') return json(await pages(env, url), 200, headers);
    if (path === '/api/queue') return json(await queueList(env, url), 200, headers);
    if (path === '/api/stats') return json(await stats(env), 200, headers);
    if (path === '/api/sources') return json(await sources(env), 200, headers);
    if (path === '/api/upsert-source') return json(await upsertSource(request, env), 200, headers);
    if (path === '/api/export') return exportLinks(env, url, headers);
    if (path === '/api/cleanup') return json(await cleanup(env), 200, headers);
    if (path === '/api/reset-cursor') return json(await resetCursor(env), 200, headers);
    if (path === '/api/diagnostics') return json(await diagnostics(env), 200, headers);
    if (path === '/api/delete-link') return json(await deleteLink(request, env), 200, headers);

    return json({ ok: false, version: VERSION, error: 'not_found', path }, 404, headers);
  } catch (error) {
    return json({ ok: false, version: VERSION, error: 'api_exception', message: String(error && error.message ? error.message : error), stack: shortStack(error) }, 200, headers);
  }
}

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-methods': 'GET,POST,DELETE,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization',
    'cache-control': 'no-store, no-cache, must-revalidate, max-age=0',
    'pragma': 'no-cache',
    'x-nimbus-version': VERSION
  };
}
function json(data, status = 200, extra = {}) { return new Response(JSON.stringify(data, null, 2), { status, headers: { ...extra, 'content-type': 'application/json;charset=utf-8' } }); }
async function readJson(request) { try { return await request.json(); } catch { return {}; } }
function nowIso() { return new Date().toISOString(); }
function nowSec() { return Math.floor(Date.now() / 1000); }
function db(env) { if (!env.DB) throw new Error('DB binding missing. Add Cloudflare D1 binding named DB.'); return env.DB; }
async function run(env, sql, bind = []) { return db(env).prepare(sql).bind(...bind).run(); }
async function all(env, sql, bind = []) { return db(env).prepare(sql).bind(...bind).all(); }
async function first(env, sql, bind = []) { return db(env).prepare(sql).bind(...bind).first(); }
async function runIgnore(env, sql, bind = []) { try { return await run(env, sql, bind); } catch (e) { if (/already exists|duplicate column/i.test(String(e.message || e))) return { success: true, skipped: true }; throw e; } }
function rows(result) { return Array.isArray(result?.results) ? result.results : []; }
function clamp(n, min, max) { return Math.min(max, Math.max(min, Number.isFinite(n) ? n : min)); }
function shortStack(error) { return String(error && error.stack ? error.stack : '').split('\n').slice(0, 6).join('\n'); }

async function publicStatus(env) {
  return { ok: true, version: VERSION, db_bound: !!env.DB, auth_pin_configured: !!env.AUTH_PIN, brave_enabled: !!env.BRAVE_API_KEY, tables: `${DB_PREFIX}_*`, features: ['multi_source', 'dedupe_cleaner', 'link_health', 'crawler_pagination', 'json_sources', 'plugin_architecture', 'reddit_deep_scraper', 'queue_manager', 'background_workers', 'cache_system', 'statistics_dashboard'] };
}

async function login(request, env) {
  const body = await readJson(request);
  if (!env.AUTH_PIN) return { ok: false, version: VERSION, error: 'AUTH_PIN_missing' };
  if (String(body.pin || '') !== String(env.AUTH_PIN)) return { ok: false, version: VERSION, error: 'invalid_pin' };
  return { ok: true, version: VERSION, token: await signToken({ iat: nowSec(), exp: nowSec() + TOKEN_TTL_SECONDS }, env) };
}
async function session(request, env) { return { ...(await requireAuth(request, env)), version: VERSION }; }
async function requireAuth(request, env) {
  if (!env.AUTH_PIN) return { ok: false, error: 'AUTH_PIN_missing' };
  const token = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) return { ok: false, error: 'missing_token' };
  const payload = await verifyToken(token, env);
  if (!payload) return { ok: false, error: 'invalid_token' };
  if (payload.exp && payload.exp < nowSec()) return { ok: false, error: 'expired_token' };
  return { ok: true, user: 'owner' };
}
async function signToken(payload, env) {
  const body = btoaUrl(JSON.stringify(payload));
  const sig = await hmac(body, env.AUTH_PIN || '');
  return `${body}.${sig}`;
}
async function verifyToken(token, env) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const expected = await hmac(body, env.AUTH_PIN || '');
  if (expected !== sig) return null;
  try { return JSON.parse(atobUrl(body)); } catch { return null; }
}
async function hmac(text, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const buf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function btoaUrl(s) { return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''); }
function atobUrl(s) { return atob(String(s).replace(/-/g, '+').replace(/_/g, '/')); }

async function ensureSchema(env) {
  const add = (name, sql, bind = []) => runIgnore(env, sql, bind);
  await add('links', `CREATE TABLE IF NOT EXISTS ${DB_PREFIX}_links (id INTEGER PRIMARY KEY AUTOINCREMENT, mega_url TEXT NOT NULL UNIQUE, normalized_url TEXT, link_type TEXT, source_url TEXT, source_domain TEXT, title TEXT, source_type TEXT, confidence INTEGER, confidence_reason TEXT, discovered_at TEXT, last_seen_at TEXT, health_status TEXT DEFAULT 'unknown', health_code INTEGER, health_message TEXT, health_checked_at TEXT, status TEXT, notes TEXT)`);
  await add('pages', `CREATE TABLE IF NOT EXISTS ${DB_PREFIX}_pages (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT NOT NULL UNIQUE, domain TEXT, title TEXT, parent_url TEXT, source_name TEXT, source_type TEXT, depth INTEGER DEFAULT 0, priority INTEGER DEFAULT 50, status TEXT DEFAULT 'new', retries INTEGER DEFAULT 0, discovered_at TEXT, last_fetch_at TEXT, next_fetch_at TEXT, http_status INTEGER, links_found INTEGER DEFAULT 0, pages_found INTEGER DEFAULT 0, error TEXT)`);
  await add('queue', `CREATE TABLE IF NOT EXISTS ${DB_PREFIX}_queue (id INTEGER PRIMARY KEY AUTOINCREMENT, task_type TEXT NOT NULL, payload TEXT NOT NULL, priority INTEGER DEFAULT 50, status TEXT DEFAULT 'queued', attempts INTEGER DEFAULT 0, max_attempts INTEGER DEFAULT 3, available_at TEXT, locked_at TEXT, created_at TEXT, updated_at TEXT, last_error TEXT)`);
  await add('cache', `CREATE TABLE IF NOT EXISTS ${DB_PREFIX}_cache (cache_key TEXT PRIMARY KEY, value TEXT, expires_at INTEGER, created_at TEXT, updated_at TEXT)`);
  await add('sources', `CREATE TABLE IF NOT EXISTS ${DB_PREFIX}_sources (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE, type TEXT NOT NULL, enabled INTEGER DEFAULT 1, endpoint TEXT NOT NULL, note TEXT, created_at TEXT, updated_at TEXT)`);
  await add('logs', `CREATE TABLE IF NOT EXISTS ${DB_PREFIX}_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, mode TEXT, started_at TEXT, finished_at TEXT, pages_scanned INTEGER, pages_discovered INTEGER, links_found INTEGER, new_links INTEGER, alive_links INTEGER, dead_links INTEGER, unknown_links INTEGER, queue_processed INTEGER, errors TEXT)`);
  await add('state', `CREATE TABLE IF NOT EXISTS ${DB_PREFIX}_state (name TEXT PRIMARY KEY, value TEXT, updated_at TEXT)`);
  await add('idx_links_domain', `CREATE INDEX IF NOT EXISTS idx_${DB_PREFIX}_links_domain ON ${DB_PREFIX}_links(source_domain)`);
  await add('idx_links_health', `CREATE INDEX IF NOT EXISTS idx_${DB_PREFIX}_links_health ON ${DB_PREFIX}_links(health_status)`);
  await add('idx_links_time', `CREATE INDEX IF NOT EXISTS idx_${DB_PREFIX}_links_time ON ${DB_PREFIX}_links(discovered_at)`);
  await add('idx_pages_status', `CREATE INDEX IF NOT EXISTS idx_${DB_PREFIX}_pages_status ON ${DB_PREFIX}_pages(status, priority)`);
  await add('idx_queue_status', `CREATE INDEX IF NOT EXISTS idx_${DB_PREFIX}_queue_status ON ${DB_PREFIX}_queue(status, priority, available_at)`);
  await run(env, `INSERT OR IGNORE INTO ${DB_PREFIX}_state (name,value,updated_at) VALUES ('auto_cursor','0',?)`, [nowIso()]);
  await run(env, `INSERT OR IGNORE INTO ${DB_PREFIX}_state (name,value,updated_at) VALUES ('last_run','{}',?)`, [nowIso()]);
  for (const src of DEFAULT_JSON_SOURCES) {
    await run(env, `INSERT OR IGNORE INTO ${DB_PREFIX}_sources (name,type,enabled,endpoint,note,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`, [src.name, src.type, src.enabled, src.endpoint, src.note, nowIso(), nowIso()]);
  }
}

async function schema(env) {
  await ensureSchema(env);
  const tables = await all(env, `SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '${DB_PREFIX}_%' ORDER BY name`);
  return { ok: true, version: VERSION, db_bound: !!env.DB, tables: rows(tables).map(r => r.name), counts: await getCounts(env), sources: await sourceRows(env) };
}
async function getCounts(env) {
  await ensureSchema(env);
  const q = async sql => Number((await first(env, sql))?.c || 0);
  const last = await first(env, `SELECT MAX(discovered_at) t FROM ${DB_PREFIX}_links`);
  return {
    mega_links: await q(`SELECT COUNT(*) c FROM ${DB_PREFIX}_links`),
    alive_links: await q(`SELECT COUNT(*) c FROM ${DB_PREFIX}_links WHERE health_status='alive'`),
    dead_links: await q(`SELECT COUNT(*) c FROM ${DB_PREFIX}_links WHERE health_status='dead'`),
    unknown_links: await q(`SELECT COUNT(*) c FROM ${DB_PREFIX}_links WHERE COALESCE(health_status,'unknown')='unknown'`),
    pages: await q(`SELECT COUNT(*) c FROM ${DB_PREFIX}_pages`),
    pages_scanned: await q(`SELECT COUNT(*) c FROM ${DB_PREFIX}_pages WHERE status='scanned'`),
    queue_queued: await q(`SELECT COUNT(*) c FROM ${DB_PREFIX}_queue WHERE status='queued'`),
    queue_done: await q(`SELECT COUNT(*) c FROM ${DB_PREFIX}_queue WHERE status='done'`),
    cache_items: await q(`SELECT COUNT(*) c FROM ${DB_PREFIX}_cache`),
    last_discovery: last?.t || null
  };
}
async function getState(env, name) { const r = await first(env, `SELECT value FROM ${DB_PREFIX}_state WHERE name=?`, [name]); return r?.value || null; }
async function setState(env, name, value) { await run(env, `INSERT INTO ${DB_PREFIX}_state (name,value,updated_at) VALUES (?,?,?) ON CONFLICT(name) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`, [name, value, nowIso()]); }

async function startSearch(request, env, ctx) {
  await ensureSchema(env);
  const started = nowIso();
  const body = await readJson(request);
  const query = String(body.query || '').trim();
  const mode = String(body.mode || 'auto');
  const reset = !!body.reset;
  if (reset) await setState(env, 'auto_cursor', '0');
  const baseQueries = query ? buildKeywordQueries(query) : await nextPatternBatch(env, 7);
  const queued = [];
  for (const q of baseQueries) {
    for (const task of await enqueueSearchTasks(env, q, mode)) queued.push(task);
  }
  if (ctx) ctx.waitUntil(processQueue(env, { limit: Number(body.processLimit || DEFAULT_QUEUE_LIMIT), reason: 'auto_after_search' }));
  const summary = { queries: baseQueries, queued: queued.length };
  await logRun(env, { mode: 'start_search', started_at: started, finished_at: nowIso(), queue_processed: queued.length, errors: [] });
  await setState(env, 'last_run', JSON.stringify({ type: 'start_search', summary, at: nowIso() }));
  return { ok: true, version: VERSION, mode, summary, queued: queued.slice(0, 100), counts: await getCounts(env) };
}
function buildKeywordQueries(q) { return [`${q} mega.nz`, `${q} "mega.nz/folder/"`, `${q} "mega.nz/file/"`, `site:reddit.com ${q} mega.nz`, `site:github.com ${q} mega.nz`, `site:pastebin.com ${q} mega.nz`, `site:rentry.co ${q} mega.nz`]; }
async function nextPatternBatch(env, size) {
  let cursor = Number((await getState(env, 'auto_cursor')) || '0');
  const out = [];
  for (let i = 0; i < size; i++) out.push(SEARCH_PATTERNS[(cursor + i) % SEARCH_PATTERNS.length]);
  await setState(env, 'auto_cursor', String((cursor + size) % SEARCH_PATTERNS.length));
  return out;
}
async function enqueueSearchTasks(env, query, mode) {
  const tasks = [
    await enqueue(env, 'search_engine', { engine: 'bing_rss', query }, 80),
    await enqueue(env, 'search_engine', { engine: 'duckduckgo_lite', query }, 75),
    await enqueue(env, 'search_engine', { engine: 'ahmia', query }, 50),
    await enqueue(env, 'reddit_deep', { query }, 70),
    await enqueue(env, 'json_sources', { query }, 65)
  ];
  return tasks.filter(Boolean);
}
async function enqueue(env, task_type, payload, priority = 50, max_attempts = 3) {
  const key = task_type + ':' + stableStringify(payload);
  const exists = await first(env, `SELECT id,status FROM ${DB_PREFIX}_queue WHERE task_type=? AND payload=? AND status IN ('queued','running')`, [task_type, JSON.stringify(payload)]);
  if (exists) return { id: exists.id, task_type, status: exists.status, duplicate: true };
  const now = nowIso();
  await run(env, `INSERT INTO ${DB_PREFIX}_queue (task_type,payload,priority,status,attempts,max_attempts,available_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`, [task_type, JSON.stringify(payload), priority, 'queued', 0, max_attempts, now, now, now]);
  const id = (await first(env, `SELECT last_insert_rowid() id`))?.id;
  return { id, task_type, priority, duplicate: false, key };
}

async function processQueue(env, opts = {}) {
  await ensureSchema(env);
  const started = nowIso();
  const limit = clamp(Number(opts.limit || DEFAULT_QUEUE_LIMIT), 1, 80);
  const tasks = rows(await all(env, `SELECT * FROM ${DB_PREFIX}_queue WHERE status='queued' AND (available_at IS NULL OR available_at<=?) ORDER BY priority DESC,id ASC LIMIT ?`, [nowIso(), limit]));
  let processed = 0, pagesScanned = 0, pagesDiscovered = 0, linksFound = 0, newLinks = 0, alive = 0, dead = 0, unknown = 0;
  const errors = [];
  const results = [];
  const workers = tasks.map(task => handleQueueTask(env, task).catch(e => ({ ok: false, task_id: task.id, error: String(e.message || e) })));
  const settled = await Promise.all(workers);
  for (const r of settled) {
    processed++;
    results.push(r);
    pagesScanned += Number(r.pages_scanned || 0);
    pagesDiscovered += Number(r.pages_discovered || 0);
    linksFound += Number(r.links_found || 0);
    newLinks += Number(r.new_links || 0);
    alive += Number(r.alive_links || 0);
    dead += Number(r.dead_links || 0);
    unknown += Number(r.unknown_links || 0);
    if (!r.ok && r.error) errors.push(r.error);
  }
  await logRun(env, { mode: `process_queue:${opts.reason || 'manual'}`, started_at: started, finished_at: nowIso(), pages_scanned: pagesScanned, pages_discovered: pagesDiscovered, links_found: linksFound, new_links: newLinks, alive_links: alive, dead_links: dead, unknown_links: unknown, queue_processed: processed, errors });
  await setState(env, 'last_run', JSON.stringify({ type: 'process_queue', processed, at: nowIso(), errors: errors.slice(0, 10) }));
  return { ok: true, version: VERSION, processed, results: results.slice(0, 60), counts: await getCounts(env) };
}
async function handleQueueTask(env, task) {
  await markTask(env, task.id, 'running', null);
  try {
    const payload = safeJson(task.payload);
    let result;
    if (task.task_type === 'search_engine') result = await runSearchEngineTask(env, payload);
    else if (task.task_type === 'fetch_page') result = await runFetchPageTask(env, payload);
    else if (task.task_type === 'check_link') result = await runCheckLinkTask(env, payload);
    else if (task.task_type === 'json_sources') result = await runJsonSourcesTask(env, payload);
    else if (task.task_type === 'reddit_deep') result = await runRedditDeepTask(env, payload);
    else result = { ok: false, error: `unknown_task:${task.task_type}` };
    await markTask(env, task.id, result.ok ? 'done' : 'failed', result.error || null);
    return { task_id: task.id, task_type: task.task_type, ...result };
  } catch (e) {
    const attempts = Number(task.attempts || 0) + 1;
    const max = Number(task.max_attempts || 3);
    const msg = String(e.message || e);
    if (attempts < max) await run(env, `UPDATE ${DB_PREFIX}_queue SET status='queued', attempts=?, available_at=?, updated_at=?, last_error=? WHERE id=?`, [attempts, new Date(Date.now() + attempts * 30000).toISOString(), nowIso(), msg, task.id]);
    else await markTask(env, task.id, 'failed', msg);
    return { ok: false, task_id: task.id, task_type: task.task_type, error: msg };
  }
}
async function markTask(env, id, status, error) { await run(env, `UPDATE ${DB_PREFIX}_queue SET status=?, locked_at=?, updated_at=?, last_error=? WHERE id=?`, [status, status === 'running' ? nowIso() : null, nowIso(), error, id]); }

async function runSearchEngineTask(env, payload) {
  const engine = payload.engine;
  const query = payload.query;
  let res;
  if (engine === 'bing_rss') res = await cached(env, `bing:${query}`, () => queryBingRss(query));
  else if (engine === 'duckduckgo_lite') res = await cached(env, `ddg:${query}`, () => queryDuckDuckGoLite(query));
  else if (engine === 'ahmia') res = await cached(env, `ahmia:${query}`, () => queryAhmia(query));
  else if (engine === 'brave' && env.BRAVE_API_KEY) res = await cached(env, `brave:${query}`, () => queryBrave(query, env.BRAVE_API_KEY));
  else return { ok: false, error: `engine_not_available:${engine}` };
  let pagesAdded = 0;
  for (const u of res.urls || []) {
    const p = await savePage(env, u, { source_name: engine, source_type: 'search_engine', depth: 0, priority: 65 });
    if (p.new) pagesAdded++;
    await enqueue(env, 'fetch_page', { url: p.url, depth: 0, source_name: engine }, 60, 3);
  }
  return { ok: true, engine, pages_discovered: pagesAdded, links_found: 0, new_links: 0 };
}
async function runFetchPageTask(env, payload) {
  const url = cleanUrl(payload.url);
  const depth = Number(payload.depth || 0);
  const fetched = await fetchText(url, 12000);
  await updatePageFetch(env, url, fetched);
  if (!fetched.ok) return { ok: false, error: `${url}: ${fetched.error || 'fetch_failed'}`, pages_scanned: 0 };
  const title = extractTitle(fetched.text) || url;
  const megaLinks = extractMegaLinks(fetched.text);
  let newLinks = 0;
  for (const link of megaLinks) {
    const s = await saveMega(env, link, url, title, payload.source_name || 'crawler');
    if (s.new) newLinks++;
    await enqueue(env, 'check_link', { mega_url: s.item.mega_url }, 45, 2);
  }
  let discovered = 0;
  if (depth < MAX_DEPTH) {
    const childPages = extractCandidatePages(fetched.text, url).slice(0, 12);
    for (const child of childPages) {
      const p = await savePage(env, child, { parent_url: url, source_name: payload.source_name || 'crawler', source_type: 'crawler_pagination', depth: depth + 1, priority: Math.max(20, 55 - depth * 10) });
      if (p.new) discovered++;
      await enqueue(env, 'fetch_page', { url: p.url, depth: depth + 1, source_name: payload.source_name || 'crawler' }, Math.max(20, 55 - depth * 10), 2);
    }
  }
  await run(env, `UPDATE ${DB_PREFIX}_pages SET title=?, status='scanned', links_found=?, pages_found=?, last_fetch_at=?, error=NULL WHERE url=?`, [title, megaLinks.length, discovered, nowIso(), url]);
  return { ok: true, url, pages_scanned: 1, pages_discovered: discovered, links_found: megaLinks.length, new_links: newLinks };
}
async function runCheckLinkTask(env, payload) {
  const link = normalizeMega(payload.mega_url || '');
  const h = await checkMegaHealth(link);
  await run(env, `UPDATE ${DB_PREFIX}_links SET health_status=?, health_code=?, health_message=?, health_checked_at=?, last_seen_at=? WHERE mega_url=?`, [h.status, h.code || null, h.message || '', nowIso(), nowIso(), link]);
  return { ok: true, mega_url: link, alive_links: h.status === 'alive' ? 1 : 0, dead_links: h.status === 'dead' ? 1 : 0, unknown_links: h.status === 'unknown' ? 1 : 0, health: h };
}
async function runJsonSourcesTask(env, payload) {
  const query = payload.query || 'mega.nz';
  const srcs = await sourceRows(env);
  let pagesAdded = 0, linksFound = 0, newLinks = 0;
  const details = [];
  for (const src of srcs.filter(s => Number(s.enabled) === 1)) {
    const endpoint = String(src.endpoint || '').replaceAll('{q}', encodeURIComponent(query));
    const result = await fetchText(endpoint, 12000);
    if (!result.ok) { details.push({ source: src.name, ok: false, error: result.error }); continue; }
    if (src.type === 'json' || /\{\s*"|\[\s*\{/m.test(result.text.slice(0, 50))) {
      const obj = safeJson(result.text);
      const strings = collectStrings(obj).join('\n');
      const links = extractMegaLinks(strings);
      linksFound += links.length;
      for (const link of links) {
        const s = await saveMega(env, link, endpoint, src.name, `json_source:${src.name}`);
        if (s.new) newLinks++;
        await enqueue(env, 'check_link', { mega_url: s.item.mega_url }, 45, 2);
      }
      const pages = extractUrlsFromText(strings).slice(0, 15);
      for (const u of pages) {
        const p = await savePage(env, u, { source_name: src.name, source_type: 'json_source', depth: 0, priority: 50 });
        if (p.new) pagesAdded++;
        await enqueue(env, 'fetch_page', { url: p.url, depth: 0, source_name: src.name }, 50, 2);
      }
      details.push({ source: src.name, ok: true, links: links.length, pages: pages.length });
    } else {
      const links = extractMegaLinks(result.text);
      linksFound += links.length;
      for (const link of links) {
        const s = await saveMega(env, link, endpoint, src.name, `html_source:${src.name}`);
        if (s.new) newLinks++;
      }
      const urls = extractCandidatePages(result.text, endpoint).slice(0, 20);
      for (const u of urls) {
        const p = await savePage(env, u, { source_name: src.name, source_type: 'html_source', depth: 0, priority: 45 });
        if (p.new) pagesAdded++;
        await enqueue(env, 'fetch_page', { url: p.url, depth: 0, source_name: src.name }, 45, 2);
      }
      details.push({ source: src.name, ok: true, links: links.length, pages: urls.length });
    }
  }
  return { ok: true, pages_discovered: pagesAdded, links_found: linksFound, new_links: newLinks, details };
}
async function runRedditDeepTask(env, payload) {
  const q = payload.query || 'mega.nz';
  const endpoint = `https://www.reddit.com/search.json?q=${encodeURIComponent(q + ' mega.nz')}&sort=relevance&limit=25`;
  const res = await cached(env, `reddit:${q}`, () => fetchJsonText(endpoint));
  if (!res.ok) return { ok: false, error: res.error || 'reddit_failed' };
  const obj = safeJson(res.text || '{}');
  const posts = (((obj || {}).data || {}).children || []).map(x => x.data || {});
  let linksFound = 0, newLinks = 0, pagesAdded = 0;
  const ranked = [];
  for (const p of posts) {
    const text = [p.title, p.selftext, p.url, p.permalink].filter(Boolean).join('\n');
    const score = Number(p.score || 0) + Number(p.num_comments || 0) * 2;
    const mega = extractMegaLinks(text);
    linksFound += mega.length;
    for (const link of mega) {
      const s = await saveMega(env, link, absoluteReddit(p.permalink || p.url || endpoint), p.title || 'reddit', 'reddit_deep');
      if (s.new) newLinks++;
      await enqueue(env, 'check_link', { mega_url: s.item.mega_url }, 45, 2);
    }
    const postUrl = absoluteReddit(p.permalink || p.url || '');
    if (postUrl) {
      const pp = await savePage(env, postUrl, { source_name: 'reddit_deep', source_type: 'reddit_post_or_comments', depth: 0, priority: Math.min(95, 40 + score) });
      if (pp.new) pagesAdded++;
      await enqueue(env, 'fetch_page', { url: pp.url, depth: 0, source_name: 'reddit_deep' }, Math.min(95, 40 + score), 2);
    }
    ranked.push({ title: p.title || '', score, comments: Number(p.num_comments || 0), links: mega.length });
  }
  ranked.sort((a, b) => b.score - a.score);
  return { ok: true, pages_discovered: pagesAdded, links_found: linksFound, new_links: newLinks, ranked: ranked.slice(0, 10) };
}
function absoluteReddit(u) { if (!u) return ''; if (/^https?:\/\//i.test(u)) return u; if (u.startsWith('/')) return `https://www.reddit.com${u}`; return u; }

async function extractFromUrl(request, env, ctx) {
  await ensureSchema(env);
  const body = await readJson(request);
  const target = cleanUrl(body.url || body.target || '');
  if (!/^https?:\/\//i.test(target)) return { ok: false, version: VERSION, error: 'invalid_url' };
  await savePage(env, target, { source_name: 'manual_extract', source_type: 'manual', depth: 0, priority: 90 });
  await enqueue(env, 'fetch_page', { url: target, depth: 0, source_name: 'manual_extract' }, 90, 3);
  if (ctx) ctx.waitUntil(processQueue(env, { limit: 8, reason: 'manual_extract' }));
  return { ok: true, version: VERSION, queued: target, counts: await getCounts(env) };
}
async function healthCheck(request, env, ctx) {
  await ensureSchema(env);
  const body = await readJson(request);
  if (body.mega_url) {
    const mega = normalizeMega(body.mega_url);
    const exists = await first(env, `SELECT id FROM ${DB_PREFIX}_links WHERE mega_url=?`, [mega]);
    if (!exists) await saveMega(env, mega, 'manual', 'manual', 'manual_health');
    await enqueue(env, 'check_link', { mega_url: mega }, 95, 2);
  } else {
    const limit = clamp(Number(body.limit || 50), 1, 200);
    const rs = rows(await all(env, `SELECT mega_url FROM ${DB_PREFIX}_links WHERE health_checked_at IS NULL OR health_checked_at < ? ORDER BY COALESCE(health_checked_at,'') ASC,id ASC LIMIT ?`, [new Date(Date.now() - 86400000).toISOString(), limit]));
    for (const r of rs) await enqueue(env, 'check_link', { mega_url: r.mega_url }, 50, 2);
  }
  if (ctx) ctx.waitUntil(processQueue(env, { limit: Number(body.processLimit || 20), reason: 'health_check' }));
  return { ok: true, version: VERSION, message: 'health tasks queued', counts: await getCounts(env) };
}

async function cached(env, key, producer, ttl = CACHE_TTL_SECONDS) {
  await ensureSchema(env);
  const now = nowSec();
  const hit = await first(env, `SELECT value FROM ${DB_PREFIX}_cache WHERE cache_key=? AND expires_at>?`, [key, now]);
  if (hit?.value) return safeJson(hit.value);
  const value = await producer();
  await run(env, `INSERT INTO ${DB_PREFIX}_cache (cache_key,value,expires_at,created_at,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(cache_key) DO UPDATE SET value=excluded.value, expires_at=excluded.expires_at, updated_at=excluded.updated_at`, [key, JSON.stringify(value), now + ttl, nowIso(), nowIso()]);
  return value;
}

async function queryBingRss(query) {
  const r = await fetch(`https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`, { headers: ua('NimbusCore/27 search'), cf: { cacheTtl: 0 } });
  const text = await r.text();
  if (!r.ok) return { engine: 'bing_rss', ok: false, urls: [], error: `HTTP ${r.status}` };
  const urls = [];
  for (const m of text.matchAll(/<link>(.*?)<\/link>/gims)) {
    const u = decodeHtml(m[1]).trim();
    if (/^https?:\/\//i.test(u) && !/bing\.com/i.test(u)) urls.push(u);
  }
  return { engine: 'bing_rss', ok: true, urls: dedupe(urls).slice(0, 20) };
}
async function queryDuckDuckGoLite(query) {
  const r = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, { headers: ua('NimbusCore/27 search'), cf: { cacheTtl: 0 } });
  const text = await r.text();
  if (!r.ok) return { engine: 'duckduckgo_lite', ok: false, urls: [], error: `HTTP ${r.status}` };
  const urls = [];
  for (const m of text.matchAll(/href=["']([^"']+)["']/gims)) {
    let u = decodeHtml(m[1]);
    const uddg = /[?&]uddg=([^&]+)/.exec(u);
    if (uddg) u = decodeURIComponent(uddg[1]);
    if (/^https?:\/\//i.test(u) && !/duckduckgo\.com/i.test(u)) urls.push(u);
  }
  return { engine: 'duckduckgo_lite', ok: true, urls: dedupe(urls).slice(0, 20) };
}
async function queryAhmia(query) {
  const r = await fetch(`https://ahmia.fi/search/?q=${encodeURIComponent(query)}`, { headers: ua('NimbusCore/27 search'), cf: { cacheTtl: 0 } });
  const text = await r.text();
  if (!r.ok) return { engine: 'ahmia', ok: false, urls: [], error: `HTTP ${r.status}` };
  const urls = [];
  for (const m of text.matchAll(/href=["']([^"']+)["']/gims)) {
    const u = decodeHtml(m[1]);
    if (/^https?:\/\//i.test(u) && !/ahmia\.fi/i.test(u)) urls.push(u);
  }
  return { engine: 'ahmia', ok: true, urls: dedupe(urls).slice(0, 20) };
}
async function queryBrave(query, key) {
  const r = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=20`, { headers: { 'Accept': 'application/json', 'X-Subscription-Token': key }, cf: { cacheTtl: 0 } });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) return { engine: 'brave', ok: false, urls: [], error: `HTTP ${r.status}` };
  return { engine: 'brave', ok: true, urls: dedupe((data.web?.results || []).map(x => x.url)).slice(0, 20) };
}
async function fetchJsonText(url) {
  const r = await fetch(url, { headers: ua('NimbusCore/27 json'), cf: { cacheTtl: 0 } });
  const text = await r.text();
  return r.ok ? { ok: true, text } : { ok: false, error: `HTTP ${r.status}`, text };
}
function ua(label) { return { 'user-agent': `Mozilla/5.0 (${label})`, 'accept': 'text/html,text/plain,application/json,application/xml,*/*' }; }
async function fetchText(url, timeoutMs) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort('timeout'), timeoutMs);
  try {
    const r = await fetch(url, { redirect: 'follow', signal: controller.signal, headers: ua('NimbusCore/27 crawler'), cf: { cacheTtl: 0 } });
    const ct = r.headers.get('content-type') || '';
    if (!r.ok) return { ok: false, status: r.status, error: `HTTP ${r.status}` };
    if (!/text|html|json|xml|javascript|plain/i.test(ct)) return { ok: false, status: r.status, error: `non_text ${ct}` };
    const text = await r.text();
    return { ok: true, status: r.status, content_type: ct, text: text.slice(0, MAX_PAGE_BYTES) };
  } catch (e) { return { ok: false, error: String(e.message || e) }; }
  finally { clearTimeout(t); }
}
async function checkMegaHealth(megaUrl) {
  if (!isValidMega(megaUrl)) return { status: 'dead', code: 0, message: 'invalid_format' };
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort('timeout'), 10000);
  try {
    const r = await fetch(megaUrl, { method: 'GET', redirect: 'manual', signal: controller.signal, headers: ua('NimbusCore/27 health'), cf: { cacheTtl: 0 } });
    if ([200, 201, 202, 204, 301, 302, 303, 307, 308].includes(r.status)) return { status: 'alive', code: r.status, message: 'reachable' };
    if ([404, 410, 451].includes(r.status)) return { status: 'dead', code: r.status, message: 'not_found' };
    return { status: 'unknown', code: r.status, message: `http_${r.status}` };
  } catch (e) { return { status: 'unknown', code: 0, message: String(e.message || e).slice(0, 120) }; }
  finally { clearTimeout(t); }
}

function extractMegaLinks(text) {
  const decoded = decodeHtml(String(text || ''));
  const found = [];
  const patterns = [
    /https?:\/\/(?:www\.)?mega\.(?:nz|io)\/folder\/[A-Za-z0-9_-]+(?:#[A-Za-z0-9_-]+)?/g,
    /https?:\/\/(?:www\.)?mega\.(?:nz|io)\/file\/[A-Za-z0-9_-]+(?:#[A-Za-z0-9_-]+)?/g,
    /https?:\/\/(?:www\.)?mega\.(?:nz|io)\/#F![A-Za-z0-9!_-]+/g,
    /https?:\/\/(?:www\.)?mega\.(?:nz|io)\/#![A-Za-z0-9!_-]+/g,
    /https?:\/\/(?:www\.)?mega\.(?:nz|io)\/[A-Za-z0-9_#!?&=\/-]+/g
  ];
  for (const rx of patterns) for (const m of decoded.matchAll(rx)) found.push(cleanMega(m[0]));
  return dedupe(found).filter(isValidMega).slice(0, 300);
}
function extractUrlsFromText(text) {
  const out = [];
  for (const m of String(text || '').matchAll(/https?:\/\/[^\s"'<>\])}]+/g)) out.push(cleanUrl(m[0]));
  return dedupe(out).filter(u => /^https?:\/\//i.test(u));
}
function extractCandidatePages(html, baseUrl) {
  const out = [];
  for (const u of extractUrlsFromText(html)) out.push(u);
  for (const m of String(html || '').matchAll(/href=["']([^"']+)["']/gims)) {
    const raw = decodeHtml(m[1]);
    const abs = absolutize(raw, baseUrl);
    if (abs) out.push(abs);
  }
  const baseDomain = hostname(baseUrl);
  return dedupe(out.map(cleanUrl)).filter(u => shouldCrawl(u, baseDomain));
}
function shouldCrawl(u, baseDomain) {
  const d = hostname(u);
  if (!d) return false;
  if (/\.(jpg|jpeg|png|gif|webp|svg|css|woff|woff2|mp4|mp3|zip|rar|7z|exe|dmg)$/i.test(new URL(u).pathname)) return false;
  if (/google|bing|duckduckgo|facebook|twitter|x\.com|instagram|tiktok|youtube|cloudflare|apple|microsoft/i.test(d)) return false;
  if (d === baseDomain || /reddit|github|pastebin|rentry|archive|gist|telegra|meawfy|linktree|linkvertise/i.test(d)) return true;
  return /mega|paste|link|share|download|archive|rentry|reddit|github/i.test(u);
}
function absolutize(raw, base) { try { if (!raw || raw.startsWith('#') || raw.startsWith('javascript:') || raw.startsWith('mailto:')) return ''; return new URL(raw, base).toString(); } catch { return ''; } }
function cleanMega(u) { return String(u || '').replace(/[),.;\]}>'"\s]+$/g, '').replace(/^http:\/\//i, 'https://'); }
function normalizeMega(u) { return cleanMega(u).replace(/^https:\/\/www\./i, 'https://'); }
function isValidMega(u) { return /^https:\/\/(?:www\.)?mega\.(?:nz|io)\/(folder|file)\/[A-Za-z0-9_-]+(?:#[A-Za-z0-9_-]+)?$/i.test(u) || /^https:\/\/(?:www\.)?mega\.(?:nz|io)\/(#F!|#!)[A-Za-z0-9!_-]+$/i.test(u); }
function linkType(u) { if (/\/folder\//i.test(u) || /#F!/i.test(u)) return 'folder'; if (/\/file\//i.test(u) || /#!/i.test(u)) return 'file'; return 'unknown'; }
function confidence(megaUrl, sourceUrl, title, sourceType) {
  let score = 45; const reasons = [];
  if (linkType(megaUrl) === 'folder') { score += 12; reasons.push('folder'); }
  if (linkType(megaUrl) === 'file') { score += 9; reasons.push('file'); }
  const d = hostname(sourceUrl);
  if (/rentry|pastebin|github|reddit|archive|gist|telegra/i.test(d)) { score += 18; reasons.push('known_source'); }
  if (/json|reddit_deep|crawler/i.test(sourceType || '')) { score += 8; reasons.push(sourceType); }
  if (/mega|folder|file|link/i.test(title || '')) { score += 6; reasons.push('title_match'); }
  return { score: Math.min(100, score), reason: reasons.join(', ') || 'extracted' };
}
async function saveMega(env, megaUrl, sourceUrl, title, sourceType) {
  const n = normalizeMega(megaUrl);
  if (!isValidMega(n)) return { new: false, item: { mega_url: n, invalid: true } };
  const now = nowIso(); const domain = hostname(sourceUrl); const score = confidence(n, sourceUrl, title, sourceType);
  await run(env, `INSERT OR IGNORE INTO ${DB_PREFIX}_links (mega_url,normalized_url,link_type,source_url,source_domain,title,source_type,confidence,confidence_reason,discovered_at,last_seen_at,health_status,status,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`, [n, n, linkType(n), sourceUrl, domain, title || '', sourceType || 'extractor', score.score, score.reason, now, now, 'unknown', 'active', '']);
  const changed = await first(env, `SELECT changes() c`);
  await run(env, `UPDATE ${DB_PREFIX}_links SET last_seen_at=?, source_url=COALESCE(source_url,?), source_domain=COALESCE(source_domain,?), title=COALESCE(NULLIF(title,''),?), status='active' WHERE mega_url=?`, [now, sourceUrl, domain, title || '', n]);
  return { new: Number(changed?.c || 0) > 0, item: { mega_url: n, source_url: sourceUrl, source_domain: domain, title: title || '', confidence: score.score, confidence_reason: score.reason } };
}
async function savePage(env, url, meta = {}) {
  const clean = cleanUrl(url); const now = nowIso(); const domain = hostname(clean);
  await run(env, `INSERT OR IGNORE INTO ${DB_PREFIX}_pages (url,domain,title,parent_url,source_name,source_type,depth,priority,status,discovered_at,next_fetch_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`, [clean, domain, meta.title || '', meta.parent_url || '', meta.source_name || '', meta.source_type || 'discovered', Number(meta.depth || 0), Number(meta.priority || 50), 'new', now, now]);
  const changed = await first(env, `SELECT changes() c`);
  await run(env, `UPDATE ${DB_PREFIX}_pages SET priority=MAX(priority,?), last_fetch_at=last_fetch_at WHERE url=?`, [Number(meta.priority || 50), clean]);
  return { new: Number(changed?.c || 0) > 0, url: clean, domain };
}
async function updatePageFetch(env, url, fetched) {
  await run(env, `UPDATE ${DB_PREFIX}_pages SET last_fetch_at=?, http_status=?, status=?, retries=CASE WHEN ? THEN retries ELSE retries+1 END, error=? WHERE url=?`, [nowIso(), fetched.status || null, fetched.ok ? 'fetched' : 'failed', fetched.ok ? 1 : 0, fetched.error || null, cleanUrl(url)]);
}

async function latest(env, url) {
  await ensureSchema(env); const limit = clamp(Number(url.searchParams.get('limit') || 12), 1, 100);
  const rs = await all(env, `SELECT id,mega_url,link_type,source_url,source_domain,title,confidence,confidence_reason,health_status,health_code,health_checked_at,discovered_at,last_seen_at FROM ${DB_PREFIX}_links ORDER BY COALESCE(discovered_at,last_seen_at) DESC,id DESC LIMIT ?`, [limit]);
  return { ok: true, version: VERSION, items: rows(rs), counts: await getCounts(env) };
}
async function archive(env, url) {
  await ensureSchema(env); const limit = clamp(Number(url.searchParams.get('limit') || 50), 1, 200); const offset = Math.max(0, Number(url.searchParams.get('offset') || 0)); const q = String(url.searchParams.get('q') || '').trim(); const health = String(url.searchParams.get('health') || '').trim();
  const wh = []; const bind = [];
  if (q) { wh.push(`(mega_url LIKE ? OR source_url LIKE ? OR title LIKE ? OR source_domain LIKE ?)`); bind.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
  if (health) { wh.push(`health_status=?`); bind.push(health); }
  const where = wh.length ? 'WHERE ' + wh.join(' AND ') : '';
  const rs = await all(env, `SELECT * FROM ${DB_PREFIX}_links ${where} ORDER BY COALESCE(discovered_at,last_seen_at) DESC,id DESC LIMIT ? OFFSET ?`, [...bind, limit, offset]);
  return { ok: true, version: VERSION, offset, limit, next_offset: offset + limit, items: rows(rs), counts: await getCounts(env) };
}
async function pages(env, url) { await ensureSchema(env); const limit = clamp(Number(url.searchParams.get('limit') || 50), 1, 200); const rs = await all(env, `SELECT * FROM ${DB_PREFIX}_pages ORDER BY id DESC LIMIT ?`, [limit]); return { ok: true, version: VERSION, items: rows(rs) }; }
async function queueList(env, url) { await ensureSchema(env); const limit = clamp(Number(url.searchParams.get('limit') || 80), 1, 300); const rs = await all(env, `SELECT id,task_type,priority,status,attempts,max_attempts,available_at,created_at,updated_at,last_error,payload FROM ${DB_PREFIX}_queue ORDER BY CASE status WHEN 'queued' THEN 0 WHEN 'running' THEN 1 WHEN 'failed' THEN 2 ELSE 3 END, priority DESC,id ASC LIMIT ?`, [limit]); return { ok: true, version: VERSION, items: rows(rs), counts: await getCounts(env) }; }
async function stats(env) {
  await ensureSchema(env); const counts = await getCounts(env);
  const sourceDomains = rows(await all(env, `SELECT source_domain domain, COUNT(*) c FROM ${DB_PREFIX}_links GROUP BY source_domain ORDER BY c DESC LIMIT 10`));
  const recentLogs = rows(await all(env, `SELECT * FROM ${DB_PREFIX}_logs ORDER BY id DESC LIMIT 15`));
  const total = counts.mega_links || 0; const successRate = total ? Math.round((counts.alive_links / total) * 10000) / 100 : 0;
  return { ok: true, version: VERSION, counts, success_rate_percent: successRate, source_domains: sourceDomains, recent_logs: recentLogs, last_run: safeJson(await getState(env, 'last_run') || '{}') };
}
async function sourceRows(env) { return rows(await all(env, `SELECT * FROM ${DB_PREFIX}_sources ORDER BY enabled DESC,name ASC`)); }
async function sources(env) { await ensureSchema(env); return { ok: true, version: VERSION, items: await sourceRows(env) }; }
async function upsertSource(request, env) {
  await ensureSchema(env); const b = await readJson(request); const name = String(b.name || '').trim(); const endpoint = String(b.endpoint || '').trim(); const type = String(b.type || 'json').trim();
  if (!name || !endpoint || !/^https?:\/\//i.test(endpoint)) return { ok: false, version: VERSION, error: 'name_and_valid_endpoint_required' };
  await run(env, `INSERT INTO ${DB_PREFIX}_sources (name,type,enabled,endpoint,note,created_at,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(name) DO UPDATE SET type=excluded.type, enabled=excluded.enabled, endpoint=excluded.endpoint, note=excluded.note, updated_at=excluded.updated_at`, [name, type, Number(b.enabled ?? 1), endpoint, String(b.note || ''), nowIso(), nowIso()]);
  return { ok: true, version: VERSION, sources: await sourceRows(env) };
}
async function exportLinks(env, url, headers) {
  await ensureSchema(env); const format = String(url.searchParams.get('format') || 'json').toLowerCase(); const rs = await all(env, `SELECT mega_url,link_type,health_status,source_url,source_domain,title,confidence,discovered_at,last_seen_at,health_checked_at FROM ${DB_PREFIX}_links ORDER BY id DESC LIMIT 10000`); const data = rows(rs);
  if (format === 'csv') { const csv = ['mega_url,link_type,health_status,source_url,source_domain,title,confidence,discovered_at,last_seen_at,health_checked_at'].concat(data.map(r => [r.mega_url, r.link_type, r.health_status, r.source_url, r.source_domain, r.title, r.confidence, r.discovered_at, r.last_seen_at, r.health_checked_at].map(csvCell).join(','))).join('\n'); return new Response(csv, { status: 200, headers: { ...headers, 'content-type': 'text/csv;charset=utf-8', 'content-disposition': 'attachment; filename="nimbus-core-v27-export.csv"' } }); }
  return json({ ok: true, version: VERSION, items: data }, 200, headers);
}
async function cleanup(env) {
  await ensureSchema(env);
  await run(env, `DELETE FROM ${DB_PREFIX}_links WHERE mega_url IS NULL OR mega_url='' OR normalized_url IS NULL OR normalized_url=''`);
  await run(env, `DELETE FROM ${DB_PREFIX}_links WHERE mega_url NOT LIKE 'https://mega.nz/%' AND mega_url NOT LIKE 'https://mega.io/%'`);
  await run(env, `DELETE FROM ${DB_PREFIX}_pages WHERE url IS NULL OR url=''`);
  await run(env, `DELETE FROM ${DB_PREFIX}_cache WHERE expires_at<=?`, [nowSec()]);
  await run(env, `UPDATE ${DB_PREFIX}_queue SET status='queued', locked_at=NULL WHERE status='running'`);
  return { ok: true, version: VERSION, message: 'V27 cleanup complete', counts: await getCounts(env) };
}
async function resetCursor(env) { await ensureSchema(env); await setState(env, 'auto_cursor', '0'); return { ok: true, version: VERSION, message: 'cursor reset' }; }
async function diagnostics(env) { await ensureSchema(env); return { ok: true, version: VERSION, status: await publicStatus(env), counts: await getCounts(env), stats: await stats(env) }; }
async function deleteLink(request, env) { await ensureSchema(env); const body = await readJson(request); const id = Number(body.id || 0); const mega = body.mega_url ? normalizeMega(body.mega_url) : ''; if (id) await run(env, `DELETE FROM ${DB_PREFIX}_links WHERE id=?`, [id]); else if (mega) await run(env, `DELETE FROM ${DB_PREFIX}_links WHERE mega_url=?`, [mega]); else return { ok: false, version: VERSION, error: 'missing_id_or_url' }; return { ok: true, version: VERSION }; }
async function logRun(env, data) { await run(env, `INSERT INTO ${DB_PREFIX}_logs (mode,started_at,finished_at,pages_scanned,pages_discovered,links_found,new_links,alive_links,dead_links,unknown_links,queue_processed,errors) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, [data.mode || '', data.started_at || nowIso(), data.finished_at || nowIso(), Number(data.pages_scanned || 0), Number(data.pages_discovered || 0), Number(data.links_found || 0), Number(data.new_links || 0), Number(data.alive_links || 0), Number(data.dead_links || 0), Number(data.unknown_links || 0), Number(data.queue_processed || 0), JSON.stringify(data.errors || [])]); }

function collectStrings(x, out = []) { if (x == null) return out; if (typeof x === 'string' || typeof x === 'number') out.push(String(x)); else if (Array.isArray(x)) x.forEach(v => collectStrings(v, out)); else if (typeof x === 'object') Object.values(x).forEach(v => collectStrings(v, out)); return out; }
function stableStringify(obj) { return JSON.stringify(obj, Object.keys(obj || {}).sort()); }
function dedupe(arr) { return Array.from(new Set((arr || []).filter(Boolean))); }
function hostname(u) { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } }
function cleanUrl(u) { return String(u || '').trim().replace(/&amp;/g, '&').replace(/[)\]}>'"\s]+$/g, ''); }
function decodeHtml(s) { return String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>'); }
function extractTitle(text) { const m = /<title[^>]*>(.*?)<\/title>/is.exec(String(text || '')); return m ? decodeHtml(m[1]).replace(/\s+/g, ' ').trim().slice(0, 180) : ''; }
function csvCell(v) { return `"${String(v ?? '').replace(/"/g, '""')}"`; }
function safeJson(s) { try { return typeof s === 'string' ? JSON.parse(s || '{}') : (s || {}); } catch { return {}; } }
function resetPage(url) {
  const v = url.searchParams.get('v') || '27';
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nimbus Reset</title><style>body{font-family:system-ui;margin:30px;background:#07111f;color:#e8eefc}.card{max-width:760px;margin:auto;background:#101b2e;border:1px solid #24324e;border-radius:18px;padding:24px}.ok{color:#67e8a5}code{background:#0b1323;padding:3px 6px;border-radius:6px}</style></head><body><div class="card"><h1>Nimbus Core V${escapeHtml(v)} Reset</h1><p class="ok">Reset page loaded.</p><p>Open the application, then run: Login → Check DB → Clean Data → Auto Scan → Process Queue → Check Link Health.</p><p><a href="/">Go to app</a></p><script>localStorage.clear();caches&&caches.keys&&caches.keys().then(keys=>keys.forEach(k=>caches.delete(k)));setTimeout(()=>location.href='/',1200);</script></div></body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html;charset=utf-8', 'cache-control': 'no-store' } });
}
function escapeHtml(s) { return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
