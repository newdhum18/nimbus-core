const VERSION = '23.0.0-link-first-d1-safe';
const POLICY = 'public-indexed-link-first-only';
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

const LINK_FIRST_PATTERNS = [
  '"https://mega.nz/folder/"',
  '"https://mega.nz/file/"',
  '"mega.nz/folder/"',
  '"mega.nz/file/"',
  '"mega.nz/#F!"',
  '"mega.nz/#!"',
  '"mega.nz" "/folder/"',
  '"mega.nz" "/file/"',
  '"mega.nz/folder/" "rentry.co"',
  '"mega.nz/file/" "rentry.co"',
  '"mega.nz/folder/" "paste"',
  '"mega.nz/file/" "paste"',
  '"mega.nz/folder/" "download"',
  '"mega.nz/file/" "download"',
  '"mega.nz/folder/" "shared"',
  '"mega.nz/file/" "shared"',
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

const MANUAL_DOMAINS = ['meawfy.com','linkvertise.com','loot-link.com','work.ink','rekonise.com'];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/reset') return resetPage();
    if (!url.pathname.startsWith('/api/')) return serveAsset(request, env);
    return handleApiSafe(request, env, ctx);
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(autoScan(env, { continueScan: true, scheduled: true }));
  }
};

async function serveAsset(request, env) {
  if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') return env.ASSETS.fetch(request);
  return new Response('Nimbus Core asset binding is not available.', { status: 500, headers: { 'content-type': 'text/plain;charset=utf-8' } });
}

async function handleApiSafe(request, env, ctx) {
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
    if (path === '/api/search') return json(await search(request, env), 200, headers);
    if (path === '/api/latest') return json(await latest(env, url), 200, headers);
    if (path === '/api/archive') return json(await archive(env, url), 200, headers);
    if (path === '/api/manual-sources') return json(await manualSources(env, url), 200, headers);
    if (path === '/api/delete-link') return json(await deleteLink(request, env), 200, headers);
    if (path === '/api/cleanup') return json(await cleanup(env), 200, headers);
    if (path === '/api/export') return await exportLinks(env, url, headers);
    if (path === '/api/reset-cursor') return json(await resetCursor(env), 200, headers);
    if (path === '/api/diagnostics') return json(await diagnostics(env), 200, headers);
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

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data, null, 2), { status, headers: { ...extra, 'content-type': 'application/json;charset=utf-8' } });
}

async function readJson(request) {
  try { return await request.json(); } catch { return {}; }
}

async function publicStatus(env) {
  return {
    ok: true,
    version: VERSION,
    db_bound: !!env.DB,
    auth_pin_configured: !!env.AUTH_PIN,
    brave_enabled: !!env.BRAVE_API_KEY,
    policy: POLICY,
    note: 'Public indexed discovery only. No bypass, no captcha/login/paywall unlocking.'
  };
}

async function login(request, env) {
  const body = await readJson(request);
  if (!env.AUTH_PIN) return { ok: false, version: VERSION, error: 'AUTH_PIN_missing' };
  if (String(body.pin || '') !== String(env.AUTH_PIN)) return { ok: false, version: VERSION, error: 'invalid_pin' };
  const token = await signToken({ iat: nowSec(), exp: nowSec() + TOKEN_TTL_SECONDS }, env);
  return { ok: true, version: VERSION, token };
}

async function session(request, env) {
  const auth = await requireAuth(request, env);
  return { ...auth, version: VERSION };
}

async function requireAuth(request, env) {
  if (!env.AUTH_PIN) return { ok: false, error: 'AUTH_PIN_missing' };
  const header = request.headers.get('authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) return { ok: false, error: 'missing_token' };
  const payload = await verifyToken(token, env);
  if (!payload) return { ok: false, error: 'invalid_token' };
  if (payload.exp && payload.exp < nowSec()) return { ok: false, error: 'expired_token' };
  return { ok: true };
}

async function signToken(payload, env) {
  const encodedPayload = base64Url(JSON.stringify(payload));
  const sig = await hmac(encodedPayload, secret(env));
  return `${encodedPayload}.${sig}`;
}

async function verifyToken(token, env) {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const expected = await hmac(parts[0], secret(env));
  if (expected !== parts[1]) return null;
  try { return JSON.parse(fromBase64Url(parts[0])); } catch { return null; }
}

function secret(env) { return String(env.AUTH_SECRET || env.AUTH_PIN || 'nimbus-core-local-secret'); }
function nowSec() { return Math.floor(Date.now() / 1000); }
function nowIso() { return new Date().toISOString(); }
function base64Url(text) { return btoa(unescape(encodeURIComponent(text))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''); }
function fromBase64Url(text) { return decodeURIComponent(escape(atob(text.replace(/-/g, '+').replace(/_/g, '/')))); }
async function hmac(message, key) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function shortStack(error) {
  const s = String(error && error.stack ? error.stack : '');
  return s.split('\n').slice(0, 5).join('\n');
}

function db(env) {
  if (!env.DB) throw new Error('DB binding missing. Add Cloudflare D1 binding named DB.');
  return env.DB;
}

async function runSafe(env, sql, bind = []) {
  try {
    const st = db(env).prepare(sql);
    return await st.bind(...bind).run();
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    if (/duplicate column name|already exists/i.test(msg)) return { success: true, skipped: true, message: msg };
    throw e;
  }
}

async function allSafe(env, sql, bind = []) {
  const st = db(env).prepare(sql);
  return await st.bind(...bind).all();
}

async function firstSafe(env, sql, bind = []) {
  const st = db(env).prepare(sql);
  return await st.bind(...bind).first();
}

async function ensureSchema(env) {
  const applied = [];
  const add = async (name, sql, bind = []) => { await runSafe(env, sql, bind); applied.push(name); };
  await add('mega_links table', `CREATE TABLE IF NOT EXISTS mega_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mega_url TEXT NOT NULL UNIQUE,
    normalized_url TEXT,
    source_url TEXT,
    source_domain TEXT,
    title TEXT,
    source_type TEXT,
    confidence INTEGER,
    confidence_reason TEXT,
    discovered_at TEXT,
    last_seen_at TEXT,
    status TEXT,
    notes TEXT,
    query TEXT,
    region TEXT
  )`);
  await add('manual_sources table', `CREATE TABLE IF NOT EXISTS manual_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL UNIQUE,
    domain TEXT,
    reason TEXT,
    title TEXT,
    discovered_at TEXT,
    last_seen_at TEXT,
    status TEXT
  )`);
  await add('scan_logs table', `CREATE TABLE IF NOT EXISTS scan_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mode TEXT,
    started_at TEXT,
    finished_at TEXT,
    patterns_checked INTEGER,
    pages_found INTEGER,
    pages_fetched INTEGER,
    links_found INTEGER,
    new_links INTEGER,
    manual_sources INTEGER,
    errors TEXT
  )`);
  await add('scan_state table', `CREATE TABLE IF NOT EXISTS scan_state (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT
  )`);
  await add('app_kv table', `CREATE TABLE IF NOT EXISTS app_kv (
    key TEXT PRIMARY KEY,
    value TEXT,
    updated_at TEXT
  )`);

  const megaColumns = [
    ['normalized_url','TEXT'], ['source_url','TEXT'], ['source_domain','TEXT'], ['title','TEXT'], ['source_type','TEXT'],
    ['confidence','INTEGER'], ['confidence_reason','TEXT'], ['discovered_at','TEXT'], ['last_seen_at','TEXT'], ['status','TEXT'],
    ['notes','TEXT'], ['query','TEXT'], ['region','TEXT']
  ];
  for (const [col, type] of megaColumns) await add(`mega_links add ${col}`, `ALTER TABLE mega_links ADD COLUMN ${col} ${type}`);
  const manualColumns = [['domain','TEXT'], ['reason','TEXT'], ['title','TEXT'], ['discovered_at','TEXT'], ['last_seen_at','TEXT'], ['status','TEXT']];
  for (const [col, type] of manualColumns) await add(`manual_sources add ${col}`, `ALTER TABLE manual_sources ADD COLUMN ${col} ${type}`);
  const logColumns = [['mode','TEXT'], ['started_at','TEXT'], ['finished_at','TEXT'], ['patterns_checked','INTEGER'], ['pages_found','INTEGER'], ['pages_fetched','INTEGER'], ['links_found','INTEGER'], ['new_links','INTEGER'], ['manual_sources','INTEGER'], ['errors','TEXT']];
  for (const [col, type] of logColumns) await add(`scan_logs add ${col}`, `ALTER TABLE scan_logs ADD COLUMN ${col} ${type}`);

  await add('mega index source_domain', 'CREATE INDEX IF NOT EXISTS idx_mega_source_domain ON mega_links(source_domain)');
  await add('mega index discovered_at', 'CREATE INDEX IF NOT EXISTS idx_mega_discovered_at ON mega_links(discovered_at)');
  await add('manual index domain', 'CREATE INDEX IF NOT EXISTS idx_manual_domain ON manual_sources(domain)');
  await add('state init cursor', `INSERT OR IGNORE INTO scan_state (key, value, updated_at) VALUES ('auto_cursor', '0', ?)`, [nowIso()]);
  await add('state init batch', `INSERT OR IGNORE INTO scan_state (key, value, updated_at) VALUES ('last_batch', '{}', ?)`, [nowIso()]);
  return applied;
}

async function schema(env) {
  const applied = await ensureSchema(env);
  const counts = await getCounts(env);
  const tables = await allSafe(env, `SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`);
  return { ok: true, version: VERSION, db_bound: !!env.DB, applied_steps: applied.length, tables: rows(tables).map(r => r.name), counts };
}

async function getCounts(env) {
  await ensureSchema(env);
  const mega = await firstSafe(env, 'SELECT COUNT(*) AS c FROM mega_links');
  const manual = await firstSafe(env, 'SELECT COUNT(*) AS c FROM manual_sources');
  const logs = await firstSafe(env, 'SELECT COUNT(*) AS c FROM scan_logs');
  const latest = await firstSafe(env, 'SELECT MAX(discovered_at) AS t FROM mega_links');
  return { mega_links: Number(mega?.c || 0), manual_sources: Number(manual?.c || 0), scan_logs: Number(logs?.c || 0), last_discovery: latest?.t || null };
}

async function search(request, env) {
  await ensureSchema(env);
  const body = await readJson(request);
  const mode = String(body.mode || 'auto');
  if (mode === 'manual') return manualSearch(env, String(body.query || '').trim());
  return autoScan(env, { continueScan: !!body.continueScan, reset: !!body.reset });
}

async function autoScan(env, options = {}) {
  await ensureSchema(env);
  const started = nowIso();
  const errors = [];
  if (options.reset) await setState(env, 'auto_cursor', '0');
  let cursor = Number((await getState(env, 'auto_cursor')) || '0');
  if (!options.continueScan) cursor = 0;
  const batchSize = 4;
  const selected = [];
  for (let i = 0; i < batchSize; i++) selected.push(LINK_FIRST_PATTERNS[(cursor + i) % LINK_FIRST_PATTERNS.length]);

  const resultUrls = new Map();
  const engineResults = [];
  for (const pattern of selected) {
    const engines = await queryEngines(pattern, env);
    engineResults.push({ pattern, engines: engines.map(e => ({ engine: e.engine, ok: e.ok, count: e.urls.length, error: e.error || null })) });
    for (const e of engines) {
      if (!e.ok && e.error) errors.push(`${e.engine}: ${e.error}`);
      for (const u of e.urls) resultUrls.set(cleanUrl(u), { url: cleanUrl(u), pattern, engine: e.engine });
    }
  }

  const pages = Array.from(resultUrls.values()).slice(0, 24);
  let pagesFetched = 0, linksFound = 0, newLinks = 0, manualCount = 0;
  const saved = [];
  const manuals = [];

  for (const page of pages) {
    const domain = hostname(page.url);
    if (isManualDomain(domain)) {
      const m = await saveManual(env, page.url, 'manual_review_domain', page.url);
      manualCount += m.new ? 1 : 0; manuals.push(m.item); continue;
    }
    try {
      const fetched = await fetchText(page.url, 9000);
      if (!fetched.ok) {
        if (fetched.manual) {
          const m = await saveManual(env, page.url, fetched.reason || 'manual_review', page.url);
          manualCount += m.new ? 1 : 0; manuals.push(m.item);
        }
        if (fetched.error) errors.push(`${domain}: ${fetched.error}`);
        continue;
      }
      pagesFetched++;
      const title = extractTitle(fetched.text) || page.url;
      const megaLinks = extractMegaLinks(fetched.text);
      linksFound += megaLinks.length;
      for (const link of megaLinks) {
        const s = await saveMega(env, link, page.url, title, 'auto_scan');
        if (s.new) newLinks++;
        saved.push(s.item);
      }
    } catch (e) {
      errors.push(`${domain}: ${String(e.message || e)}`);
    }
  }

  const nextCursor = (cursor + batchSize) % LINK_FIRST_PATTERNS.length;
  await setState(env, 'auto_cursor', String(nextCursor));
  const summary = { patterns_checked: selected.length, pages_found: pages.length, pages_fetched: pagesFetched, links_found: linksFound, new_links: newLinks, manual_sources: manualCount, errors: errors.slice(0, 20) };
  await runSafe(env, `INSERT INTO scan_logs (mode, started_at, finished_at, patterns_checked, pages_found, pages_fetched, links_found, new_links, manual_sources, errors) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, ['auto', started, nowIso(), summary.patterns_checked, summary.pages_found, summary.pages_fetched, summary.links_found, summary.new_links, summary.manual_sources, JSON.stringify(summary.errors)]);
  await setState(env, 'last_batch', JSON.stringify({ selected, engineResults, summary }));
  return { ok: true, version: VERSION, mode: 'link_first_url_shape_scan', cursor, next_cursor: nextCursor, patterns: selected, summary, saved: saved.slice(0, 50), manual_sources: manuals.slice(0, 20), engine_results: engineResults };
}

async function manualSearch(env, query) {
  await ensureSchema(env);
  if (!query) return { ok: false, version: VERSION, error: 'empty_query' };
  const safeQuery = `${query} "mega.nz"`;
  const engines = await queryEngines(safeQuery, env);
  const pages = [];
  for (const e of engines) for (const u of e.urls) pages.push({ url: cleanUrl(u), engine: e.engine });
  const unique = Array.from(new Map(pages.map(p => [p.url, p])).values()).slice(0, 16);
  let newLinks = 0, linksFound = 0;
  const saved = [], errors = [];
  for (const page of unique) {
    try {
      const fetched = await fetchText(page.url, 9000);
      if (!fetched.ok) continue;
      const title = extractTitle(fetched.text) || page.url;
      const links = extractMegaLinks(fetched.text);
      linksFound += links.length;
      for (const link of links) {
        const s = await saveMega(env, link, page.url, title, 'manual_search');
        if (s.new) newLinks++;
        saved.push(s.item);
      }
    } catch (e) { errors.push(String(e.message || e)); }
  }
  return { ok: true, version: VERSION, mode: 'manual_keyword_separate_from_auto', query, pages_found: unique.length, links_found: linksFound, new_links: newLinks, saved, engine_results: engines.map(e => ({ engine: e.engine, ok: e.ok, count: e.urls.length, error: e.error || null })), errors };
}

async function queryEngines(query, env) {
  const tasks = [queryBingRss(query), queryDuckDuckGoLite(query), queryAhmia(query)];
  if (env.BRAVE_API_KEY) tasks.push(queryBrave(query, env.BRAVE_API_KEY));
  const res = await Promise.allSettled(tasks);
  return res.map((r, i) => r.status === 'fulfilled' ? r.value : { engine: ['bing_rss','duckduckgo_lite','ahmia','brave'][i] || 'engine', ok: false, urls: [], error: String(r.reason && r.reason.message ? r.reason.message : r.reason) });
}

async function queryBingRss(query) {
  const url = `https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`;
  const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 NimbusCore/23 public link indexer' }, cf: { cacheTtl: 0 } });
  const text = await r.text();
  if (!r.ok) return { engine: 'bing_rss', ok: false, urls: [], error: `HTTP ${r.status}` };
  const urls = [];
  for (const m of text.matchAll(/<link>(.*?)<\/link>/gims)) {
    const u = decodeHtml(m[1]).trim();
    if (/^https?:\/\//i.test(u) && !/bing\.com/i.test(u)) urls.push(u);
  }
  return { engine: 'bing_rss', ok: true, urls: dedupe(urls).slice(0, 10) };
}

async function queryDuckDuckGoLite(query) {
  const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 NimbusCore/23 public link indexer' }, cf: { cacheTtl: 0 } });
  const text = await r.text();
  if (!r.ok) return { engine: 'duckduckgo_lite', ok: false, urls: [], error: `HTTP ${r.status}` };
  const urls = [];
  for (const m of text.matchAll(/href=["']([^"']+)["']/gims)) {
    let u = decodeHtml(m[1]);
    const uddg = /[?&]uddg=([^&]+)/.exec(u);
    if (uddg) u = decodeURIComponent(uddg[1]);
    if (/^https?:\/\//i.test(u) && !/duckduckgo\.com/i.test(u)) urls.push(u);
  }
  return { engine: 'duckduckgo_lite', ok: true, urls: dedupe(urls).slice(0, 10) };
}

async function queryAhmia(query) {
  const url = `https://ahmia.fi/search/?q=${encodeURIComponent(query)}`;
  const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0 NimbusCore/23 public link indexer' }, cf: { cacheTtl: 0 } });
  const text = await r.text();
  if (!r.ok) return { engine: 'ahmia', ok: false, urls: [], error: `HTTP ${r.status}` };
  const urls = [];
  for (const m of text.matchAll(/href=["']([^"']+)["']/gims)) {
    const u = decodeHtml(m[1]);
    if (/^https?:\/\//i.test(u)) urls.push(u);
  }
  return { engine: 'ahmia', ok: true, urls: dedupe(urls).slice(0, 10) };
}

async function queryBrave(query, key) {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=10`;
  const r = await fetch(url, { headers: { 'accept': 'application/json', 'x-subscription-token': key } });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) return { engine: 'brave', ok: false, urls: [], error: `HTTP ${r.status}` };
  const urls = (((j.web || {}).results) || []).map(x => x.url).filter(Boolean);
  return { engine: 'brave', ok: true, urls: dedupe(urls).slice(0, 10) };
}

async function fetchText(url, timeoutMs) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort('timeout'), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, redirect: 'follow', headers: { 'user-agent': 'Mozilla/5.0 NimbusCore/23 public link extractor', 'accept': 'text/html,text/plain,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' }, cf: { cacheTtl: 0 } });
    const ct = r.headers.get('content-type') || '';
    if ([401,403,407,429].includes(r.status)) return { ok: false, manual: true, reason: `HTTP ${r.status}`, error: `HTTP ${r.status}` };
    if (!r.ok) return { ok: false, manual: false, error: `HTTP ${r.status}` };
    if (!/text|html|xml|json|javascript/i.test(ct)) return { ok: false, manual: false, error: `unsupported content-type ${ct}` };
    const text = await r.text();
    return { ok: true, text: text.slice(0, 1000000) };
  } catch (e) {
    const msg = String(e && e.message ? e.message : e);
    return { ok: false, manual: false, error: msg };
  } finally { clearTimeout(id); }
}

function extractMegaLinks(text) {
  const found = [];
  const decoded = decodeHtml(String(text || ''));
  const patterns = [
    /https?:\/\/(?:www\.)?mega\.(?:nz|io)\/folder\/[A-Za-z0-9_-]+(?:#[A-Za-z0-9_-]+)?/g,
    /https?:\/\/(?:www\.)?mega\.(?:nz|io)\/file\/[A-Za-z0-9_-]+(?:#[A-Za-z0-9_-]+)?/g,
    /https?:\/\/(?:www\.)?mega\.(?:nz|io)\/#F![A-Za-z0-9!_-]+/g,
    /https?:\/\/(?:www\.)?mega\.(?:nz|io)\/#![A-Za-z0-9!_-]+/g,
    /https?:\/\/(?:www\.)?mega\.(?:nz|io)\/[A-Za-z0-9_#!?&=\/-]+/g
  ];
  for (const rx of patterns) for (const m of decoded.matchAll(rx)) found.push(cleanMega(m[0]));
  return dedupe(found).filter(isValidMega).slice(0, 100);
}

function cleanMega(u) { return String(u || '').replace(/[),.;\]}>"'\s]+$/g, '').replace(/^http:\/\//i, 'https://'); }
function isValidMega(u) { return /^https:\/\/(?:www\.)?mega\.(?:nz|io)\/(folder|file)\/[A-Za-z0-9_-]+(?:#[A-Za-z0-9_-]+)?$/i.test(u) || /^https:\/\/(?:www\.)?mega\.(?:nz|io)\/(#F!|#!)[A-Za-z0-9!_-]+$/i.test(u); }
function normalizeMega(u) { return cleanMega(u).replace(/^https:\/\/www\./i, 'https://'); }

async function saveMega(env, megaUrl, sourceUrl, title, sourceType) {
  const n = normalizeMega(megaUrl);
  const now = nowIso();
  const domain = hostname(sourceUrl);
  const score = confidence(n, sourceUrl, title);
  await runSafe(env, `INSERT OR IGNORE INTO mega_links (mega_url, normalized_url, source_url, source_domain, title, source_type, confidence, confidence_reason, discovered_at, last_seen_at, status, notes, query, region) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, NULL)`, [n, n, sourceUrl, domain, title || '', sourceType || 'auto_scan', score.score, score.reason, now, now, 'active', '']);
  const changed = await firstSafe(env, `SELECT changes() AS c`);
  await runSafe(env, `UPDATE mega_links SET last_seen_at=?, source_url=COALESCE(source_url, ?), source_domain=COALESCE(source_domain, ?), title=COALESCE(title, ?), status=COALESCE(status, 'active') WHERE mega_url=?`, [now, sourceUrl, domain, title || '', n]);
  return { new: Number(changed?.c || 0) > 0, item: { mega_url: n, source_url: sourceUrl, source_domain: domain, title: title || '', confidence: score.score, confidence_reason: score.reason } };
}

async function saveManual(env, url, reason, title) {
  const clean = cleanUrl(url);
  const now = nowIso();
  const domain = hostname(clean);
  await runSafe(env, `INSERT OR IGNORE INTO manual_sources (url, domain, reason, title, discovered_at, last_seen_at, status) VALUES (?, ?, ?, ?, ?, ?, ?)`, [clean, domain, reason || 'manual_review', title || clean, now, now, 'open']);
  const changed = await firstSafe(env, `SELECT changes() AS c`);
  await runSafe(env, `UPDATE manual_sources SET last_seen_at=?, reason=COALESCE(reason, ?), title=COALESCE(title, ?) WHERE url=?`, [now, reason || 'manual_review', title || clean, clean]);
  return { new: Number(changed?.c || 0) > 0, item: { url: clean, domain, reason, title: title || clean } };
}

function confidence(megaUrl, sourceUrl, title) {
  let score = 50; const reasons = [];
  if (/\/folder\//i.test(megaUrl) || /#F!/i.test(megaUrl)) { score += 12; reasons.push('folder-link'); }
  const d = hostname(sourceUrl);
  if (/rentry|paste|github|reddit|archive|gist/i.test(d)) { score += 18; reasons.push('indexed-source'); }
  if (/mega/i.test(title || '')) { score += 8; reasons.push('title-mentions-mega'); }
  return { score: Math.min(100, score), reason: reasons.join(', ') || 'public-indexed-result' };
}

async function latest(env, url) {
  await ensureSchema(env);
  const limit = clamp(Number(url.searchParams.get('limit') || 10), 1, 100);
  const rs = await allSafe(env, `SELECT id, mega_url, source_url, source_domain, title, confidence, confidence_reason, discovered_at, last_seen_at FROM mega_links ORDER BY COALESCE(discovered_at, last_seen_at) DESC, id DESC LIMIT ?`, [limit]);
  return { ok: true, version: VERSION, items: rows(rs), counts: await getCounts(env) };
}

async function archive(env, url) {
  await ensureSchema(env);
  const limit = clamp(Number(url.searchParams.get('limit') || 30), 1, 100);
  const offset = Math.max(0, Number(url.searchParams.get('offset') || 0));
  const q = String(url.searchParams.get('q') || '').trim();
  let rs;
  if (q) rs = await allSafe(env, `SELECT * FROM mega_links WHERE mega_url LIKE ? OR source_url LIKE ? OR title LIKE ? ORDER BY COALESCE(discovered_at,last_seen_at) DESC, id DESC LIMIT ? OFFSET ?`, [`%${q}%`, `%${q}%`, `%${q}%`, limit, offset]);
  else rs = await allSafe(env, `SELECT * FROM mega_links ORDER BY COALESCE(discovered_at,last_seen_at) DESC, id DESC LIMIT ? OFFSET ?`, [limit, offset]);
  return { ok: true, version: VERSION, offset, limit, next_offset: offset + limit, items: rows(rs) };
}

async function manualSources(env, url) {
  await ensureSchema(env);
  const limit = clamp(Number(url.searchParams.get('limit') || 50), 1, 100);
  const rs = await allSafe(env, `SELECT * FROM manual_sources ORDER BY COALESCE(discovered_at,last_seen_at) DESC, id DESC LIMIT ?`, [limit]);
  return { ok: true, version: VERSION, items: rows(rs) };
}

async function deleteLink(request, env) {
  await ensureSchema(env);
  const body = await readJson(request);
  const id = Number(body.id || 0);
  const mega = body.mega_url ? normalizeMega(body.mega_url) : '';
  if (id) await runSafe(env, 'DELETE FROM mega_links WHERE id=?', [id]);
  else if (mega) await runSafe(env, 'DELETE FROM mega_links WHERE mega_url=?', [mega]);
  else return { ok: false, version: VERSION, error: 'missing_id_or_url' };
  return { ok: true, version: VERSION };
}

async function cleanup(env) {
  await ensureSchema(env);
  await runSafe(env, `UPDATE mega_links SET query=NULL WHERE query IS NOT NULL`);
  await runSafe(env, `UPDATE mega_links SET region=NULL WHERE region IS NOT NULL`);
  await runSafe(env, `DELETE FROM mega_links WHERE mega_url IS NULL OR mega_url='' OR mega_url NOT LIKE 'https://mega.%'`);
  await runSafe(env, `DELETE FROM manual_sources WHERE url IS NULL OR url=''`);
  await setState(env, 'auto_cursor', '0');
  return { ok: true, version: VERSION, message: 'Old metadata cleaned. Cursor reset.', counts: await getCounts(env) };
}

async function exportLinks(env, url, headers) {
  await ensureSchema(env);
  const format = String(url.searchParams.get('format') || 'json').toLowerCase();
  const rs = await allSafe(env, 'SELECT mega_url, source_url, source_domain, title, confidence, discovered_at, last_seen_at FROM mega_links ORDER BY id DESC LIMIT 5000');
  const data = rows(rs);
  if (format === 'csv') {
    const csv = ['mega_url,source_url,source_domain,title,confidence,discovered_at,last_seen_at'].concat(data.map(r => [r.mega_url,r.source_url,r.source_domain,r.title,r.confidence,r.discovered_at,r.last_seen_at].map(csvCell).join(','))).join('\n');
    return new Response(csv, { status: 200, headers: { ...headers, 'content-type': 'text/csv;charset=utf-8', 'content-disposition': `attachment; filename="nimbus-core-v23-export.csv"` } });
  }
  return json({ ok: true, version: VERSION, items: data }, 200, headers);
}

async function resetCursor(env) { await ensureSchema(env); await setState(env, 'auto_cursor', '0'); return { ok: true, version: VERSION, message: 'cursor reset' }; }
async function diagnostics(env) { await ensureSchema(env); return { ok: true, version: VERSION, status: await publicStatus(env), counts: await getCounts(env), last_batch: safeJson(await getState(env, 'last_batch')) }; }
async function getState(env, key) { const r = await firstSafe(env, 'SELECT value FROM scan_state WHERE key=?', [key]); return r?.value || null; }
async function setState(env, key, value) { await runSafe(env, `INSERT INTO scan_state (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`, [key, value, nowIso()]); }

function rows(result) { return Array.isArray(result?.results) ? result.results : []; }
function clamp(n, min, max) { return Math.min(max, Math.max(min, Number.isFinite(n) ? n : min)); }
function dedupe(arr) { return Array.from(new Set((arr || []).filter(Boolean))); }
function hostname(u) { try { return new URL(u).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; } }
function isManualDomain(d) { return MANUAL_DOMAINS.some(x => d === x || d.endsWith('.' + x)); }
function cleanUrl(u) { return String(u || '').trim().replace(/&amp;/g, '&').replace(/[)\]}>"'\s]+$/g, ''); }
function decodeHtml(s) { return String(s || '').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>'); }
function extractTitle(text) { const m = /<title[^>]*>(.*?)<\/title>/is.exec(String(text || '')); return m ? decodeHtml(m[1]).replace(/\s+/g, ' ').trim().slice(0, 180) : ''; }
function csvCell(v) { const s = String(v ?? '').replace(/"/g, '""'); return `"${s}"`; }
function safeJson(s) { try { return JSON.parse(s || '{}'); } catch { return {}; } }
function resetPage() {
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nimbus Reset</title></head><body style="background:#050914;color:#fff;font-family:system-ui;padding:24px"><h1>Nimbus Core Reset</h1><pre id="log">Resetting...</pre><script>
(async()=>{const log=document.getElementById('log'); const out=[]; function line(x){out.push(x); log.textContent=out.join('\\n');}
try{ if('serviceWorker' in navigator){ const regs=await navigator.serviceWorker.getRegistrations(); for(const r of regs){ await r.unregister(); line('Service worker removed'); } } }catch(e){line('SW: '+e.message)}
try{ if(window.caches){ const keys=await caches.keys(); for(const k of keys){ await caches.delete(k); line('Cache deleted: '+k); } } }catch(e){line('Cache: '+e.message)}
try{ localStorage.clear(); sessionStorage.clear(); line('Storage cleared'); }catch(e){line('Storage: '+e.message)}
line('Done. Opening V23 fresh...'); setTimeout(()=>location.href='/?v=23&fresh=1',900);
})();</script></body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html;charset=utf-8', 'cache-control': 'no-store' } });
}
