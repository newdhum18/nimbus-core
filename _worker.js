/* Nimbus Core V27 Complete Zero Build
 * Fresh Cloudflare Pages Worker + D1 backend.
 * Public-source MEGA link discovery, extraction, queue, crawler, cache, health, stats, exports.
 */

const VERSION = '27-complete-zero.1';
const TABLE_PREFIX = 'nimbus_v27';
const DEFAULT_PIN = '0000';
const MAX_FETCH_BYTES = 900000;
const CACHE_TTL_MS = 1000 * 60 * 60 * 12;
const HEALTH_TTL_MS = 1000 * 60 * 60 * 6;
const DEFAULT_USER_AGENT = 'Mozilla/5.0 (compatible; NimbusCore/27; +https://pages.cloudflare.com)';

const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store'
};

const HTML_HEADERS = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store'
};

const MEGA_RE = /https?:\/\/(?:www\.)?mega\.(?:nz|io)\/(?:file|folder)\/[A-Za-z0-9_-]+(?:#[A-Za-z0-9_-]+)?/gi;
const GENERIC_URL_RE = /https?:\/\/[^\s"'<>\\)\]]+/gi;

const CORE_SOURCES = [
  { id: 'bing_rss', name: 'Bing RSS', type: 'rss', enabled: 1, priority: 90, template: 'https://www.bing.com/search?format=rss&q={query}' },
  { id: 'duckduckgo_html', name: 'DuckDuckGo HTML', type: 'html', enabled: 1, priority: 80, template: 'https://duckduckgo.com/html/?q={query}' },
  { id: 'reddit_search', name: 'Reddit Public JSON', type: 'json', enabled: 1, priority: 70, template: 'https://www.reddit.com/search.json?q={query}&sort=relevance&t=all&limit=25' },
  { id: 'github_search_page', name: 'GitHub Web Search', type: 'html', enabled: 1, priority: 50, template: 'https://github.com/search?q={query}&type=code' },
  { id: 'archive_search', name: 'Archive.org Search', type: 'json', enabled: 1, priority: 40, template: 'https://archive.org/advancedsearch.php?q={query}&fl[]=identifier&fl[]=title&rows=25&page=1&output=json' }
];

const QUERY_PATTERNS = [
  '"{keyword}" "mega.nz/file"',
  '"{keyword}" "mega.nz/folder"',
  '"{keyword}" "mega.nz"',
  'site:pastebin.com "{keyword}" "mega.nz"',
  'site:rentry.co "{keyword}" "mega.nz"',
  'site:reddit.com "{keyword}" "mega.nz"',
  'site:github.com "{keyword}" "mega.nz"',
  'site:archive.org "{keyword}" "mega.nz"',
  '"mega.nz/file" "key"',
  '"mega.nz/folder" "index"'
];

const DEMO_HTML = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nimbus Core V27</title></head><body><h1>Nimbus Core V27</h1><p>Static asset fallback.</p></body></html>`;

function nowIso() { return new Date().toISOString(); }
function nowMs() { return Date.now(); }
function uuid() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function normalizeWhitespace(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
function safeJson(obj, status = 200) { return new Response(JSON.stringify(obj, null, 2), { status, headers: JSON_HEADERS }); }
function safeText(text, status = 200, headers = HTML_HEADERS) { return new Response(text, { status, headers }); }
function encodeQ(s) { return encodeURIComponent(String(s || '').trim()); }
function shaKey(input) { return String(input || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 180) || 'empty'; }
function requireDb(env) { if (!env.DB) throw new Error('D1 binding DB is missing. Add D1 database binding named DB in Cloudflare Pages settings.'); return env.DB; }
function pinValue(env) { return String(env.AUTH_PIN || env.NIMBUS_PIN || DEFAULT_PIN); }
function scoreUrl(url, source = '', context = '') {
  let score = 40;
  if (/mega\.(nz|io)\/folder\//i.test(url)) score += 25;
  if (/mega\.(nz|io)\/file\//i.test(url)) score += 20;
  if (/#/.test(url)) score += 10;
  if (/reddit|github|pastebin|rentry|archive/i.test(source + ' ' + context)) score += 8;
  if (url.length > 40) score += 4;
  return Math.min(100, score);
}
function normalizeMegaUrl(url) {
  if (!url) return '';
  let clean = String(url).trim();
  clean = clean.replace(/&amp;/g, '&');
  clean = clean.replace(/[),.;]+$/g, '');
  clean = clean.replace(/^http:\/\//i, 'https://');
  clean = clean.replace(/https:\/\/www\.mega\./i, 'https://mega.');
  return clean;
}
function extractMegaLinks(text) {
  const out = new Map();
  const raw = String(text || '');
  for (const match of raw.matchAll(MEGA_RE)) {
    const url = normalizeMegaUrl(match[0]);
    if (url) out.set(url.toLowerCase(), url);
  }
  return Array.from(out.values());
}
function extractGenericUrls(text) {
  const out = new Set();
  const raw = String(text || '');
  for (const match of raw.matchAll(GENERIC_URL_RE)) {
    let url = match[0].replace(/[),.;]+$/g, '');
    if (url.startsWith('http')) out.add(url);
  }
  return Array.from(out).slice(0, 80);
}
function htmlToText(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}
async function fetchText(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
  try {
    const res = await fetch(url, { headers: { 'user-agent': DEFAULT_USER_AGENT, 'accept': 'text/html,application/json,application/rss+xml,*/*;q=0.8' }, signal: controller.signal, redirect: 'follow' });
    const status = res.status;
    const ct = res.headers.get('content-type') || '';
    let text = await res.text();
    if (text.length > MAX_FETCH_BYTES) text = text.slice(0, MAX_FETCH_BYTES);
    return { ok: res.ok, status, contentType: ct, text, finalUrl: res.url };
  } finally { clearTimeout(timer); }
}
async function fetchJson(url) {
  const got = await fetchText(url);
  let json = null;
  try { json = JSON.parse(got.text); } catch (_) {}
  return { ...got, json };
}
async function runIgnore(db, sql, binds = []) {
  try { return await db.prepare(sql).bind(...binds).run(); } catch (e) { return { error: String(e && e.message || e) }; }
}
async function allIgnore(db, sql, binds = []) {
  try { const r = await db.prepare(sql).bind(...binds).all(); return r.results || []; } catch (_) { return []; }
}
async function oneIgnore(db, sql, binds = []) {
  try { return await db.prepare(sql).bind(...binds).first(); } catch (_) { return null; }
}
async function tableColumns(db, table) {
  const rows = await allIgnore(db, `PRAGMA table_info(${table})`);
  return new Set(rows.map(r => r.name));
}
async function ensureColumn(db, table, column, def) {
  const cols = await tableColumns(db, table);
  if (!cols.has(column)) await runIgnore(db, `ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
}
async function ensureDb(env) {
  const db = requireDb(env);
  await runIgnore(db, `CREATE TABLE IF NOT EXISTS ${TABLE_PREFIX}_meta (key TEXT PRIMARY KEY, value TEXT, updated_at TEXT NOT NULL)`);
  await runIgnore(db, `CREATE TABLE IF NOT EXISTS ${TABLE_PREFIX}_sources (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1, priority INTEGER NOT NULL DEFAULT 50,
    template TEXT NOT NULL, config_json TEXT DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`);
  await runIgnore(db, `CREATE TABLE IF NOT EXISTS ${TABLE_PREFIX}_scans (
    id TEXT PRIMARY KEY, keyword TEXT, status TEXT NOT NULL DEFAULT 'new', started_at TEXT, finished_at TEXT,
    pages_scanned INTEGER DEFAULT 0, links_found INTEGER DEFAULT 0, alive_count INTEGER DEFAULT 0, dead_count INTEGER DEFAULT 0, unknown_count INTEGER DEFAULT 0,
    elapsed_ms INTEGER DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`);
  await runIgnore(db, `CREATE TABLE IF NOT EXISTS ${TABLE_PREFIX}_queue (
    id TEXT PRIMARY KEY, scan_id TEXT, kind TEXT NOT NULL, url TEXT, source_id TEXT, payload TEXT,
    status TEXT NOT NULL DEFAULT 'queued', priority INTEGER NOT NULL DEFAULT 50, attempts INTEGER NOT NULL DEFAULT 0, max_attempts INTEGER NOT NULL DEFAULT 3,
    available_at TEXT NOT NULL, locked_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_error TEXT
  )`);
  await runIgnore(db, `CREATE TABLE IF NOT EXISTS ${TABLE_PREFIX}_results (
    id TEXT PRIMARY KEY, scan_id TEXT, url TEXT NOT NULL UNIQUE, source_id TEXT, source_url TEXT, title TEXT, context TEXT,
    status TEXT NOT NULL DEFAULT 'unknown', score INTEGER NOT NULL DEFAULT 0, health_checked_at TEXT, first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`);
  await runIgnore(db, `CREATE TABLE IF NOT EXISTS ${TABLE_PREFIX}_cache (
    key TEXT PRIMARY KEY, url TEXT, status INTEGER, content_type TEXT, body TEXT, created_at TEXT NOT NULL, expires_at TEXT NOT NULL
  )`);
  await runIgnore(db, `CREATE TABLE IF NOT EXISTS ${TABLE_PREFIX}_logs (
    id TEXT PRIMARY KEY, level TEXT NOT NULL, event TEXT NOT NULL, message TEXT, data_json TEXT, created_at TEXT NOT NULL
  )`);
  await runIgnore(db, `CREATE TABLE IF NOT EXISTS ${TABLE_PREFIX}_settings (
    key TEXT PRIMARY KEY, value TEXT, updated_at TEXT NOT NULL
  )`);

  const migrations = [
    ['sources','created_at','TEXT'], ['sources','updated_at','TEXT'], ['sources','config_json',"TEXT DEFAULT '{}"],
    ['scans','created_at','TEXT'], ['scans','updated_at','TEXT'], ['scans','elapsed_ms','INTEGER DEFAULT 0'],
    ['queue','scan_id','TEXT'], ['queue','available_at','TEXT'], ['queue','created_at','TEXT'], ['queue','updated_at','TEXT'], ['queue','last_error','TEXT'],
    ['results','scan_id','TEXT'], ['results','created_at','TEXT'], ['results','updated_at','TEXT'], ['results','source_url','TEXT'], ['results','health_checked_at','TEXT'],
    ['cache','created_at','TEXT'], ['cache','expires_at','TEXT'], ['logs','created_at','TEXT']
  ];
  for (const [short, col, def] of migrations) await ensureColumn(db, `${TABLE_PREFIX}_${short}`, col, def);
  await runIgnore(db, `CREATE INDEX IF NOT EXISTS idx_v27_queue_status ON ${TABLE_PREFIX}_queue(status, priority, available_at)`);
  await runIgnore(db, `CREATE INDEX IF NOT EXISTS idx_v27_results_status ON ${TABLE_PREFIX}_results(status, score)`);
  await runIgnore(db, `CREATE INDEX IF NOT EXISTS idx_v27_results_scan ON ${TABLE_PREFIX}_results(scan_id)`);
  await runIgnore(db, `CREATE INDEX IF NOT EXISTS idx_v27_logs_created ON ${TABLE_PREFIX}_logs(created_at)`);

  const current = nowIso();
  await runIgnore(db, `INSERT OR REPLACE INTO ${TABLE_PREFIX}_meta(key,value,updated_at) VALUES('version',?,?)`, [VERSION, current]);
  for (const s of CORE_SOURCES) {
    await runIgnore(db, `INSERT OR IGNORE INTO ${TABLE_PREFIX}_sources(id,name,type,enabled,priority,template,config_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`, [s.id, s.name, s.type, s.enabled, s.priority, s.template, '{}', current, current]);
  }
  return db;
}
async function logEvent(db, level, event, message = '', data = {}) {
  await runIgnore(db, `INSERT INTO ${TABLE_PREFIX}_logs(id,level,event,message,data_json,created_at) VALUES(?,?,?,?,?,?)`, [uuid(), level, event, message, JSON.stringify(data).slice(0, 4000), nowIso()]);
}
async function hardReset(env) {
  const db = requireDb(env);
  const tables = ['meta','sources','scans','queue','results','cache','logs','settings'];
  for (const t of tables) await runIgnore(db, `DROP TABLE IF EXISTS ${TABLE_PREFIX}_${t}`);
  await ensureDb(env);
  await logEvent(db, 'info', 'reset', 'Hard reset completed', { version: VERSION });
  return { ok: true, version: VERSION, reset: true };
}
async function cleanData(env) {
  const db = await ensureDb(env);
  await runIgnore(db, `DELETE FROM ${TABLE_PREFIX}_queue`);
  await runIgnore(db, `DELETE FROM ${TABLE_PREFIX}_cache WHERE expires_at < ?`, [nowIso()]);
  await logEvent(db, 'info', 'clean', 'Queue cleared and expired cache removed');
  return { ok: true, version: VERSION };
}
function buildQueries(keyword) {
  const kw = normalizeWhitespace(keyword || '');
  if (kw) return QUERY_PATTERNS.map(p => p.replaceAll('{keyword}', kw));
  return [
    '"mega.nz/file"',
    '"mega.nz/folder"',
    '"mega.nz" "folder"',
    '"mega.nz" "file"',
    'site:pastebin.com "mega.nz"',
    'site:rentry.co "mega.nz"',
    'site:reddit.com "mega.nz"',
    'site:github.com "mega.nz"',
    'site:archive.org "mega.nz"'
  ];
}
async function getSources(db) {
  let rows = await allIgnore(db, `SELECT * FROM ${TABLE_PREFIX}_sources WHERE enabled=1 ORDER BY priority DESC, name ASC`);
  if (!rows.length) {
    const current = nowIso();
    for (const s of CORE_SOURCES) await runIgnore(db, `INSERT OR IGNORE INTO ${TABLE_PREFIX}_sources(id,name,type,enabled,priority,template,config_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`, [s.id, s.name, s.type, s.enabled, s.priority, s.template, '{}', current, current]);
    rows = await allIgnore(db, `SELECT * FROM ${TABLE_PREFIX}_sources WHERE enabled=1 ORDER BY priority DESC, name ASC`);
  }
  return rows;
}
async function queueTask(db, task) {
  const current = nowIso();
  const id = task.id || uuid();
  await runIgnore(db, `INSERT OR IGNORE INTO ${TABLE_PREFIX}_queue(id,scan_id,kind,url,source_id,payload,status,priority,attempts,max_attempts,available_at,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`, [
    id, task.scan_id || '', task.kind, task.url || '', task.source_id || '', JSON.stringify(task.payload || {}), 'queued', task.priority || 50, 0, task.max_attempts || 3, task.available_at || current, current, current
  ]);
  return id;
}
async function upsertResult(db, result) {
  const current = nowIso();
  const url = normalizeMegaUrl(result.url);
  if (!url) return null;
  const id = 'r_' + shaKey(url);
  const score = result.score ?? scoreUrl(url, result.source_id, result.context);
  await runIgnore(db, `INSERT INTO ${TABLE_PREFIX}_results(id,scan_id,url,source_id,source_url,title,context,status,score,first_seen_at,last_seen_at,created_at,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(url) DO UPDATE SET
      scan_id=COALESCE(excluded.scan_id, scan_id), source_id=excluded.source_id, source_url=excluded.source_url, title=excluded.title,
      context=excluded.context, score=MAX(score, excluded.score), last_seen_at=excluded.last_seen_at, updated_at=excluded.updated_at`, [
    id, result.scan_id || '', url, result.source_id || '', result.source_url || '', (result.title || '').slice(0, 300), (result.context || '').slice(0, 900), result.status || 'unknown', score, current, current, current, current
  ]);
  return id;
}
async function cacheGet(db, key) {
  const row = await oneIgnore(db, `SELECT * FROM ${TABLE_PREFIX}_cache WHERE key=? AND expires_at>?`, [key, nowIso()]);
  return row || null;
}
async function cacheSet(db, key, url, got, ttlMs = CACHE_TTL_MS) {
  const current = nowIso();
  const expires = new Date(Date.now() + ttlMs).toISOString();
  await runIgnore(db, `INSERT OR REPLACE INTO ${TABLE_PREFIX}_cache(key,url,status,content_type,body,created_at,expires_at) VALUES(?,?,?,?,?,?,?)`, [key, url, got.status || 0, got.contentType || '', (got.text || '').slice(0, MAX_FETCH_BYTES), current, expires]);
}
async function cachedFetch(db, url) {
  const key = 'fetch_' + shaKey(url);
  const cached = await cacheGet(db, key);
  if (cached) return { ok: true, status: cached.status || 200, contentType: cached.content_type || '', text: cached.body || '', finalUrl: cached.url || url, cached: true };
  const got = await fetchText(url);
  if (got.ok || got.text) await cacheSet(db, key, url, got);
  return { ...got, cached: false };
}
function parseSearchResultsFromHtml(text) {
  const urls = extractGenericUrls(text).filter(u => !/bing\.com\/search|duckduckgo\.com\/html|google\.com\/search/i.test(u));
  return urls.slice(0, 25);
}
function parseRssLinks(text) {
  const out = [];
  const itemRe = /<item>[\s\S]*?<\/item>/gi;
  const linkRe = /<link><!\[CDATA\[([\s\S]*?)\]\]><\/link>|<link>([\s\S]*?)<\/link>/i;
  for (const item of text.match(itemRe) || []) {
    const m = item.match(linkRe);
    if (m) out.push((m[1] || m[2] || '').trim());
  }
  return out.length ? out : extractGenericUrls(text).slice(0, 25);
}
function flattenJson(obj, limit = 120000) {
  const seen = new Set();
  let out = '';
  function walk(v) {
    if (out.length > limit) return;
    if (v == null) return;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') { out += ' ' + String(v); return; }
    if (typeof v !== 'object') return;
    if (seen.has(v)) return;
    seen.add(v);
    if (Array.isArray(v)) { for (const x of v) walk(x); return; }
    for (const k of Object.keys(v)) { out += ' ' + k; walk(v[k]); }
  }
  walk(obj);
  return out;
}
async function processSourceSearch(db, scanId, source, query) {
  const searchUrl = source.template.replace('{query}', encodeQ(query));
  const got = source.type === 'json' ? await fetchJson(searchUrl) : await cachedFetch(db, searchUrl);
  let text = got.text || '';
  let links = [];
  let pageUrls = [];
  if (source.type === 'json') {
    text = got.json ? flattenJson(got.json) : text;
    pageUrls = extractGenericUrls(text).slice(0, 25);
  } else if (source.type === 'rss') {
    pageUrls = parseRssLinks(text);
  } else {
    pageUrls = parseSearchResultsFromHtml(text);
  }
  links = extractMegaLinks(text);
  for (const link of links) await upsertResult(db, { scan_id: scanId, url: link, source_id: source.id, source_url: searchUrl, context: query });
  for (const pageUrl of pageUrls) {
    if (/mega\.(nz|io)\/(file|folder)\//i.test(pageUrl)) await upsertResult(db, { scan_id: scanId, url: pageUrl, source_id: source.id, source_url: searchUrl, context: query });
    else if (/^https?:\/\//i.test(pageUrl)) await queueTask(db, { scan_id: scanId, kind: 'crawl', url: pageUrl, source_id: source.id, priority: source.priority || 50, payload: { depth: 0, query, ref: searchUrl } });
  }
  await logEvent(db, 'info', 'source_search', `${source.id} query processed`, { query, direct_links: links.length, queued_pages: pageUrls.length });
  return { source: source.id, query, direct_links: links.length, queued_pages: pageUrls.length };
}
async function autoScan(env, keyword = '') {
  const db = await ensureDb(env);
  const scanId = uuid();
  const start = nowMs();
  const current = nowIso();
  await runIgnore(db, `INSERT INTO ${TABLE_PREFIX}_scans(id,keyword,status,started_at,created_at,updated_at) VALUES(?,?,?,?,?,?)`, [scanId, keyword || '', 'running', current, current, current]);
  const sources = await getSources(db);
  const queries = buildQueries(keyword).slice(0, 12);
  const tasks = [];
  for (const query of queries) for (const source of sources) tasks.push(processSourceSearch(db, scanId, source, query).catch(e => ({ error: String(e.message || e), source: source.id, query })));
  const settled = await Promise.all(tasks);
  const processSummary = await processQueue(env, 18, scanId);
  const stats = await scanStats(db, scanId);
  const elapsed = nowMs() - start;
  await runIgnore(db, `UPDATE ${TABLE_PREFIX}_scans SET status='done', finished_at=?, pages_scanned=?, links_found=?, alive_count=?, dead_count=?, unknown_count=?, elapsed_ms=?, updated_at=? WHERE id=?`, [nowIso(), stats.pages_scanned, stats.links_found, stats.alive, stats.dead, stats.unknown, elapsed, nowIso(), scanId]);
  await logEvent(db, 'info', 'autoscan', 'AutoScan complete', { scanId, keyword, elapsed });
  return { ok: true, version: VERSION, scan_id: scanId, keyword, sources: sources.length, queries: queries.length, source_results: settled, queue: processSummary, stats: await globalStats(db) };
}
async function scanStats(db, scanId) {
  const links = await oneIgnore(db, `SELECT COUNT(*) c FROM ${TABLE_PREFIX}_results WHERE scan_id=?`, [scanId]);
  const alive = await oneIgnore(db, `SELECT COUNT(*) c FROM ${TABLE_PREFIX}_results WHERE scan_id=? AND status='alive'`, [scanId]);
  const dead = await oneIgnore(db, `SELECT COUNT(*) c FROM ${TABLE_PREFIX}_results WHERE scan_id=? AND status='dead'`, [scanId]);
  const unknown = await oneIgnore(db, `SELECT COUNT(*) c FROM ${TABLE_PREFIX}_results WHERE scan_id=? AND status='unknown'`, [scanId]);
  const pages = await oneIgnore(db, `SELECT COUNT(*) c FROM ${TABLE_PREFIX}_queue WHERE scan_id=? AND kind='crawl'`, [scanId]);
  return { pages_scanned: pages?.c || 0, links_found: links?.c || 0, alive: alive?.c || 0, dead: dead?.c || 0, unknown: unknown?.c || 0 };
}
function discoverNextUrls(pageUrl, text, depth) {
  if (depth >= 2) return [];
  const urls = extractGenericUrls(text);
  const base = new URL(pageUrl);
  const sameHost = urls.filter(u => {
    try { const x = new URL(u); return x.hostname === base.hostname && !/\.(jpg|jpeg|png|gif|webp|svg|pdf|zip|rar|7z|mp4|mp3)$/i.test(x.pathname); } catch { return false; }
  });
  const nextish = sameHost.filter(u => /page=|p=|next|older|after|offset|start|\/page\/\d+/i.test(u));
  return Array.from(new Set([...nextish, ...sameHost])).slice(0, 8);
}
async function crawlPage(db, task) {
  const payload = JSON.parse(task.payload || '{}');
  const depth = Number(payload.depth || 0);
  const got = await cachedFetch(db, task.url);
  const text = (got.text || '') + ' ' + htmlToText(got.text || '');
  const links = extractMegaLinks(text);
  for (const link of links) await upsertResult(db, { scan_id: task.scan_id, url: link, source_id: task.source_id || 'crawler', source_url: task.url, context: normalizeWhitespace(text).slice(0, 600) });
  const nextUrls = discoverNextUrls(task.url, text, depth);
  for (const u of nextUrls) await queueTask(db, { scan_id: task.scan_id, kind: 'crawl', url: u, source_id: task.source_id || 'crawler', priority: Math.max(10, (task.priority || 50) - 10), payload: { depth: depth + 1, parent: task.url } });
  return { links: links.length, next: nextUrls.length };
}
async function processQueue(env, limit = 25, scanId = '') {
  const db = await ensureDb(env);
  const rows = await allIgnore(db, `SELECT * FROM ${TABLE_PREFIX}_queue WHERE status='queued' AND available_at<=? ${scanId ? 'AND scan_id=?' : ''} ORDER BY priority DESC, created_at ASC LIMIT ?`, scanId ? [nowIso(), scanId, limit] : [nowIso(), limit]);
  let done = 0, failed = 0, links = 0, next = 0;
  await Promise.all(rows.map(async row => {
    await runIgnore(db, `UPDATE ${TABLE_PREFIX}_queue SET status='running', locked_at=?, attempts=attempts+1, updated_at=? WHERE id=?`, [nowIso(), nowIso(), row.id]);
    try {
      let result = { links: 0, next: 0 };
      if (row.kind === 'crawl') result = await crawlPage(db, row);
      else if (row.kind === 'health') result = await checkOneResult(db, row.url);
      await runIgnore(db, `UPDATE ${TABLE_PREFIX}_queue SET status='done', updated_at=? WHERE id=?`, [nowIso(), row.id]);
      done++; links += result.links || 0; next += result.next || 0;
    } catch (e) {
      const attempts = Number(row.attempts || 0) + 1;
      const retry = attempts < Number(row.max_attempts || 3);
      const nextTime = new Date(Date.now() + Math.min(60_000 * attempts, 300_000)).toISOString();
      await runIgnore(db, `UPDATE ${TABLE_PREFIX}_queue SET status=?, available_at=?, last_error=?, updated_at=? WHERE id=?`, [retry ? 'queued' : 'failed', nextTime, String(e.message || e).slice(0, 500), nowIso(), row.id]);
      failed++;
    }
  }));
  await logEvent(db, 'info', 'queue', 'Queue processed', { picked: rows.length, done, failed, links, next });
  return { ok: true, version: VERSION, picked: rows.length, done, failed, links, next };
}
async function checkOneResult(db, url) {
  const normalized = normalizeMegaUrl(url);
  let status = 'unknown';
  let httpStatus = 0;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort('timeout'), 9000);
    let res = await fetch(normalized, { method: 'HEAD', redirect: 'follow', headers: { 'user-agent': DEFAULT_USER_AGENT }, signal: controller.signal });
    clearTimeout(timer);
    httpStatus = res.status;
    if (res.status >= 200 && res.status < 400) status = 'alive';
    else if (res.status === 404 || res.status === 410) status = 'dead';
    else status = 'unknown';
  } catch (_) { status = 'unknown'; }
  await runIgnore(db, `UPDATE ${TABLE_PREFIX}_results SET status=?, health_checked_at=?, updated_at=? WHERE url=?`, [status, nowIso(), nowIso(), normalized]);
  return { url: normalized, status, httpStatus };
}
async function checkLinks(env, limit = 25) {
  const db = await ensureDb(env);
  const threshold = new Date(Date.now() - HEALTH_TTL_MS).toISOString();
  const rows = await allIgnore(db, `SELECT url FROM ${TABLE_PREFIX}_results WHERE health_checked_at IS NULL OR health_checked_at < ? ORDER BY score DESC, last_seen_at DESC LIMIT ?`, [threshold, limit]);
  const checked = await Promise.all(rows.map(r => checkOneResult(db, r.url)));
  await logEvent(db, 'info', 'health', 'Health check batch complete', { count: checked.length });
  return { ok: true, version: VERSION, checked, stats: await globalStats(db) };
}
async function extractFromUrl(env, targetUrl) {
  const db = await ensureDb(env);
  const got = await cachedFetch(db, targetUrl);
  const text = (got.text || '') + ' ' + htmlToText(got.text || '');
  const links = extractMegaLinks(text);
  for (const link of links) await upsertResult(db, { scan_id: '', url: link, source_id: 'manual_extract', source_url: targetUrl, context: normalizeWhitespace(text).slice(0, 600) });
  await logEvent(db, 'info', 'extract_url', 'Manual URL extracted', { targetUrl, links: links.length });
  return { ok: true, version: VERSION, target_url: targetUrl, found: links.length, links };
}
async function globalStats(db) {
  const rows = await Promise.all([
    oneIgnore(db, `SELECT COUNT(*) c FROM ${TABLE_PREFIX}_sources WHERE enabled=1`),
    oneIgnore(db, `SELECT COUNT(*) c FROM ${TABLE_PREFIX}_results`),
    oneIgnore(db, `SELECT COUNT(*) c FROM ${TABLE_PREFIX}_results WHERE status='alive'`),
    oneIgnore(db, `SELECT COUNT(*) c FROM ${TABLE_PREFIX}_results WHERE status='dead'`),
    oneIgnore(db, `SELECT COUNT(*) c FROM ${TABLE_PREFIX}_results WHERE status='unknown'`),
    oneIgnore(db, `SELECT COUNT(*) c FROM ${TABLE_PREFIX}_queue WHERE status='queued'`),
    oneIgnore(db, `SELECT COUNT(*) c FROM ${TABLE_PREFIX}_queue WHERE status='done'`),
    oneIgnore(db, `SELECT COUNT(*) c FROM ${TABLE_PREFIX}_cache WHERE expires_at>?`, [nowIso()]),
    oneIgnore(db, `SELECT COUNT(*) c FROM ${TABLE_PREFIX}_scans`),
  ]);
  const [sources, total, alive, dead, unknown, queued, qdone, cache, scans] = rows.map(r => r?.c || 0);
  const success = total ? Math.round((alive / total) * 100) : 0;
  return { version: VERSION, sources, total_links: total, alive, dead, unknown, success_rate: success, queue_queued: queued, queue_done: qdone, cache_items: cache, scans };
}
async function diagnostics(env) {
  const db = await ensureDb(env);
  const sources = await getSources(db);
  const cols = {};
  for (const t of ['sources','scans','queue','results','cache','logs','settings']) cols[t] = Array.from(await tableColumns(db, `${TABLE_PREFIX}_${t}`));
  return { ok: true, version: VERSION, db_bound: true, auth_pin_configured: Boolean(env.AUTH_PIN || env.NIMBUS_PIN), sources: sources.map(s => ({ id:s.id, type:s.type, enabled:s.enabled, priority:s.priority })), columns: cols, stats: await globalStats(db) };
}
async function listResults(env, url) {
  const db = await ensureDb(env);
  const q = url.searchParams.get('q') || '';
  const status = url.searchParams.get('status') || '';
  const limit = Math.min(Number(url.searchParams.get('limit') || 100), 500);
  const where = [];
  const binds = [];
  if (q) { where.push('(url LIKE ? OR title LIKE ? OR context LIKE ?)'); binds.push(`%${q}%`, `%${q}%`, `%${q}%`); }
  if (status) { where.push('status=?'); binds.push(status); }
  binds.push(limit);
  const sql = `SELECT * FROM ${TABLE_PREFIX}_results ${where.length ? 'WHERE '+where.join(' AND ') : ''} ORDER BY score DESC, last_seen_at DESC LIMIT ?`;
  const rows = await allIgnore(db, sql, binds);
  return { ok: true, version: VERSION, results: rows, stats: await globalStats(db) };
}
async function exportResults(env, format) {
  const db = await ensureDb(env);
  const rows = await allIgnore(db, `SELECT url,status,score,source_id,source_url,first_seen_at,last_seen_at FROM ${TABLE_PREFIX}_results ORDER BY score DESC,last_seen_at DESC LIMIT 2000`);
  if (format === 'csv') {
    const esc = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const csv = ['url,status,score,source_id,source_url,first_seen_at,last_seen_at', ...rows.map(r => [r.url,r.status,r.score,r.source_id,r.source_url,r.first_seen_at,r.last_seen_at].map(esc).join(','))].join('\n');
    return new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="nimbus-v27-results.csv"' } });
  }
  return safeJson({ ok: true, version: VERSION, results: rows });
}
async function updateSource(env, body) {
  const db = await ensureDb(env);
  const current = nowIso();
  if (!body.id || !body.name || !body.template) throw new Error('id, name and template are required');
  await runIgnore(db, `INSERT INTO ${TABLE_PREFIX}_sources(id,name,type,enabled,priority,template,config_json,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name,type=excluded.type,enabled=excluded.enabled,priority=excluded.priority,template=excluded.template,config_json=excluded.config_json,updated_at=excluded.updated_at`, [
    body.id, body.name, body.type || 'html', body.enabled ? 1 : 0, Number(body.priority || 50), body.template, JSON.stringify(body.config || {}), current, current
  ]);
  return { ok: true, version: VERSION };
}
function isAuthed(req) {
  const cookie = req.headers.get('cookie') || '';
  return /nimbus_session=ok/.test(cookie);
}
async function readBody(req) {
  if (req.method === 'GET') return {};
  const text = await req.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return Object.fromEntries(new URLSearchParams(text)); }
}
async function api(req, env, ctx) {
  const url = new URL(req.url);
  const path = url.pathname;
  try {
    if (path === '/api/login') {
      const body = await readBody(req);
      if (String(body.pin || '') === pinValue(env)) {
        return new Response(JSON.stringify({ ok: true, version: VERSION }), { headers: { ...JSON_HEADERS, 'set-cookie': 'nimbus_session=ok; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=604800' } });
      }
      return safeJson({ ok: false, version: VERSION, error: 'invalid_pin' }, 401);
    }
    if (path === '/api/logout') return new Response(JSON.stringify({ ok: true, version: VERSION }), { headers: { ...JSON_HEADERS, 'set-cookie': 'nimbus_session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax' } });
    if (path === '/api/ping') return safeJson({ ok: true, version: VERSION, time: nowIso(), db_bound: Boolean(env.DB) });
    if (path === '/reset') return safeJson(await hardReset(env));
    if (!isAuthed(req) && !['/api/diagnostics'].includes(path)) return safeJson({ ok: false, version: VERSION, error: 'auth_required' }, 401);
    if (path === '/api/check-db' || path === '/api/repair-db') return safeJson(await diagnostics(env));
    if (path === '/api/diagnostics') return safeJson(await diagnostics(env));
    if (path === '/api/clean') return safeJson(await cleanData(env));
    if (path === '/api/reset-all') return safeJson(await hardReset(env));
    if (path === '/api/autoscan') { const body = await readBody(req); return safeJson(await autoScan(env, body.keyword || url.searchParams.get('keyword') || '')); }
    if (path === '/api/process-queue') return safeJson(await processQueue(env, Number(url.searchParams.get('limit') || 25)));
    if (path === '/api/check-links') return safeJson(await checkLinks(env, Number(url.searchParams.get('limit') || 25)));
    if (path === '/api/extract-url') { const body = await readBody(req); return safeJson(await extractFromUrl(env, body.url || url.searchParams.get('url'))); }
    if (path === '/api/results') return safeJson(await listResults(env, url));
    if (path === '/api/stats') { const db = await ensureDb(env); return safeJson({ ok: true, version: VERSION, stats: await globalStats(db) }); }
    if (path === '/api/sources' && req.method === 'GET') { const db = await ensureDb(env); return safeJson({ ok:true, version:VERSION, sources: await getSources(db) }); }
    if (path === '/api/sources' && req.method === 'POST') return safeJson(await updateSource(env, await readBody(req)));
    if (path === '/api/export.csv') return exportResults(env, 'csv');
    if (path === '/api/export.json') return exportResults(env, 'json');
    return safeJson({ ok: false, version: VERSION, error: 'not_found', path }, 404);
  } catch (e) {
    return safeJson({ ok: false, version: VERSION, error: String(e.message || e), stack: String(e.stack || '') }, 500);
  }
}
export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/') || url.pathname === '/reset') return api(req, env, ctx);
    if (env.ASSETS) return env.ASSETS.fetch(req);
    return safeText(DEMO_HTML);
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      await ensureDb(env);
      await autoScan(env, '');
      await processQueue(env, 30);
      await checkLinks(env, 30);
    })());
  }
};
