/* Nimbus Core V34 Resilient Orchestrator
 * Fresh Cloudflare Pages Worker + D1 app.
 * Frontend and extraction are integrated; AutoScan and Keyword Search are separated by mode.
 */
const VERSION = '34.2-resilient-pipeline';
const T = {
  runs: 'nimbus_v27sb_runs',
  pages: 'nimbus_v27sb_pages',
  links: 'nimbus_v27sb_links',
  archive: 'nimbus_v28_archive_links',
  queue: 'nimbus_v27sb_queue',
  cache: 'nimbus_v27sb_cache',
  events: 'nimbus_v27sb_events',
  sources: 'nimbus_v27sb_sources',
  settings: 'nimbus_v27sb_settings',
  sourceMetrics: 'nimbus_v32_source_metrics',
  migrations: 'nimbus_v32_schema_migrations',
  visited: 'nimbus_v33_visited_urls',
  runTasks: 'nimbus_v33_run_tasks'
};
const SOURCE_POLICY_VERSION = 'v34.2-evidence-ranked-sources';
const DEFAULT_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1 NimbusCore/34';
const TIMEOUT_MS = 7000;
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const HEALTH_TTL_MS = 1000 * 60 * 60 * 12;
const DEFAULT_MAX_SOURCE_FETCHES = 24;
const HARD_MAX_SOURCE_FETCHES = 48;
const MAX_CRAWL_PAGES = 240;
const MAX_QUEUE_BATCH = 12;
const SCHEDULE_SEED_LIMIT = 12; // Small slices for stable continuous runs
const SCHEDULE_SEED_LIMIT_KEYWORD = 12;
const SCHEDULE_SEED_LIMIT_AUTOSCAN = 12;
const SUCCESS_TARGET_LINKS = 100;
const MAX_DEEP_ROUNDS = 300;
const REQUEST_BUDGET_MS = 22000;
const QUEUE_SOURCE_BATCH = 8;
const QUEUE_CRAWL_CHILD_LIMIT = 12;
const QUEUE_MESSAGE_BATCH_LIMIT = 6;
const MAX_TEXT = 350000;
const LINK_RE = /(^|[^A-Za-z0-9_.\/-])((?:https?:\/\/)?(?:www\.)?mega\.(?:nz|co\.nz|io)\/folder\/[A-Za-z0-9_-]+#[A-Za-z0-9_!\-]{8,})/gi;
const OLD_LINK_RE = /(^|[^A-Za-z0-9_.\/-])((?:https?:\/\/)?(?:www\.)?mega\.(?:nz|co\.nz)\/#(?:F!|N!|!)?[A-Za-z0-9_-]+![A-Za-z0-9_!\-]+)/gi;
const MEGA_HOST_RE = /^https?:\/\/(?:www\.)?mega\.(?:nz|co\.nz|io)\//i;
const COMPLETE_MEGA_RE = /^https?:\/\/(?:www\.)?mega\.(?:nz|io)\/folder\/[A-Za-z0-9_-]{4,}#[A-Za-z0-9_!\-]{8,}$/i;
const COMPLETE_OLD_MEGA_RE = /^https?:\/\/(?:www\.)?mega\.(?:nz|co\.nz)\/#(?:F!|N!|!)?[A-Za-z0-9_-]{4,}![A-Za-z0-9_!\-]{8,}$/i;
function isCompleteMegaLink(u){ u=String(u||''); return COMPLETE_MEGA_RE.test(u) || COMPLETE_OLD_MEGA_RE.test(u); }

const AUTOSCAN_PATTERNS = [
  'mega.nz/folder', 'mega.nz/#F!', 'mega.co.nz/#F!',
  '"mega.nz/folder"', '"mega.nz" "folder"', '"mega.nz/folder" "index"',
  'site:pastebin.com "mega.nz/folder"', 'site:rentry.co "mega.nz/folder"', 'site:reddit.com "mega.nz/folder"',
  'site:archive.org "mega.nz/folder"', 'site:linktr.ee "mega.nz/folder"',
  'site:meawfy.com "mega.nz/folder"', 'site:ofversedrops.com "mega.nz/folder"', 'site:telegra.ph "mega.nz/folder"',
  'site:medium.com "mega.nz/folder"', 'site:substack.com "mega.nz/folder"', 'site:notion.site "mega.nz/folder"',
  'site:paste.ee "mega.nz/folder"', 'site:justpaste.it "mega.nz/folder"', 'site:controlc.com "mega.nz/folder"',
  'site:hastebin.com "mega.nz/folder"', 'site:dpaste.org "mega.nz/folder"', 'site:pastes.io "mega.nz/folder"',
  'site:pastelink.net "mega.nz/folder"',
  'site:t.me "mega.nz/folder"', 'site:telegram.me "mega.nz/folder"', 'site:vk.com "mega.nz/folder"',
  'site:txti.es "mega.nz/folder"', 'site:paste.rs "mega.nz/folder"', 'site:paste.mozilla.org "mega.nz/folder"'
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'access-control-allow-methods': 'GET,POST,OPTIONS',
      'access-control-allow-headers': 'content-type,authorization'
    }
  });
}
function text(data, type = 'text/plain; charset=utf-8') { return new Response(data, { headers: { 'content-type': type, 'cache-control': 'no-store' } }); }
function nowIso() { return new Date().toISOString(); }
function uid(prefix='id') { return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,10); }
function hash(s) { let h=2166136261; for (let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)} return (h>>>0).toString(16); }
function clamp(s, n) { s = String(s ?? ''); return s.length > n ? s.slice(0,n) : s; }
function safeUrl(u, base) { try { return new URL(u, base).href; } catch { return ''; } }
function originOf(u) { try { return new URL(u).origin; } catch { return ''; } }
function hostOf(u) { try { return new URL(u).hostname.replace(/^www\./,''); } catch { return ''; } }
function realSourceLabel(source, pageUrl) {
  const h = hostOf(pageUrl || '');
  const s = String(source || '').replace(/^(Bing|DuckDuckGo|Yahoo|Brave|Mojeek|Qwant|Startpage|Yandex)\s*/i,'').trim();
  if (h && !/^(bing|duckduckgo|search\.yahoo|search\.brave|mojeek|qwant|startpage|yandex|google)\./i.test(h)) return h;
  return s || h || 'source';
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function intEnv(env, key, fallback, min, max) {
  const n = Number(env && env[key]);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.floor(n)));
}
function safeSearchTerm(s) {
  return String(s || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\b(?:pirate|crack|warez|torrent|leak|leaked|stolen|password|combo|account)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
function decodeLoose(s) {
  s = String(s || '');
  const variants = new Set([s]);
  const html = s.replace(/&amp;/g,'&').replace(/&#x2F;/gi,'/').replace(/\\\//g,'/').replace(/\u002F/gi,'/').replace(/%23/g,'#').replace(/%2F/gi,'/').replace(/%3A/gi,':');
  variants.add(html);
  try { variants.add(decodeURIComponent(html)); } catch {}
  try { variants.add(decodeURIComponent(decodeURIComponent(html))); } catch {}
  return [...variants].join('\n');
}
function normalizeLink(link) {
  try {
    link = String(link || '')
      .trim()
      .replace(/&amp;/g,'&')
      .replace(/\\\//g,'/')
      .replace(/[\])},.;]+$/g,'');

    if (/^mega\./i.test(link)) link = 'https://' + link;
    if (/^www\.mega\./i.test(link)) link = 'https://' + link;

    const u = new URL(link);
    if (!MEGA_HOST_RE.test(u.href)) return '';
    // New MEGA file/folder links without a decryption key open as blank/empty pages.
    // Keep only usable links that include a #key; old #F!/! formats are handled by OLD_LINK_RE.
    if (/\/file\//i.test(u.pathname)) return '';
    if (/\/folder\//i.test(u.pathname) && (!u.hash || u.hash.length < 9)) return '';
    return u.href.replace(/&utm_[^#]+/g,'');
  } catch { return ''; }
}

function megaParts(link) {
  const norm = normalizeLink(link);
  if (!norm) return null;
  try {
    const u = new URL(norm);
    const m = u.pathname.match(/\/folder\/([A-Za-z0-9_-]{4,})/i);
    if (m && u.hash && u.hash.length >= 9) return { format:'new-folder', handle:m[1], key:u.hash.slice(1), normalized:norm };
    const old = norm.match(/mega\.(?:nz|co\.nz)\/#F!([A-Za-z0-9_-]{4,})!([A-Za-z0-9_!\-]{8,})/i);
    if (old) return { format:'old-folder', handle:old[1], key:old[2], normalized:norm };
  } catch {}
  return null;
}
async function megaApiFolderCheck(link) {
  const p = megaParts(link);
  if (!p) return { health:'unknown', reason:'invalid_parts' };
  try {
    const res = await fetchWithTimeout('https://g.api.mega.co.nz/cs?id=' + Date.now().toString(36), {
      method:'POST',
      headers:{ 'content-type':'application/json' },
      body: JSON.stringify([{ a:'f', c:1, r:1, ca:1, n:p.handle }])
    }, 9000);
    const txt = await bodyText(res);
    let data = null;
    try { data = JSON.parse(txt); } catch {}
    const first = Array.isArray(data) ? data[0] : data;
    if (typeof first === 'number' && first < 0) return { health:'dead', reason:'mega_api_' + first };
    if (first && (Array.isArray(first.f) || first.f || first.ok || first.s !== undefined)) return { health:'valid', reason:'mega_api_ok' };
    // MEGA sometimes returns an object with partial metadata for public folders.
    if (res.status >= 200 && res.status < 300 && txt && !/^\s*\[-?\d+\]\s*$/.test(txt)) return { health:'valid', reason:'mega_api_response' };
  } catch (e) {
    return { health:'unknown', reason:'mega_api_error:' + String(e.message||e).slice(0,120) };
  }
  return { health:'unknown', reason:'mega_api_unknown' };
}

function addMegaMatches(textValue, out) {
  let m;
  LINK_RE.lastIndex = 0;
  while ((m = LINK_RE.exec(textValue)) !== null) {
    const l = normalizeLink(m[2]);
    if (l) out.set(l, l);
  }
  OLD_LINK_RE.lastIndex = 0;
  while ((m = OLD_LINK_RE.exec(textValue)) !== null) {
    const l = normalizeLink(m[2]);
    if (l) out.set(l, l);
  }
}
function extractMegaLinks(input, depth = 0) {
  const raw = typeof input === 'string' ? input : JSON.stringify(input || {});
  const s = decodeLoose(raw);
  const out = new Map();
  addMegaMatches(s, out);

  // Also catch links hidden in query parameters such as ?url=https%3A%2F%2Fmega.nz%2Ffolder...
  // Depth is capped to prevent recursive loops from self-referential redirect URLs.
  if (depth < 1) {
    const urlLike = /(?:[?&]|^)(?:url|u|target|redirect|to|q)=([^&"'<>]+)/gi;
    let m;
    while ((m = urlLike.exec(raw)) !== null) {
      const lks = extractMegaLinks(decodeLoose(m[1]), depth + 1);
      for (const l of lks) out.set(l, l);
    }
  }
  return [...out.values()];
}
function extractPageUrls(html, base) {
  const urls = new Set();
  const re = /(?:href|src)\s*=\s*["']([^"'#<>\s]+)["']/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const u = safeUrl(m[1], base);
    if (!u) continue;
    if (!/^https?:/i.test(u)) continue;
    urls.add(u);
  }
  return [...urls];
}
function snippetFrom(s) {
  s = String(s||'').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
  return clamp(s, 260);
}
function scoreResult({link, source, title, pageUrl, mode}) {
  let score = 50;
  if (/\/folder\//i.test(link)) score += 10;
  if (/#/.test(link)) score += 8;
  if (/reddit|github|pastebin|rentry|archive|meawfy/i.test(source || pageUrl || '')) score += 8;
  if (title && title.length > 8) score += 4;
  if (mode === 'autoscan') score += 2;
  return Math.min(100, score);
}
async function runIgnore(promise) { try { return await promise; } catch (e) { return null; } }
async function fetchWithTimeout(url, init = {}, timeout = TIMEOUT_MS) {
  const ac = new AbortController();
  const id = setTimeout(() => ac.abort('timeout'), timeout);
  const headers = new Headers(init.headers || {});
  if (!headers.has('user-agent')) headers.set('user-agent', DEFAULT_UA);
  if (!headers.has('accept')) headers.set('accept', 'text/html,application/xhtml+xml,application/json,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.5');
  if (!headers.has('accept-language')) headers.set('accept-language', 'en-US,en;q=0.8');
  init = { ...init, headers };
  try {
    const res = await fetch(url, { ...init, signal: ac.signal, headers: { 'user-agent': DEFAULT_UA, 'accept': '*/*', ...(init.headers||{}) } });
    return res;
  } finally { clearTimeout(id); }
}
async function bodyText(res) { const t = await res.text(); return clamp(t, MAX_TEXT); }

async function q(env, sql, params = []) { return env.DB.prepare(sql).bind(...params).run(); }
async function all(env, sql, params = []) { return env.DB.prepare(sql).bind(...params).all(); }
async function first(env, sql, params = []) { return env.DB.prepare(sql).bind(...params).first(); }
async function logEvent(env, level, message, meta = {}) {
  try { await q(env, `INSERT INTO ${T.events}(id,level,message,meta,created_at) VALUES(?,?,?,?,?)`, [uid('ev'), level, clamp(message,400), JSON.stringify(meta).slice(0,5000), nowIso()]); } catch {}
}

async function ensureColumn(env, table, column, ddl) {
  try {
    const cols = await all(env, `PRAGMA table_info(${table})`);
    const rows = cols.results || [];
    if (!rows.some(c => c.name === column)) await q(env, `ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
  } catch (e) { /* ignored during initial create */ }
}

async function ensureDb(env) {
  if (!env.DB) throw new Error('D1 binding DB not found. Add D1 binding name DB in Cloudflare Pages settings.');
  await q(env, `CREATE TABLE IF NOT EXISTS ${T.runs}(
    id TEXT PRIMARY KEY, mode TEXT NOT NULL, keyword TEXT, status TEXT NOT NULL DEFAULT 'running',
    started_at TEXT NOT NULL, finished_at TEXT, elapsed_ms INTEGER DEFAULT 0,
    pages_scanned INTEGER DEFAULT 0, links_found INTEGER DEFAULT 0, links_alive INTEGER DEFAULT 0, links_dead INTEGER DEFAULT 0, links_unknown INTEGER DEFAULT 0,
    sources_used INTEGER DEFAULT 0, notes TEXT
  )`);
  await q(env, `CREATE TABLE IF NOT EXISTS ${T.pages}(
    id TEXT PRIMARY KEY, run_id TEXT, mode TEXT, source TEXT, url TEXT, title TEXT, status INTEGER DEFAULT 0,
    depth INTEGER DEFAULT 0, links_found INTEGER DEFAULT 0, scanned_at TEXT NOT NULL, error TEXT,
    UNIQUE(run_id,url)
  )`);
  await q(env, `CREATE TABLE IF NOT EXISTS ${T.links}(
    id TEXT PRIMARY KEY, run_id TEXT, mode TEXT, keyword TEXT, keyword_key TEXT NOT NULL DEFAULT '', link TEXT NOT NULL, normalized TEXT NOT NULL,
    type TEXT, source TEXT, page_url TEXT, title TEXT, snippet TEXT, score INTEGER DEFAULT 0,
    health TEXT DEFAULT 'unknown', health_checked_at TEXT, first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL,
    UNIQUE(mode, normalized, keyword_key)
  )`);
  await q(env, `CREATE TABLE IF NOT EXISTS ${T.archive}(
    normalized TEXT PRIMARY KEY,
    link TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'folder',
    source TEXT,
    sources TEXT DEFAULT '[]',
    page_url TEXT,
    keyword TEXT DEFAULT '',
    first_seen_at TEXT NOT NULL,
    last_seen_at TEXT NOT NULL,
    seen_count INTEGER DEFAULT 1,
    score INTEGER DEFAULT 0,
    health TEXT DEFAULT 'folder',
    snippet TEXT
  )`);
  await q(env, `CREATE TABLE IF NOT EXISTS ${T.queue}(
    id TEXT PRIMARY KEY, run_id TEXT, mode TEXT, kind TEXT NOT NULL, url TEXT, keyword TEXT, source TEXT, priority INTEGER DEFAULT 50,
    status TEXT DEFAULT 'pending', attempts INTEGER DEFAULT 0, max_attempts INTEGER DEFAULT 3,
    available_at TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, error TEXT
  )`);
  await q(env, `CREATE TABLE IF NOT EXISTS ${T.cache}(
    key TEXT PRIMARY KEY, value TEXT, status INTEGER DEFAULT 0, created_at TEXT NOT NULL, expires_at TEXT NOT NULL, hits INTEGER DEFAULT 0
  )`);
  await q(env, `CREATE TABLE IF NOT EXISTS ${T.events}(
    id TEXT PRIMARY KEY, level TEXT, message TEXT, meta TEXT, created_at TEXT NOT NULL
  )`);
  await q(env, `CREATE TABLE IF NOT EXISTS ${T.sources}(
    id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, enabled INTEGER DEFAULT 1, priority INTEGER DEFAULT 50,
    template TEXT NOT NULL, config TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  )`);
  await q(env, `CREATE TABLE IF NOT EXISTS ${T.settings}(
    key TEXT PRIMARY KEY, value TEXT, updated_at TEXT NOT NULL
  )`);
  await q(env, `CREATE TABLE IF NOT EXISTS ${T.sourceMetrics}(
    source_id TEXT PRIMARY KEY, source_name TEXT, requests INTEGER DEFAULT 0, successes INTEGER DEFAULT 0,
    blocked INTEGER DEFAULT 0, errors INTEGER DEFAULT 0, pages INTEGER DEFAULT 0, candidates INTEGER DEFAULT 0,
    valid_links INTEGER DEFAULT 0, total_response_ms INTEGER DEFAULT 0, last_status INTEGER DEFAULT 0,
    last_success_at TEXT, last_error TEXT, updated_at TEXT NOT NULL
  )`);
  await q(env, `CREATE TABLE IF NOT EXISTS ${T.migrations}(
    version TEXT PRIMARY KEY, applied_at TEXT NOT NULL
  )`);
  await q(env, `CREATE TABLE IF NOT EXISTS ${T.visited}(
    url_hash TEXT PRIMARY KEY, url TEXT NOT NULL, source TEXT, first_scanned_at TEXT NOT NULL, last_scanned_at TEXT NOT NULL,
    last_status INTEGER DEFAULT 0, links_found INTEGER DEFAULT 0, content_hash TEXT, scan_count INTEGER DEFAULT 1
  )`);
  await q(env, `CREATE TABLE IF NOT EXISTS ${T.runTasks}(
    id TEXT PRIMARY KEY, run_id TEXT NOT NULL, source_id TEXT, source_name TEXT, query TEXT, status TEXT DEFAULT 'planned',
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL, UNIQUE(run_id,source_id,query)
  )`);
  await ensureColumn(env, T.queue, 'lease_id', 'TEXT');
  await ensureColumn(env, T.queue, 'lease_until', 'TEXT');
  await ensureColumn(env, T.queue, 'worker_id', 'TEXT');
  await ensureColumn(env, T.runs, 'current_stage', "TEXT DEFAULT 'discovery'");
  await ensureColumn(env, T.runs, 'last_heartbeat', 'TEXT');
  await ensureColumn(env, T.runs, 'source_cursor', 'INTEGER DEFAULT 0');
  await ensureColumn(env, T.runs, 'query_cursor', 'INTEGER DEFAULT 0');
  await ensureColumn(env, T.runs, 'planned_sources', 'INTEGER DEFAULT 0');
  await ensureColumn(env, T.runs, 'seeded_sources', 'INTEGER DEFAULT 0');
  await ensureColumn(env, T.runs, 'total_tasks', 'INTEGER DEFAULT 0');
  await ensureColumn(env, T.runs, 'completed_tasks', 'INTEGER DEFAULT 0');
  await ensureColumn(env, T.runs, 'failed_tasks', 'INTEGER DEFAULT 0');
  await ensureColumn(env, T.runs, 'progress_percent', 'REAL DEFAULT 0');
  await ensureColumn(env, T.runs, 'resume_count', 'INTEGER DEFAULT 0');
  await ensureColumn(env, T.runs, 'stop_reason', 'TEXT');
  await ensureColumn(env, T.runs, 'sources_exhausted', 'INTEGER DEFAULT 0');
  await ensureColumn(env, T.runs, 'progress_floor', 'REAL DEFAULT 0');
  await ensureColumn(env, T.runs, 'orchestrator', "TEXT DEFAULT 'queue_or_cron'");
  await ensureColumn(env, T.sourceMetrics, 'consecutive_failures', 'INTEGER DEFAULT 0');
  await ensureColumn(env, T.sourceMetrics, 'cooldown_until', 'TEXT');
  await runIgnore(q(env, `INSERT OR IGNORE INTO ${T.migrations}(version,applied_at) VALUES(?,?)`, [VERSION, nowIso()]));
  await ensureColumn(env, T.links, 'keyword_key', "TEXT NOT NULL DEFAULT ''");
  await runIgnore(q(env, `UPDATE ${T.links} SET keyword_key=COALESCE(keyword,'') WHERE keyword_key IS NULL OR keyword_key=''`));
  // Remove unusable new-format MEGA links that were collected by older versions without a decryption key.
  await runIgnore(q(env, `DELETE FROM ${T.links} WHERE normalized LIKE '%/file/%' OR (normalized LIKE '%/folder/%' AND instr(normalized, '#')=0)`));
  await runIgnore(q(env, `DELETE FROM ${T.archive} WHERE normalized LIKE '%/file/%' OR (normalized LIKE '%/folder/%' AND instr(normalized, '#')=0)`));
  const idx = [
    `CREATE INDEX IF NOT EXISTS idx_${T.links}_run ON ${T.links}(run_id)`,
    `CREATE INDEX IF NOT EXISTS idx_${T.links}_mode ON ${T.links}(mode, first_seen_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_${T.links}_health ON ${T.links}(health)`,
    `CREATE INDEX IF NOT EXISTS idx_${T.archive}_last ON ${T.archive}(last_seen_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_${T.archive}_score ON ${T.archive}(score DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_${T.queue}_status ON ${T.queue}(status, priority DESC, available_at)`,
    `CREATE INDEX IF NOT EXISTS idx_${T.pages}_run ON ${T.pages}(run_id)`,
    `CREATE INDEX IF NOT EXISTS idx_${T.cache}_expires ON ${T.cache}(expires_at)`,
    `CREATE INDEX IF NOT EXISTS idx_${T.queue}_lease ON ${T.queue}(status, lease_until)`,
    `CREATE INDEX IF NOT EXISTS idx_${T.sourceMetrics}_yield ON ${T.sourceMetrics}(valid_links DESC, successes DESC)`
  ];
  for (const s of idx) await runIgnore(q(env, s));
  // Sources are no longer seeded into D1 during AutoScan.
  // The 1000-source catalog is kept in memory and read directly, while D1 stores only runs/pages/results/queue.
}
function sourceRow(id, name, type, priority, template, config = {}) {
  return [id, name, type, priority, template, JSON.stringify(config)];
}
function builtInSources() {
  const rows = [];
  const add = (id, name, type, priority, template, config={}) => rows.push(sourceRow(id, name, type, priority, template, config));
  const engines = [
    ['duckduckgo_lite','DuckDuckGo Lite','html',156,'https://lite.duckduckgo.com/lite/?q={q}'],
    ['duckduckgo_html','DuckDuckGo HTML','html',148,'https://duckduckgo.com/html/?q={q}'],
    ['brave_web','Brave Web','html',144,'https://search.brave.com/search?q={q}'],
    ['google_web','Google Web','html',132,'https://www.google.com/search?q={q}&num=20'],
    ['startpage','Startpage','html',128,'https://www.startpage.com/sp/search?query={q}'],
    ['bing_rss','Bing RSS','rss',118,'https://www.bing.com/search?format=rss&q={q}'],
    ['bing_web','Bing Web','html',98,'https://www.bing.com/search?q={q}&count=30'],
    ['yahoo_search','Yahoo Search','html',72,'https://search.yahoo.com/search?p={q}&n=20'],
    ['mojeek','Mojeek','html',68,'https://www.mojeek.com/search?q={q}'],
    ['qwant','Qwant','html',62,'https://www.qwant.com/?q={q}&t=web'],
    ['yandex','Yandex','html',54,'https://yandex.com/search/?text={q}']
  ];
  for (const e of engines) add(...e);
  const apiLike = [
    ['meawfy_api','Meawfy Internal API','json',180,'https://meawfy.com/internal/api/results.json?q={q}'],
    ['meawfy_api_folder','Meawfy API Folder Query','json',178,'https://meawfy.com/internal/api/results.json?q=mega.nz%2Ffolder%20{q}'],
    ['meawfy_web','Meawfy Web','html',130,'https://meawfy.com/search?q={q}'],
    ['pastebin_archive','Pastebin Public Archive','html',122,'https://pastebin.com/archive'],
    ['rentry_raw_search_ddg','Rentry DDG Raw Target Decoder','html',120,'https://duckduckgo.com/html/?q=site%3Arentry.co%20%22mega.nz%2Ffolder%22%20{q}'],
    ['pastebin_raw_search_ddg','Pastebin DDG Raw Target Decoder','html',119,'https://duckduckgo.com/html/?q=site%3Apastebin.com%20%22mega.nz%2Ffolder%22%20{q}'],
    ['reddit_search_json','Reddit Search JSON','json',126,'https://www.reddit.com/search.json?q={q}%20%22mega.nz%2Ffolder%22&limit=100&sort=new'],
    ['reddit_all_url_json','Reddit URL JSON','json',124,'https://www.reddit.com/search.json?q=url%3Amega.nz%2Ffolder%20{q}&limit=100&sort=new'],
    ['reddit_megalinks_json','Reddit Megalinks JSON','json',105,'https://www.reddit.com/r/megalinks/search.json?q={q}&restrict_sr=1&limit=100&sort=new'],
    ['reddit_piracy_json','Reddit Public Links JSON','json',82,'https://www.reddit.com/search.json?q=%22mega.nz%2Ffolder%22%20{q}&limit=100&sort=comments'],
    ['archive_search','Archive Search','html',96,'https://archive.org/search?query={q}%20mega.nz%2Ffolder'],
    ['archive_fulltext','Archive Full Text','json',92,'https://archive.org/advancedsearch.php?q={q}%20mega.nz%2Ffolder&fl%5B%5D=identifier&fl%5B%5D=title&rows=50&output=json'],
    ['keeplinks_web','Keeplinks Search','html',100,'https://www.bing.com/search?q=site%3Akeeplinks.eu%20{q}%20%22mega.nz%2Ffolder%22&count=20'],
    ['keeplinks_direct','Keeplinks Direct','html',80,'https://keeplinks.eu/search/{q}'],
    ['ofversedrops_web','OfverseDrops Web','html',108,'https://ofversedrops.com/?s={q}'],
    ['hn_algolia','HN Algolia Comments','json',42,'https://hn.algolia.com/api/v1/search?query={q}%20mega.nz%2Ffolder&tags=comment'],
    ['ahmia','Ahmia Web','html',35,'https://ahmia.fi/search/?q={q}%20mega.nz']
  ];
  for (const a of apiLike) add(...a);
  const domains = [
    'rentry.co','pastebin.com','paste.ee','justpaste.it','controlc.com','hastebin.com','dpaste.org','pastes.io','paste.rs','pastelink.net','ghostbin.co','privatebin.net',
    'keeplinks.eu','reddit.com','old.reddit.com','archive.org','ofversedrops.com','meawfy.com',
    'linktr.ee','linktree.com','beacons.ai','bio.link','solo.to','msha.ke','taplink.cc','allmylinks.com','instabio.cc','heylink.me','lnk.bio','flow.page','carrd.co','campsite.bio',
    'telegra.ph','notion.site','sites.google.com','blogspot.com','wordpress.com','tumblr.com'
  ];
  const patterns = [
    ['rss','https://www.bing.com/search?format=rss&q=site%3A{domain}%20{q}%20%22mega.nz%2Ffolder%22',90],
    ['web','https://www.bing.com/search?q=site%3A{domain}%20{q}%20%22mega.nz%2Ffolder%22&count=20',88],
    ['ddg','https://duckduckgo.com/html/?q=site%3A{domain}%20{q}%20%22mega.nz%2Ffolder%22',78]
  ];
  let idx = 0;
  for (const d of domains) {
    for (const [kind,tpl,pri] of patterns) {
      add('src_'+(++idx)+'_'+kind+'_'+d.replace(/[^a-z0-9]+/gi,'_').slice(0,36), d+' '+kind, kind === 'rss' ? 'rss' : 'html', pri, tpl.replace('{domain}', d));
    }
  }
  const genericNeedles = ['"mega.nz/folder"','"mega.co.nz/#F!"','"mega.nz" "folder"','"mega.nz/folder" "index"','"mega.nz/folder" "collection"','"mega.nz/folder" "archive"'];
  for (const needle of genericNeedles) {
    add('generic_bing_'+hash(needle), 'Generic Bing '+needle, 'html', 60, 'https://www.bing.com/search?q='+encodeURIComponent(needle)+'%20{q}&count=50');
    add('generic_rss_'+hash(needle), 'Generic RSS '+needle, 'rss', 58, 'https://www.bing.com/search?format=rss&q='+encodeURIComponent(needle)+'%20{q}');
    add('generic_ddg_'+hash(needle), 'Generic DDG '+needle, 'html', 52, 'https://duckduckgo.com/html/?q='+encodeURIComponent(needle)+'%20{q}');
  }
  // Fill the catalog to 1000 deterministic source templates using safe public search variations.
  const safeFacets = ['folder','index','public','shared','download','cloud','archive','mirror','collection','backup','docs','links','resources','dataset','media','software','video','audio','notes'];
  let filler = 0;
  while (rows.length < 1000) {
    const facet = safeFacets[filler % safeFacets.length];
    const domain = domains[filler % domains.length];
    const engine = filler % 3;
    const id = 'wide_'+String(filler+1).padStart(4,'0')+'_'+facet+'_'+domain.replace(/[^a-z0-9]+/gi,'_').slice(0,32);
    if (engine === 0) add(id, 'Wide '+facet+' '+domain, 'html', 35 + (filler % 20), `https://www.bing.com/search?q=site%3A${domain}%20{q}%20mega.nz%2Ffolder%20${encodeURIComponent(facet)}&count=20`);
    else if (engine === 1) add(id, 'Wide RSS '+facet+' '+domain, 'rss', 33 + (filler % 20), `https://www.bing.com/search?format=rss&q=site%3A${domain}%20{q}%20mega.nz%2Ffolder%20${encodeURIComponent(facet)}`);
    else add(id, 'Wide DDG '+facet+' '+domain, 'html', 30 + (filler % 20), `https://duckduckgo.com/html/?q=site%3A${domain}%20{q}%20mega.nz%2Ffolder%20${encodeURIComponent(facet)}`);
    filler++;
  }
  const seen = new Set();
  return rows.filter(r => { if (seen.has(r[0])) return false; seen.add(r[0]); return true; }).slice(0, 1000);
}
async function seedSources(env) {
  const sources = builtInSources();
  for (const s of sources) {
    await q(env, `INSERT OR IGNORE INTO ${T.sources}(id,name,type,enabled,priority,template,config,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`, [s[0],s[1],s[2],1,s[3],s[4],s[5]||'{}',nowIso(),nowIso()]);
  }
}
async function hardReset(env) {
  const tables = Object.values(T);
  for (const t of tables) await runIgnore(q(env, `DROP TABLE IF EXISTS ${t}`));
  await ensureDb(env);
}
async function cleanData(env) {
  await ensureDb(env);
  for (const t of [T.runs,T.pages,T.links,T.queue,T.cache,T.events]) await q(env, `DELETE FROM ${t}`);
}
async function cleanInvalidLinks(env) {
  await ensureDb(env);
  await q(env, `DELETE FROM ${T.links} WHERE normalized NOT LIKE '%#%' AND normalized NOT LIKE '%mega.co.nz/#%'`);
  await q(env, `DELETE FROM ${T.links} WHERE normalized LIKE '%/file/%' OR (normalized LIKE '%/folder/%' AND normalized NOT LIKE '%#%')`);
  await q(env, `DELETE FROM ${T.archive} WHERE normalized NOT LIKE '%#%' AND normalized NOT LIKE '%mega.co.nz/#%'`);
  await q(env, `DELETE FROM ${T.archive} WHERE normalized LIKE '%/file/%' OR (normalized LIKE '%/folder/%' AND normalized NOT LIKE '%#%')`);
  return { ok:true, version:VERSION, stats:await dashboardStats(env) };
}
async function getPin(env) { return String(env.AUTH_PIN || env.NIMBUS_PIN || '0000'); }
function tokenFor(pin) { return 'nimbus_' + hash('pin:' + pin + ':v33'); }
async function requireAuth(req, env) {
  const url = new URL(req.url);
  if (url.pathname.startsWith('/api/login') || url.pathname.startsWith('/api/ping') || url.pathname.startsWith('/reset')) return true;
  const pin = await getPin(env);
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i,'') || url.searchParams.get('token') || '';
  if (token === tokenFor(pin)) return true;
  return false;
}
async function parseBody(req) { try { return await req.json(); } catch { return {}; } }

function buildQueries(keyword, mode) {
  const base = safeSearchTerm(keyword);
  let patterns;
  if (mode === 'autoscan' && !base) {
    const domains = ['rentry.co','pastebin.com','paste.ee','justpaste.it','controlc.com','hastebin.com','dpaste.org','pastes.io','pastelink.net','reddit.com','old.reddit.com','archive.org','ofversedrops.com','meawfy.com','keeplinks.eu','linktr.ee','linktree.com','beacons.ai','bio.link','solo.to','heylink.me','lnk.bio','telegra.ph','notion.site','blogspot.com','wordpress.com','tumblr.com','sites.google.com','carrd.co'];
    const needles = ['mega.nz/folder','mega.nz folder','MEGA folder links','mega.nz/folder index','mega.nz/folder archive','mega.nz/folder collection','mega.nz/folder backup','mega.co.nz/#F!'];
    patterns = ['mega','mega folder','mega.nz folder','mega.nz/folder','MEGA links','public mega folder','mega folder archive', ...AUTOSCAN_PATTERNS];
    for (const d of domains) for (const n of needles) patterns.push(`site:${d} ${n}`);
  }
  else patterns = [
    base, `"${base}"`, `${base} mega.nz/folder`, `"${base}" "mega.nz/folder"`,
    `site:reddit.com ${base} "mega.nz/folder"`,
    `site:pastebin.com ${base} "mega.nz/folder"`, `site:rentry.co ${base} "mega.nz/folder"`, `site:archive.org ${base} "mega.nz/folder"`,
    `site:linktr.ee ${base} "mega.nz/folder"`, `site:meawfy.com ${base} "mega.nz/folder"`,
    `site:ofversedrops.com ${base} "mega.nz/folder"`, `site:notion.site ${base} "mega.nz/folder"`, `site:telegra.ph ${base} "mega.nz/folder"`,
    `"mega.nz/folder" ${base}`, `"mega.co.nz/#F!" ${base}`
  ];
  return [...new Set(patterns.filter(Boolean))].slice(0, mode === 'autoscan' ? 220 : 80);
}
function catalogSources() {
  return builtInSources().map(s => ({
    id:s[0], name:s[1], type:s[2], enabled:1, priority:s[3], template:s[4], config:s[5] || '{}'
  }));
}
function sourceGroup(src) {
  const n = String(src.name||src.id||src.template||'').toLowerCase();
  const t = String(src.type||'').toLowerCase();
  if (/reddit/.test(n)) return 'reddit';
  if (/github|gist|gitlab|bitbucket|raw\.githubusercontent/.test(n)) return 'code';
  if (/rentry|paste|controlc|haste|txti|dpaste|0bin/.test(n)) return 'paste';
  if (/archive/.test(n)) return 'archive';
  if (/keeplinks|bit\.ly|sh\.st|short|adf\.ly|ouo|linkvertise|linkbucks/.test(n)) return 'redirector';
  if (/ofversedrops|meawfy|linktree|linktr|beacons|bio\.link|solo\.to|carrd|heylink|lnk|allmylinks|taplink|bio\.fm|hypage|koji|linkpop|snipfeed|milkshake|shor\.by|tap\.bio/.test(n)) return 'linkhub';
  if (/bing|duck|yahoo|brave|google|mojeek|qwant|startpage|yandex|searx/.test(n)) return 'engine';
  if (t === 'json' || t === 'rss') return 'structured';
  return 'web';
}
function balancedSources(rows, offset=0) {
  const groups = {};
  for (const r of rows) {
    const g = sourceGroup(r);
    (groups[g] ||= []).push(r);
  }
  for (const k of Object.keys(groups)) groups[k].sort((a,b)=>(b.priority||0)-(a.priority||0));
  const order = ['paste','reddit','archive','linkhub','redirector','structured','engine','web','code'];
  const out = [];
  let more = true, i = 0;
  while (more && out.length < rows.length) {
    more = false;
    for (const g of order) {
      const list = groups[g] || [];
      if (i < list.length) { out.push(list[i]); more = true; }
    }
    i++;
  }
  if (!out.length) return rows;
  offset = Math.max(0, offset||0) % out.length;
  return out.slice(offset).concat(out.slice(0, offset));
}
function defaultSourceEnabled(src) {
  const id = String(src.id || '').toLowerCase();
  const n = String(src.name || src.id || src.template || '').toLowerCase();
  const pri = Number(src.priority || 0);
  // Evidence-ranked V34 policy. Direct structured sources and comment/paste targets first.
  if (/github|gitlab|bitbucket|youtube|vimeo|tiktok|instagram|facebook|linkedin|pinterest|scribd|slideshare/.test(n)) return 0;
  if (/^wide_|generic_bing/.test(id)) return 0;
  if (/meawfy_api|reddit_search_json|reddit_all_url_json|reddit_megalinks_json|archive_search|archive_fulltext|bing_rss/.test(id)) return 1;
  if (/rentry|pastebin|paste\.ee|justpaste|controlc|dpaste|pastes\.io|paste\.rs|pastelink|telegra\.ph|reddit|old\.reddit|archive\.org|meawfy|keeplinks|ofversedrops/.test(n)) return pri >= 76 ? 1 : 0;
  if (/duckduckgo_lite|duckduckgo_html|brave_web|startpage|searx/.test(id)) return 1;
  if (/linktr|beacons|bio\.link|solo\.to|heylink|lnk\.bio|carrd/.test(n)) return pri >= 88 ? 1 : 0;
  if (/^src_/.test(id)) return pri >= 92 && /rentry|paste|reddit|archive|meawfy|keeplinks|telegra/.test(n) ? 1 : 0;
  return 0;
}
async function sourceOverrideMap(env) {
  const map = new Map();
  try {
    const r = await all(env, `SELECT id,enabled,priority,name,type,template,config FROM ${T.sources}`);
    for (const x of (r.results||[])) map.set(String(x.id), x);
  } catch {}
  return map;
}
async function getSources(env, opts = {}) {
  // Stable source resolver: always starts from the in-memory catalog.
  // D1 is only used for explicit user overrides (toggle/priority/custom sources).
  if (!opts.skip_policy) await ensureSourcePolicy(env);
  const maxSources = intEnv(env, 'MAX_SOURCES_PER_RUN', 1000, 25, 1000);
  const includeDisabled = !!opts.include_disabled;
  const overrides = await sourceOverrideMap(env);
  let rows = catalogSources().map(src => {
    const ov = overrides.get(String(src.id));
    const enabled = ov ? Number(ov.enabled||0) : defaultSourceEnabled(src);
    return {
      ...src,
      enabled,
      priority: ov && ov.priority != null ? Number(ov.priority) : src.priority,
      category: sourceGroup(src),
      builtin:1
    };
  });
  try {
    const r = await all(env, `SELECT * FROM ${T.sources} WHERE template IS NOT NULL AND template!='' ORDER BY priority DESC LIMIT 500`);
    for (const x of (r.results || [])) {
      if (!rows.find(r=>String(r.id)===String(x.id))) {
        rows.push({ ...x, enabled:Number(x.enabled||0), category:sourceGroup(x), builtin:0 });
      }
    }
  } catch {}
  const seen = new Set();
  rows = rows.filter(r => { const k=String(r.id||r.name||r.template); if(seen.has(k)) return false; seen.add(k); return true; });
  if (!includeDisabled) rows = rows.filter(r => Number(r.enabled) === 1);
  const rotated = balancedSources(rows, Number(opts.offset||0));
  // For Sources UI, return the full catalog; for scan runs, obey MAX_SOURCES_PER_RUN.
  return includeDisabled ? rotated : rotated.slice(0, maxSources);
}
async function setSourceEnabled(env, id, enabled, priority=null) {
  await ensureDb(env);
  const src = catalogSources().find(s => String(s.id) === String(id)) || null;
  const existing = await first(env, `SELECT * FROM ${T.sources} WHERE id=?`, [id]);
  const name = existing?.name || src?.name || id;
  const type = existing?.type || src?.type || 'html';
  const template = existing?.template || src?.template || '';
  const pri = priority != null ? Number(priority) : (existing?.priority ?? src?.priority ?? 50);
  await q(env, `INSERT OR REPLACE INTO ${T.sources}(id,name,type,enabled,priority,template,config,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`,
    [id,name,type,enabled?1:0,pri,template,existing?.config || src?.config || '{}', existing?.created_at || nowIso(), nowIso()]);
  return { ok:true, id, enabled:enabled?1:0 };
}

async function applySourcePreset(env, action='high_yield') {
  await ensureDb(env);
  const catalog = catalogSources();
  let rows = catalog.map(src => {
    let enabled = defaultSourceEnabled(src);
    if (action === 'enable_all') enabled = 1;
    if (action === 'disable_all') enabled = 0;
    if (action === 'high_yield') enabled = defaultSourceEnabled(src);
    return { ...src, enabled, category: sourceGroup(src) };
  });
  // Chunked multi-row UPSERT: avoids 1000 individual D1 API calls.
  let changed = 0;
  for (let i=0; i<rows.length; i+=70) {
    const chunk = rows.slice(i, i+70);
    const values = chunk.map(()=>'(?,?,?,?,?,?,?,?,?)').join(',');
    const params = [];
    for (const s of chunk) params.push(s.id, s.name, s.type, s.enabled?1:0, s.priority||50, s.template, s.config||'{}', nowIso(), nowIso());
    await q(env, `INSERT OR REPLACE INTO ${T.sources}(id,name,type,enabled,priority,template,config,created_at,updated_at) VALUES ${values}`, params);
    changed += chunk.length;
  }
  return { ok:true, version:VERSION, action, changed, total:rows.length, enabled:rows.filter(x=>x.enabled).length };
}

async function ensureSourcePolicy(env) {
  // Never write the full 1000-row catalog during a normal API request.
  // Defaults are computed in memory; D1 stores only explicit user overrides.
  // Bulk presets remain available only when the user presses High Yield / Enable All / Disable All.
  try {
    const current = await getSetting(env, 'source_policy_version', '');
    if (current !== SOURCE_POLICY_VERSION) {
      await setSetting(env, 'source_policy_version', SOURCE_POLICY_VERSION);
      await logEvent(env, 'info', 'source_policy_marker_updated', { version:SOURCE_POLICY_VERSION, bulk_write:false });
    }
    return { ok:true, applied: current !== SOURCE_POLICY_VERSION, bulk_write:false };
  } catch (e) {
    return { ok:false, applied:false, error:String(e.message||e).slice(0,300) };
  }
}

function sourceUrl(source, query) { return String(source.template || '').replace('{q}', encodeURIComponent(query)); }
function b64UrlDecodeMaybe(v) {
  v = String(v || '').trim();
  const tries = [v];
  if (/^a1[A-Za-z0-9_\-]+=*$/i.test(v)) tries.push(v.slice(2)); // Bing ck/a uses u=a1<base64url>
  for (let x of tries) {
    try {
      x = x.replace(/-/g,'+').replace(/_/g,'/');
      while (x.length % 4) x += '=';
      const out = atob(x);
      if (/^https?:\/\//i.test(out)) return out;
    } catch {}
  }
  return '';
}
function redirectParamCandidates(rawUrl, baseUrl) {
  const out = [];
  try {
    const u = new URL(rawUrl, baseUrl);
    const keys = ['url','u','uddg','target','redirect','to','q','r','dest','destination'];
    for (const k of keys) {
      const val = u.searchParams.get(k);
      if (!val) continue;
      out.push(val);
      try { out.push(decodeURIComponent(val)); } catch {}
      const b = b64UrlDecodeMaybe(val); if (b) out.push(b);
    }
    // Bing result links often hide the real target inside /ck/a?u=a1<base64url>.
    if (/bing\./i.test(u.hostname) && /\/ck\//i.test(u.pathname)) {
      const val = u.searchParams.get('u') || '';
      const b = b64UrlDecodeMaybe(val); if (b) out.push(b);
    }
    // DuckDuckGo result redirect: /l/?uddg=<encoded url>
    if (/duckduckgo\./i.test(u.hostname) && u.searchParams.get('uddg')) out.push(u.searchParams.get('uddg'));
    // Google result redirect: /url?q=<encoded url>
    if (/google\./i.test(u.hostname) && u.pathname === '/url' && u.searchParams.get('q')) out.push(u.searchParams.get('q'));
  } catch {}
  return out;
}
function rawPageVariants(u) {
  const out = [];
  try {
    const x = new URL(u);
    const h = x.hostname.replace(/^www\./,'');
    const path = x.pathname.replace(/\/$/,'');
    let m;
    if (h === 'pastebin.com' && (m = path.match(/^\/([A-Za-z0-9]{6,})$/))) out.push('https://pastebin.com/raw/' + m[1]);
    if (h === 'rentry.co' && (m = path.match(/^\/([A-Za-z0-9_-]{3,})$/))) out.push('https://rentry.co/' + m[1] + '/raw');
    if (h === 'dpaste.org' && !/\/raw$/.test(path)) out.push(x.origin + path + '/raw');
    if (h === 'hastebin.com' && (m = path.match(/^\/share\/([A-Za-z0-9_-]+)/))) out.push('https://hastebin.com/raw/' + m[1]);
    if (h === 'hastebin.com' && (m = path.match(/^\/([A-Za-z0-9_-]+)/))) out.push('https://hastebin.com/raw/' + m[1]);
    if (h === 'paste.rs' && !/\/raw$/.test(path)) out.push(x.origin + path + '/raw');
  } catch {}
  return out;
}
async function cachedFetch(env, url, sourceName) {
  const started = Date.now();
  let status = 0, txt = '', error = '', contentType = '', finalUrl = url;
  try {
    const res = await fetchWithTimeout(url, { redirect:'follow' }, TIMEOUT_MS);
    status = res.status;
    contentType = String(res.headers.get('content-type') || '').toLowerCase();
    finalUrl = res.url || url;
    txt = await bodyText(res);
  } catch (e) { error = String(e.message||e); }
  const lower = txt.slice(0,12000).toLowerCase();
  const blocked = status === 403 || status === 429 || /captcha|cf-chl-|cloudflare ray id|access denied|verify you are human|unusual traffic/.test(lower);
  const kind = blocked ? 'blocked' : (/json/.test(contentType) || /^[\s\n]*[\[{]/.test(txt) ? 'json' : (/xml|rss|atom/.test(contentType) || /<rss\b|<feed\b/i.test(txt) ? 'xml' : 'html'));
  const elapsed = Date.now()-started;
  await recordSourceMetric(env, sourceName || hostOf(url), {status, elapsed, blocked, error, success:status>=200&&status<400&&!blocked});
  return { fromCache:false, status, text:txt, error, contentType, finalUrl, blocked, kind, elapsed };
}
async function recordSourceMetric(env, sourceName, m={}) {
  const name = String(sourceName||'unknown'); const id='sm_'+hash(name.toLowerCase()); const now=nowIso();
  try { await q(env, `INSERT INTO ${T.sourceMetrics}(source_id,source_name,requests,successes,blocked,errors,pages,candidates,valid_links,total_response_ms,last_status,last_success_at,last_error,updated_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(source_id) DO UPDATE SET
    requests=requests+1, successes=successes+excluded.successes, blocked=blocked+excluded.blocked, errors=errors+excluded.errors,
    pages=pages+excluded.pages, candidates=candidates+excluded.candidates, valid_links=valid_links+excluded.valid_links,
    total_response_ms=total_response_ms+excluded.total_response_ms, last_status=excluded.last_status,
    last_success_at=COALESCE(excluded.last_success_at,last_success_at), last_error=excluded.last_error, updated_at=excluded.updated_at,
    consecutive_failures=CASE WHEN excluded.successes>0 THEN 0 ELSE consecutive_failures+1 END,
    cooldown_until=CASE WHEN excluded.successes>0 THEN NULL WHEN consecutive_failures+1>=5 THEN datetime('now','+30 minutes') ELSE cooldown_until END`,
    [id,name,1,m.success?1:0,m.blocked?1:0,m.error?1:0,m.pages||0,m.candidates||0,m.valid_links||0,m.elapsed||0,m.status||0,m.success?now:null,clamp(m.error||'',400),now]); } catch {}
}

function addCandidateUrl(set, val, baseUrl) {
  if (!val || set.size >= 180) return;
  const decoded = decodeLoose(String(val));
  const queue = decoded.split(/[\s"'<>]+/).slice(0, 700);
  for (let i = 0; i < queue.length && set.size < 180; i++) {
    let c = String(queue[i] || '').trim().replace(/&amp;/g,'&').replace(/[\])},.;]+$/g,'');
    if (!c) continue;
    // Add decoded redirect targets before filtering the search-engine URL itself.
    for (const r of redirectParamCandidates(c, baseUrl)) {
      if (r && r !== c) queue.push(String(r));
    }
    const u = safeUrl(c, baseUrl);
    if (!u || !/^https?:/i.test(u)) continue;
    const h = hostOf(u);
    if (!h) continue;
    // Skip search engine shell URLs after extracting their true targets.
    if (/^(www\.)?(bing|duckduckgo|search\.yahoo|google|startpage|qwant|mojeek|yandex)\./i.test(h)) continue;
    set.add(u);
    for (const v of rawPageVariants(u)) set.add(v);
  }
}
function extractJsonUrls(obj, out, baseUrl, depth=0) {
  if (!obj || depth > 7 || out.size >= 120) return;
  if (typeof obj === 'string') return addCandidateUrl(out, obj, baseUrl);
  if (Array.isArray(obj)) { for (const x of obj) extractJsonUrls(x, out, baseUrl, depth+1); return; }
  if (typeof obj === 'object') {
    for (const [k,v] of Object.entries(obj)) {
      if (/url|link|href|permalink|selftext|body|title|description|content/i.test(k)) extractJsonUrls(v, out, baseUrl, depth+1);
      else if (typeof v === 'object') extractJsonUrls(v, out, baseUrl, depth+1);
    }
  }
}
function addCommentTargets(decoded, urls, baseUrl) {
  // Reddit: convert post/search permalinks to .json so comments and selftext are fetched.
  const redditRe = /https?:\/\/(?:www\.|old\.)?reddit\.com\/r\/[^"'<> )]+\/comments\/[A-Za-z0-9_]+[^"'<> )]*/gi;
  let m;
  while ((m = redditRe.exec(decoded)) !== null && urls.size < 160) {
    try { const u = new URL(m[0]); urls.add(u.origin + u.pathname.replace(/\/$/,'') + '.json'); } catch {}
  }
  const relRedditRe = /["'](\/r\/[^"'<>]+\/comments\/[A-Za-z0-9_]+[^"']*)["']/gi;
  while ((m = relRedditRe.exec(decoded)) !== null && urls.size < 160) {
    try { const u = new URL(m[1], 'https://www.reddit.com'); urls.add(u.origin + u.pathname.replace(/\/$/,'') + '.json'); } catch {}
  }
  // GitHub issues / pulls: add API comments endpoint for visible public comments.
  const ghIssueRe = /https?:\/\/github\.com\/([^\/\s"'<>]+)\/([^\/\s"'<>]+)\/(?:issues|pull)\/(\d+)/gi;
  while ((m = ghIssueRe.exec(decoded)) !== null && urls.size < 160) {
    urls.add(`https://api.github.com/repos/${m[1]}/${m[2]}/issues/${m[3]}/comments`);
  }
  // Hacker News Algolia item IDs: fetch story/comment trees.
  try {
    const j = JSON.parse(decoded);
    const ids = [];
    const walk = (o, d=0) => {
      if (!o || d > 8 || ids.length > 40) return;
      if (Array.isArray(o)) return o.forEach(x=>walk(x,d+1));
      if (typeof o === 'object') {
        if (o.objectID && /hn\.algolia|algolia/i.test(baseUrl||'')) ids.push(String(o.objectID));
        for (const v of Object.values(o)) if (typeof v === 'object') walk(v,d+1);
      }
    };
    walk(j);
    for (const id of ids) urls.add(`https://hn.algolia.com/api/v1/items/${encodeURIComponent(id)}`);
  } catch {}
  // Disqus/embedded public comment JSON endpoints often expose comment text in page HTML.
  const disqusRe = /https?:\/\/[A-Za-z0-9_.-]+\.disqus\.com\/embed\/comments\/[^\s"'<> )]+/gi;
  while ((m = disqusRe.exec(decoded)) !== null && urls.size < 160) addCandidateUrl(urls, m[0], baseUrl);
  // Telegram public web pages sometimes list copied links as text. Keep public t.me/s pages only.
  const tgRe = /https?:\/\/t\.me\/s\/[A-Za-z0-9_\-]+[^\s"'<> )]*/gi;
  while ((m = tgRe.exec(decoded)) !== null && urls.size < 160) addCandidateUrl(urls, m[0], baseUrl);
}

function parseSearchTargets(text, source, baseUrl) {
  const urls = new Set();
  const decoded = decodeLoose(text);
  for (const u of extractPageUrls(decoded, baseUrl)) addCandidateUrl(urls, u, baseUrl);
  // RSS link tags and atom links
  let m;
  const linkRe = /<link[^>]*>([\s\S]*?)<\/link>|<link[^>]+href=["']([^"']+)/gi;
  while ((m = linkRe.exec(decoded)) !== null && urls.size < 120) addCandidateUrl(urls, (m[1]||m[2]||'').replace(/<!\[CDATA\[|\]\]>/g,''), baseUrl);
  // JSON recursive extraction and comment endpoints
  try { extractJsonUrls(JSON.parse(decoded), urls, baseUrl); } catch {}
  addCommentTargets(decoded, urls, baseUrl);
  // Follow common public redirect/container pages.
  const shortRe = /https?:\/\/(?:bit\.ly|sh\.st|shorturl\.at|tinyurl\.com|cutt\.ly|is\.gd|t\.co|keeplinks\.eu|linkvertise\.com|ouo\.io|ouo\.press)\/[^\s"'<> )]+/gi;
  let sm;
  while ((sm = shortRe.exec(decoded)) !== null && urls.size < 160) addCandidateUrl(urls, sm[0], baseUrl);
  // Reddit comments JSON targets from permalinks
  for (const u of [...urls]) {
    if (/reddit\.com\/r\//i.test(u) && !/\.json(?:$|[?#])/i.test(u)) {
      try { urls.add(new URL(u).origin + new URL(u).pathname.replace(/\/$/,'') + '.json'); } catch {}
    }
  }
  return [...urls].slice(0, 160);
}
async function saveLink(env, data) {
  const norm = normalizeLink(data.link);
  if (!norm) return false;
  if (/\/file\//i.test(norm)) return false;
  const type = 'folder';
  const keywordKey = String(data.keyword||'');
  const source = realSourceLabel(data.source, data.page_url);
  const id = 'ln_' + hash((data.mode||'') + '|' + keywordKey + '|' + norm);
  const score = scoreResult({link:norm, source, title:data.title, pageUrl:data.page_url, mode:data.mode});
  const now = nowIso();
  await q(env, `INSERT INTO ${T.links}(id,run_id,mode,keyword,keyword_key,link,normalized,type,source,page_url,title,snippet,score,health,first_seen_at,last_seen_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(mode, normalized, keyword_key) DO UPDATE SET last_seen_at=excluded.last_seen_at, score=max(score, excluded.score), source=excluded.source, page_url=excluded.page_url, title=COALESCE(excluded.title,title), health='unverified'`,
    [id, data.run_id||'', data.mode||'search', data.keyword||'', keywordKey, norm, norm, type, source, data.page_url||'', data.title||'', data.snippet||'', score, 'unverified', now, now]);
  const srcJson = JSON.stringify([source].filter(Boolean));
  await q(env, `INSERT INTO ${T.archive}(normalized,link,type,source,sources,page_url,keyword,first_seen_at,last_seen_at,seen_count,score,health,snippet)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(normalized) DO UPDATE SET last_seen_at=excluded.last_seen_at, seen_count=seen_count+1, score=max(score, excluded.score), health='unverified', source=excluded.source, page_url=COALESCE(excluded.page_url,page_url), keyword=COALESCE(NULLIF(excluded.keyword,''),keyword), snippet=COALESCE(excluded.snippet,snippet)`,
    [norm, norm, type, source, srcJson, data.page_url||'', data.keyword||'', now, now, 1, score, 'unverified', data.snippet||'']);
  return true;
}

const VISIT_TTL_MS = 1000 * 60 * 60 * 24 * 30;
async function recentlyVisited(env, url) {
  const row = await first(env, `SELECT last_scanned_at FROM ${T.visited} WHERE url_hash=?`, [hash(url)]);
  return !!(row && Date.now() - new Date(row.last_scanned_at).getTime() < VISIT_TTL_MS);
}
async function recordVisited(env, url, source, status, linksFound, body='') {
  const now=nowIso();
  await q(env, `INSERT INTO ${T.visited}(url_hash,url,source,first_scanned_at,last_scanned_at,last_status,links_found,content_hash,scan_count)
    VALUES(?,?,?,?,?,?,?,?,1) ON CONFLICT(url_hash) DO UPDATE SET last_scanned_at=excluded.last_scanned_at,last_status=excluded.last_status,links_found=excluded.links_found,content_hash=excluded.content_hash,scan_count=scan_count+1`,
    [hash(url),url,source||'',now,now,status||0,linksFound||0,hash(String(body||'').slice(0,100000))]);
}
async function updateRunProgress(env, runId) {
  if(!runId) return null;
  const qx=await first(env, `SELECT COUNT(*) total, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) done, SUM(CASE WHEN status IN ('dead_letter','failed') THEN 1 ELSE 0 END) failed, SUM(CASE WHEN status IN ('pending','running','leased','retry_wait') THEN 1 ELSE 0 END) remaining FROM ${T.queue} WHERE run_id=?`,[runId]);
  const sx=await first(env, `SELECT COUNT(*) total, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) done, SUM(CASE WHEN status IN ('failed','dead_letter') THEN 1 ELSE 0 END) failed FROM ${T.runTasks} WHERE run_id=?`,[runId]);
  const run=await first(env,`SELECT planned_sources,seeded_sources,status,sources_exhausted,progress_floor FROM ${T.runs} WHERE id=?`,[runId]);
  const sourceTotal=Math.max(Number(run?.planned_sources||0),Number(sx?.total||0),1);
  const sourceTerminal=Number(sx?.done||0)+Number(sx?.failed||0);
  const discoveryPct=Math.min(100,(sourceTerminal/sourceTotal)*100);
  const queueTotal=Math.max(Number(qx?.total||0),1);
  const queueTerminal=Number(qx?.done||0)+Number(qx?.failed||0);
  const queuePct=Math.min(100,(queueTerminal/queueTotal)*100);
  const exhausted=Number(run?.sources_exhausted||0)===1;
  let calculated=exhausted ? 60 + queuePct*0.40 : discoveryPct*0.60;
  const previous=Number(run?.progress_floor||0);
  const progress=Math.min(100,Math.max(previous,Math.round(calculated*100)/100));
  const remaining=Number(qx?.remaining||0);
  let status=run?.status||'running';
  if(status!=='paused' && exhausted && remaining===0 && sourceTerminal>=sourceTotal){
    status='done';
    await finishRun(env,runId);
  }
  await q(env,`UPDATE ${T.runs} SET total_tasks=?,completed_tasks=?,failed_tasks=?,progress_percent=?,progress_floor=?,last_heartbeat=?,current_stage=? WHERE id=?`,[Number(qx?.total||0),Number(qx?.done||0),Number(qx?.failed||0),progress,progress,nowIso(),status==='done'?'complete':(exhausted?'draining':'discovery'),runId]);
  return {total:Number(qx?.total||0),done:Number(qx?.done||0),failed:Number(qx?.failed||0),remaining,source_total:sourceTotal,source_done:sourceTerminal,sources_exhausted:exhausted,progress_percent:status==='done'?100:progress,status};
}
async function runSnapshot(env, runId) {
  await ensureDb(env);
  const run=runId?await first(env,`SELECT * FROM ${T.runs} WHERE id=?`,[runId]):await first(env,`SELECT * FROM ${T.runs} WHERE status IN ('running','paused') ORDER BY started_at DESC LIMIT 1`);
  if(!run) return {ok:true,version:VERSION,run:null,progress:null,results:[]};
  const progress=await updateRunProgress(env,run.id);
  const results=(await getResults(env,run.mode,run.keyword||'',200)).results;
  return {ok:true,version:VERSION,run:{...run,...progress},progress,results,stats:await dashboardStats(env)};
}
async function resumeRun(env, runId='', opts={}) {
  await ensureDb(env);
  let run=runId?await first(env,`SELECT * FROM ${T.runs} WHERE id=?`,[runId]):await first(env,`SELECT * FROM ${T.runs} WHERE status IN ('running','paused') ORDER BY started_at DESC LIMIT 1`);
  if(!run) return {ok:false,error:'no_resumable_run'};
  if(run.status==='done' || run.status==='cancelled') return {ok:false,error:'run_not_resumable',status:run.status};
  await recoverExpiredLeases(env);
  await q(env,`UPDATE ${T.runs} SET status='running',resume_count=COALESCE(resume_count,0)+1,stop_reason=NULL,last_heartbeat=?,current_stage='resuming' WHERE id=?`,[nowIso(),run.id]);
  // Resume must make progress even when D1 contains orphaned shadow rows that were never delivered to Cloud Queue.
  const processed=await processQueue(env,run.id,Math.min(Math.max(1,Number(opts.limit||3)),6));
  const orchestration=await orchestrateRun(env,run.id,{seed_limit:Number(opts.seed_limit||SCHEDULE_SEED_LIMIT),threshold:6});
  return {...await runSnapshot(env,run.id),resumed:true,processed,orchestration};
}
async function enqueue(env, item) {
  const sourceName = typeof item.source === 'string' ? item.source : (item.source?.name || item.source_name || '');
  let qUrl = item.url || '';
  // Source tasks must keep a concrete URL in the D1 shadow queue so the frontend/deep drain can process them
  // even when Cloudflare Queue consumer is not attached or Pages cannot consume queue messages.
  if (!qUrl && item.kind === 'source') {
    try {
      const srcObj = (item.source && typeof item.source === 'object') ? item.source : { name: sourceName || 'source', template: item.template || '' };
      if (srcObj.template) qUrl = sourceUrl(srcObj, item.query || item.keyword || 'mega.nz/folder');
    } catch {}
  }
  const qKeyword = item.keyword || item.query || '';
  const id = item.id || 'q_' + hash([item.run_id||'',item.kind,qUrl,qKeyword,item.mode,sourceName].join('|'));
  const result=await q(env, `INSERT OR IGNORE INTO ${T.queue}(id,run_id,mode,kind,url,keyword,source,priority,status,attempts,max_attempts,available_at,created_at,updated_at,error) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, item.run_id||'', item.mode||'search', item.kind, qUrl, qKeyword, sourceName, item.priority||50, 'pending', 0, item.max_attempts||3, item.available_at||nowIso(), nowIso(), nowIso(), '']);
  return {id,inserted:Number(result?.meta?.changes||0)===1,qUrl,qKeyword,sourceName};
}
async function enqueueCloud(env, body) {
  const qbind = env.AUTOSCAN_QUEUE || env.QUEUE;
  if (!qbind || !qbind.send) return false;
  await qbind.send(body);
  return true;
}
async function enqueueTask(env, item, preferCloud = true) {
  if (preferCloud && (env.AUTOSCAN_QUEUE || env.QUEUE)) {
    try {
      await enqueueCloud(env, item);
      // Also keep a lightweight pending row for UI visibility/resume.
      await enqueue(env, { ...item, id:item.id || 'qlog_' + hash([item.kind,item.url,item.keyword,item.mode,item.run_id].join('|')) });
      return 'cloud';
    } catch (e) {
      await logEvent(env, 'warn', 'queue_send_failed_fallback_d1', { error:String(e.message||e).slice(0,300), kind:item.kind, url:item.url||'' });
    }
  }
  await enqueue(env, item);
  return 'd1';
}
async function enqueueManyCloud(env, items) {
  let inserted=0, sent=0;
  const qbind=env.AUTOSCAN_QUEUE||env.QUEUE;
  for (const original of items) {
    const stableId=original.id||'q_'+hash([original.run_id||'',original.kind,original.url||original.template||'',original.query||original.keyword||'',original.mode,original.source_name||original.source?.name||''].join('|'));
    const it={...original,id:stableId};
    const saved=await enqueue(env,it);
    if(!saved.inserted) continue;
    inserted++;
    if(qbind?.send){ try{await qbind.send(it);sent++;}catch(e){await logEvent(env,'warn','queue_send_failed',{id:stableId,error:String(e.message||e).slice(0,200)});} }
  }
  return {mode:qbind?.send?'cloud_queue_with_d1_shadow':'d1_shadow_fallback',enqueued:inserted,sent};
}
async function startRun(env, mode, keyword) {
  await ensureDb(env);
  const runId = uid('run');
  await q(env, `INSERT INTO ${T.runs}(id,mode,keyword,status,started_at,notes) VALUES(?,?,?,?,?,?)`, [runId, mode, keyword||'', 'running', nowIso(), '']);
  await q(env, `UPDATE ${T.runs} SET last_heartbeat=?, current_stage='discovery' WHERE id=?`, [nowIso(), runId]);
  return runId;
}
async function finishRun(env, runId) {
  const stats = await runStats(env, runId);
  const run = await first(env, `SELECT started_at FROM ${T.runs} WHERE id=?`, [runId]);
  const elapsed = run ? Date.now() - new Date(run.started_at).getTime() : 0;
  await q(env, `UPDATE ${T.runs} SET status='done', finished_at=?, elapsed_ms=?, pages_scanned=?, links_found=?, links_alive=?, links_dead=?, links_unknown=?, sources_used=? WHERE id=?`,
    [nowIso(), elapsed, stats.pages, stats.links, stats.alive, stats.dead, stats.unknown, stats.sources, runId]);
}
async function runStats(env, runId) {
  const p = await first(env, `SELECT COUNT(*) pages, COUNT(DISTINCT source) sources FROM ${T.pages} WHERE run_id=?`, [runId]);
  const l = await first(env, `SELECT COUNT(*) links, SUM(CASE WHEN health IN ('alive','valid') THEN 1 ELSE 0 END) alive, SUM(CASE WHEN health='dead' THEN 1 ELSE 0 END) dead, SUM(CASE WHEN health NOT IN ('alive','valid','dead') THEN 1 ELSE 0 END) unknown FROM ${T.links} WHERE run_id=?`, [runId]);
  return { pages:p?.pages||0, sources:p?.sources||0, links:l?.links||0, alive:l?.alive||0, dead:l?.dead||0, unknown:l?.unknown||0 };
}
async function processSourceFetch(env, runId, mode, keyword, src, query, started = Date.now(), preferCloud = true) {
  let direct = 0, queued = 0;
  const metric=await first(env,`SELECT cooldown_until FROM ${T.sourceMetrics} WHERE source_id=?`,['sm_'+hash(String(src.name||'unknown').toLowerCase())]);
  if(metric?.cooldown_until && new Date(metric.cooldown_until).getTime()>Date.now()) return {direct:0,queued:0,status:429,targets:0,skipped:'source_cooldown'};
  const url = sourceUrl(src, query);
  if(await recentlyVisited(env,url)){ await recordSourceMetric(env,src.name,{status:208,elapsed:0,pages:0,candidates:0,valid_links:0,success:true}); return {direct:0,queued:0,status:208,targets:0,skipped:'recently_visited_source'}; }
  const got = await cachedFetch(env, url, src.name);
  const links = extractMegaLinks(got.text);
  for (const link of links) {
    if (await saveLink(env, { run_id:runId, mode, keyword:keyword||'', link, source:src.name, page_url:url, title:query, snippet:'direct from source response' })) direct++;
  }
  await q(env, `INSERT OR IGNORE INTO ${T.pages}(id,run_id,mode,source,url,title,status,depth,links_found,scanned_at,error) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
    ['pg_'+hash(runId+url), runId, mode, realSourceLabel(src.name, url), url, query, got.status||0, 0, links.length, nowIso(), got.error||'']);
  const targetLimit = mode === 'autoscan' ? QUEUE_CRAWL_CHILD_LIMIT : 6;
  const targets = got.blocked ? [] : parseSearchTargets(got.text, src, got.finalUrl||url).slice(0, targetLimit);
  await recordVisited(env,url,src.name,got.status||0,links.length,got.text);
  await recordSourceMetric(env, src.name, {status:got.status, elapsed:Date.now()-started, pages:1, candidates:targets.length, valid_links:direct, blocked:got.blocked, error:got.error, success:got.status>=200&&got.status<400&&!got.blocked});
  const tasks = targets.map(t => ({ run_id:runId, mode, kind:'crawl', url:t, keyword:keyword||query, source:hostOf(t)||src.name, priority: src.priority || 50, max_attempts:3 }));
  if (tasks.length) {
    if (preferCloud && (env.AUTOSCAN_QUEUE || env.QUEUE)) { await enqueueManyCloud(env, tasks); queued += tasks.length; }
    else { for (const t of tasks) { await enqueue(env, t); queued++; } }
  }
  return { direct, queued, status:got.status||0, targets:targets.length };
}

async function getSetting(env, key, fallback='') {
  try { const r = await first(env, `SELECT value FROM ${T.settings} WHERE key=?`, [key]); return r?.value ?? fallback; } catch { return fallback; }
}
async function setSetting(env, key, value) {
  try { await q(env, `INSERT OR REPLACE INTO ${T.settings}(key,value,updated_at) VALUES(?,?,?)`, [key, String(value), nowIso()]); } catch {}
}
async function seedQueueSlice(env, runId, mode='autoscan', keyword='', opts={}) {
  await ensureDb(env);
  const allSources=await getSources(env,{offset:0});
  const queries=buildQueries(keyword,mode);
  if(!allSources.length||!queries.length) return {enqueued:0,next_source_offset:0,exhausted:true};
  const run=await first(env,`SELECT source_cursor,sources_exhausted,status FROM ${T.runs} WHERE id=?`,[runId]);
  if(!run) return {enqueued:0,error:'run_not_found',exhausted:true};
  if(run.status==='paused') return {enqueued:0,paused:true,exhausted:false};
  if(Number(run.sources_exhausted||0)===1) return {enqueued:0,next_source_offset:Number(run.source_cursor||allSources.length),exhausted:true};
  const sourceOffset=Math.max(0,Number(opts.source_offset??run.source_cursor??0)||0);
  if(sourceOffset>=allSources.length){await q(env,`UPDATE ${T.runs} SET sources_exhausted=1,current_stage='draining',last_heartbeat=? WHERE id=?`,[nowIso(),runId]);return {enqueued:0,next_source_offset:sourceOffset,exhausted:true};}
  const defaultLimit=mode==='search'?SCHEDULE_SEED_LIMIT_KEYWORD:SCHEDULE_SEED_LIMIT_AUTOSCAN;
  const safeLimit=Math.min(Number(opts.max_sources||0)||defaultLimit,defaultLimit,allSources.length-sourceOffset);
  const selected=allSources.slice(sourceOffset,sourceOffset+safeLimit);
  const tasks=selected.map((src,i)=>({kind:'source',run_id:runId,mode,keyword:keyword||'',source:src,source_name:src.name||'source',query:queries[(sourceOffset+i)%queries.length],priority:src.priority||50}));
  for(const t of tasks){const sid=String(t.source?.id||t.source_name||'');await q(env,`INSERT OR IGNORE INTO ${T.runTasks}(id,run_id,source_id,source_name,query,status,created_at,updated_at) VALUES(?,?,?,?,?,'planned',?,?)`,['rt_'+hash(runId+'|'+sid+'|'+t.query),runId,sid,t.source_name||'',t.query,nowIso(),nowIso()]);}
  const out=await enqueueManyCloud(env,tasks);
  const next=sourceOffset+selected.length;
  const exhausted=next>=allSources.length;
  await q(env,`UPDATE ${T.runs} SET source_cursor=?,seeded_sources=?,sources_exhausted=?,current_stage=?,last_heartbeat=? WHERE id=?`,[next,next,exhausted?1:0,exhausted?'draining':'discovery',nowIso(),runId]);
  return {enqueued:out.enqueued||0,sent:out.sent||0,queue_mode:out.mode,source_offset:sourceOffset,next_source_offset:next,catalog_sources:allSources.length,safe_seed_limit:safeLimit,exhausted};
}

async function scheduleQueueRun(env, mode='autoscan', keyword='', opts={}) {
  await ensureDb(env);
  let runId = String(opts.run_id||'');
  if(runId){ const ex=await first(env,`SELECT id,status,mode,keyword FROM ${T.runs} WHERE id=?`,[runId]); if(!ex || ['done','cancelled'].includes(ex.status) || ex.mode!==mode || String(ex.keyword||'')!==String(keyword||'')) runId=''; }
  if(!runId) runId = await startRun(env, mode, keyword||'');
  const srcCount=(await getSources(env,{offset:0})).length;
  await q(env,`UPDATE ${T.runs} SET planned_sources=?,status='running',last_heartbeat=?,orchestrator=? WHERE id=?`,[srcCount,nowIso(),(env.AUTOSCAN_QUEUE||env.QUEUE)?'cloud_queue':'cron_d1_fallback',runId]);
  const seeded = await seedQueueSlice(env, runId, mode, keyword||'', opts||{});
  return { ok:true, version:VERSION, queued:true, run_id:runId, mode, keyword:keyword||'', ...seeded, remaining_estimate:Math.max(0,(seeded.catalog_sources||0)-(seeded.safe_seed_limit||0)), message:'Queue/Archive job created in safe chunks. AutoPilot continues seeding slices and draining D1 Shadow Queue.' };
}
async function handleQueueMessage(env, body) {
  await ensureDb(env);
  if (!body || typeof body !== 'object') return { ok:false, error:'empty_body' };
  if (body.kind === 'source') {
    const src = body.source || { name:body.source_name||'source', template:body.template, priority:body.priority||50 };
    const r = await processSourceFetch(env, body.run_id||'', body.mode||'autoscan', body.keyword||'', src, body.query||'mega.nz/folder', Date.now(), true);
    return { ok:true, kind:'source', ...r };
  }
  if (body.kind === 'crawl') {
    const r = await crawlPage(env, body);
    return { ok:true, kind:'crawl', ...r };
  }
  if (body.kind === 'health') {
    const r = await healthOne(env, body.url);
    return { ok:true, kind:'health', ...r };
  }
  return { ok:false, error:'unknown_kind' };
}

async function runSearch(env, mode, keyword, quick = false, opts = {}) {
  const runId = await startRun(env, mode, keyword||'');
  const started = Date.now();
  const allSources = await getSources(env, {offset: Number(opts.source_offset || 0) || 0});
  const maxSourceFetches = Math.min(Number(opts.max_sources || 0) || intEnv(env, 'MAX_SOURCE_FETCHES', DEFAULT_MAX_SOURCE_FETCHES, 8, HARD_MAX_SOURCE_FETCHES), HARD_MAX_SOURCE_FETCHES);
  const sourceOffset = Math.max(0, Number(opts.source_offset || 0) || 0) % Math.max(1, allSources.length);
  const rotatedSources = allSources;
  const queries = buildQueries(keyword, mode);
  const queryOffset = Math.max(0, Number(opts.query_offset || 0) || 0) % Math.max(1, queries.length);
  const rotatedQueries = queries.slice(queryOffset).concat(queries.slice(0, queryOffset));
  let sourceFetches = 0, direct = 0, queued = 0;
  const selected = [];
  // Balanced rotation: each button press covers a new slice instead of repeating the same first sources.
  for (const src of rotatedSources) {
    const query = rotatedQueries[selected.length % rotatedQueries.length];
    selected.push([src, query]);
    if (selected.length >= maxSourceFetches) break;
  }
  const concurrency = Math.min(4, selected.length || 1);
  let cursor = 0;
  async function worker() {
    while (cursor < selected.length && Date.now() - started < REQUEST_BUDGET_MS) {
      const [src, query] = selected[cursor++];
      sourceFetches++;
      const r = await processSourceFetch(env, runId, mode, keyword||'', src, query, started, false);
      direct += r.direct || 0;
      queued += r.queued || 0;
    }
  }
  await Promise.all(Array.from({length:concurrency}, worker));
  const rounds = quick ? 3 : Math.min(Number(opts.deep_rounds || 0) || 8, 18);
  const processed = await deepProcessQueue(env, runId, rounds, quick ? 5 : MAX_QUEUE_BATCH, started);
  const health = {checked:0, alive:0, dead:0, unknown:0, skipped:'health checks moved out of search hot path'};
  await finishRun(env, runId);
  const results = await getResults(env, mode, keyword, 1000);
  const next_source_offset = (sourceOffset + sourceFetches) % Math.max(1, allSources.length);
  const next_query_offset = (queryOffset + 1) % Math.max(1, queries.length);
  return { ok:true, version:VERSION, run_id:runId, mode, keyword:keyword||'', source_fetches:sourceFetches, source_offset:sourceOffset, next_source_offset, next_query_offset, direct_links:direct, queued, processed, health, elapsed_ms:Date.now()-started, catalog_sources:allSources.length, auto_batch:true, results:results.results, stats: await dashboardStats(env) };
}
async function crawlPage(env, item) {
  if (!item.force && await recentlyVisited(env,item.url)) return {found:0,children:0,skipped:'recently_visited'};
  const got = await cachedFetch(env, item.url, item.source);
  let found = 0, children = 0;
  const links = extractMegaLinks(got.text);
  for (const link of links) {
    if (await saveLink(env, { run_id:item.run_id, mode:item.mode, keyword:item.keyword||'', link, source:hostOf(item.url)||item.source, page_url:item.url, title:item.keyword||'', snippet:snippetFrom(got.text) })) found++;
  }
  await q(env, `INSERT OR IGNORE INTO ${T.pages}(id,run_id,mode,source,url,title,status,depth,links_found,scanned_at,error) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
    ['pg_'+hash((item.run_id||'')+item.url), item.run_id||'', item.mode||'', hostOf(item.url)||item.source, item.url, item.keyword||'', got.status||0, 1, found, nowIso(), got.error||'']);
  await recordVisited(env,item.url,item.source,got.status||0,found,got.text);
  const discovered = (got.blocked ? [] : parseSearchTargets(got.text, {name:item.source||hostOf(item.url)}, got.finalUrl||item.url))
    .filter(u => !/\.(?:jpg|jpeg|png|gif|webp|css|ico|svg|woff2?)(?:$|[?#])/i.test(u))
    .slice(0, 4);
  if (discovered.length) {
    const childTasks = discovered.map(u => ({
      run_id:item.run_id, mode:item.mode, kind:'crawl', url:u,
      keyword:item.keyword||'', source:hostOf(u)||hostOf(item.url)||item.source,
      priority:Math.max(10,(item.priority||50)-12), max_attempts:2
    }));
    const queued = await enqueueManyCloud(env, childTasks);
    children += Number(queued.enqueued||0);
  }
  return { found, children, status:got.status||0 };
}
async function recoverExpiredLeases(env) {
  await q(env, `UPDATE ${T.queue} SET status='pending', lease_id=NULL, lease_until=NULL, worker_id=NULL, available_at=?, updated_at=?, error=CASE WHEN error='' THEN 'lease_expired' ELSE error END WHERE status='running' AND lease_until IS NOT NULL AND lease_until<?`, [nowIso(),nowIso(),nowIso()]);
}
async function claimQueueItems(env, runId='', limit=MAX_QUEUE_BATCH) {
  await recoverExpiredLeases(env);
  const candidates = await all(env, `SELECT id FROM ${T.queue} WHERE status='pending' AND available_at<=? ${runId?'AND run_id=?':''} ORDER BY priority DESC, created_at ASC LIMIT ?`, runId?[nowIso(),runId,limit*3]:[nowIso(),limit*3]);
  const workerId=uid('worker'), leaseUntil=new Date(Date.now()+90000).toISOString(), claimed=[];
  for (const row of (candidates.results||[])) {
    if (claimed.length>=limit) break;
    const lease=uid('lease');
    const r=await q(env, `UPDATE ${T.queue} SET status='running', attempts=attempts+1, lease_id=?, lease_until=?, worker_id=?, updated_at=? WHERE id=? AND status='pending' AND available_at<=?`, [lease,leaseUntil,workerId,nowIso(),row.id,nowIso()]);
    if (Number(r?.meta?.changes||0)===1) { const item=await first(env,`SELECT * FROM ${T.queue} WHERE id=?`,[row.id]); if(item) claimed.push(item); }
  }
  return claimed;
}
async function processQueue(env, runId = '', limit = MAX_QUEUE_BATCH) {
  await ensureDb(env);
  limit=Math.max(1,Math.min(Number(limit)||MAX_QUEUE_BATCH,50));
  if(runId){const state=await first(env,`SELECT status FROM ${T.runs} WHERE id=?`,[runId]);if(!state)return {processed:0,found:0,failed:0,claimed:0,error:'run_not_found'};if(state.status==='paused')return {processed:0,found:0,failed:0,claimed:0,paused:true};if(['done','cancelled'].includes(state.status))return {processed:0,found:0,failed:0,claimed:0,status:state.status};}
  const rows=await claimQueueItems(env,runId,limit);
  let processed=0, found=0, failed=0;
  for (const item of rows) {
    try {
      let r={found:0};
      if(item.kind==='source') { const src={name:item.source||hostOf(item.url)||'source',template:item.url,priority:item.priority||50}; r=await processSourceFetch(env,item.run_id||'',item.mode||'autoscan',item.keyword||'mega.nz/folder',src,item.keyword||'mega.nz/folder',Date.now(),false); r.found=r.direct||0; }
      else if(item.kind==='crawl') r=await crawlPage(env,item);
      else if(item.kind==='health') r=await healthOne(env,item.url);
      else throw new Error('unknown_queue_kind:'+item.kind);
      found+=r.found||0;
      await q(env, `UPDATE ${T.queue} SET status='done', lease_id=NULL, lease_until=NULL, worker_id=NULL, updated_at=?, error='' WHERE id=? AND lease_id=?`, [nowIso(),item.id,item.lease_id]);
      if(item.kind==='source') await q(env,`UPDATE ${T.runTasks} SET status='done',updated_at=? WHERE run_id=? AND source_name=? AND query=?`,[nowIso(),item.run_id,item.source,item.keyword]);
      processed++;
    } catch(e) {
      failed++; const attempts=Number(item.attempts||1); const terminal=attempts>=Number(item.max_attempts||3); const status=terminal?'dead_letter':'pending';
      const next=new Date(Date.now()+Math.min(900000,15000*Math.pow(2,Math.max(0,attempts-1)))).toISOString();
      await q(env, `UPDATE ${T.queue} SET status=?, available_at=?, lease_id=NULL, lease_until=NULL, worker_id=NULL, updated_at=?, error=? WHERE id=? AND lease_id=?`, [status,next,nowIso(),clamp(String(e.message||e),400),item.id,item.lease_id]);
      if(terminal&&item.kind==='source') await q(env,`UPDATE ${T.runTasks} SET status='failed',updated_at=? WHERE run_id=? AND source_name=? AND query=?`,[nowIso(),item.run_id,item.source,item.keyword]);
    }
  }
  if(runId) await q(env,`UPDATE ${T.runs} SET last_heartbeat=?, current_stage=? WHERE id=?`,[nowIso(),rows.length?'crawl':'idle',runId]);
  const progress=runId?await updateRunProgress(env,runId):null;
  return {processed,found,failed,claimed:rows.length,progress};
}

async function queueCount(env, runId='') {
  const r = await first(env, `SELECT COUNT(*) c FROM ${T.queue} WHERE status='pending' ${runId?'AND run_id=?':''}`, runId?[runId]:[]);
  return r?.c || 0;
}
async function queueOutstanding(env, runId='') {
  const r = await first(env, `SELECT COUNT(*) c FROM ${T.queue} WHERE status IN ('pending','running','leased','retry_wait') ${runId?'AND run_id=?':''}`, runId?[runId]:[]);
  return Number(r?.c || 0);
}
async function orchestrateRun(env, runId, opts={}) {
  if (!runId) return {ok:false,error:'missing_run_id'};
  const run = await first(env, `SELECT * FROM ${T.runs} WHERE id=?`, [runId]);
  if (!run) return {ok:false,error:'run_not_found'};
  if (run.status==='paused' || run.status==='done' || run.status==='cancelled') return {ok:true,status:run.status,seeded:null};
  await recoverExpiredLeases(env);
  let outstanding = await queueOutstanding(env, runId);
  let seeded = null;
  const threshold = Math.max(1, Number(opts.threshold || 4));
  if (!Number(run.sources_exhausted||0) && outstanding <= threshold) {
    seeded = await seedQueueSlice(env, runId, run.mode, run.keyword||'', {max_sources:Number(opts.seed_limit||SCHEDULE_SEED_LIMIT)||SCHEDULE_SEED_LIMIT});
    outstanding = await queueOutstanding(env, runId);
  }
  const progress = await updateRunProgress(env, runId);
  return {ok:true,status:progress?.status||run.status,outstanding,seeded,progress};
}
async function deepProcessQueue(env, runId='', rounds=MAX_DEEP_ROUNDS, batch=MAX_QUEUE_BATCH, startedAt=Date.now()) {
  let totalProcessed=0, totalFound=0, totalFailed=0, loops=0;
  for (let i=0; i<rounds; i++) {
    if (Date.now() - startedAt > REQUEST_BUDGET_MS) break;
    const pending = await queueCount(env, runId);
    if (!pending) break;
    const out = await processQueue(env, runId, batch);
    loops++;
    totalProcessed += out.processed || 0;
    totalFound += out.found || 0;
    totalFailed += out.failed || 0;
    if (!out.processed && !out.failed) break;
  }
  return { rounds:loops, processed:totalProcessed, found:totalFound, failed:totalFailed, pending:await queueCount(env, runId) };
}
async function healthOne(env, link) {
  const norm = normalizeLink(link);
  if (!norm) return { health:'unknown' };
  const existing = await first(env, `SELECT health,health_checked_at FROM ${T.links} WHERE normalized=? ORDER BY first_seen_at DESC LIMIT 1`, [norm]);
  if (existing?.health_checked_at && Date.now() - new Date(existing.health_checked_at).getTime() < HEALTH_TTL_MS) return { health: existing.health };
  let health = 'unknown';
  let reason = '';
  const api = await megaApiFolderCheck(norm);
  health = api.health || 'unknown';
  reason = api.reason || '';
  // Do not fetch MEGA HTML as the primary validator. It is slow and often returns generic HTML.
  // Only fall back to HEAD when the API cannot decide.
  if (health === 'unknown') {
    try {
      const res = await fetchWithTimeout(norm, { method:'HEAD', redirect:'follow' }, 7000);
      if (res.status >= 200 && res.status < 400) health = 'unknown';
      else if ([404,410].includes(res.status)) health = 'dead';
      else health = 'unknown';
      reason = 'head_' + res.status;
    } catch { health = 'unknown'; }
  }
  await q(env, `UPDATE ${T.links} SET health=?, health_checked_at=? WHERE normalized=?`, [health, nowIso(), norm]);
  return { health, reason };
}
async function checkBatch(env, runId='', limit=20) {
  await ensureDb(env);
  const rows = await all(env, `SELECT normalized FROM ${T.links} WHERE (health_checked_at IS NULL OR health_checked_at='') ${runId?'AND run_id=?':''} ORDER BY score DESC LIMIT ?`, runId ? [runId, limit] : [limit]);
  let alive=0, dead=0, unknown=0;
  await Promise.all((rows.results||[]).map(async r => {
    const h = (await healthOne(env, r.normalized)).health;
    if (h==='alive'||h==='valid') alive++; else if (h==='dead') dead++; else unknown++;
  }));
  return { checked:(rows.results||[]).length, alive, dead, unknown };
}
async function extractFromUrl(env, url, mode='url', keyword='') {
  await ensureDb(env);
  const runId = await startRun(env, mode, keyword||url);
  // If the user pasted a MEGA URL, do not fetch mega.nz. Save it directly.
  // Fetching MEGA pages from the Worker can exceed Cloudflare limits and returns HTML error pages.
  const pastedLinks = extractMegaLinks(url);
  if (pastedLinks.length) {
    let saved = 0;
    for (const link of pastedLinks) if (await saveLink(env, {run_id:runId, mode, keyword, link, source:'Manual Paste', page_url:link, title:'Manual MEGA link', snippet:'direct pasted mega link'})) saved++;
    await finishRun(env, runId);
    return { ok:true, version:VERSION, run_id:runId, url, found:saved, links:pastedLinks, direct_paste:true, results:(await getResults(env, mode, keyword, 1000)).results };
  }
  const got = await cachedFetch(env, url, 'Manual URL');
  const links = extractMegaLinks(got.text);
  let saved = 0;
  for (const link of links) if (await saveLink(env, {run_id:runId, mode, keyword, link, source:'Manual URL', page_url:url, title:url, snippet:snippetFrom(got.text)})) saved++;
  await q(env, `INSERT OR IGNORE INTO ${T.pages}(id,run_id,mode,source,url,title,status,depth,links_found,scanned_at,error) VALUES(?,?,?,?,?,?,?,?,?,?,?)`, ['pg_'+hash(runId+url),runId,mode,'Manual URL',url,url,got.status||0,0,saved,nowIso(),got.error||'']);
  await finishRun(env, runId);
  return { ok:true, version:VERSION, run_id:runId, url, found:saved, links, results:(await getResults(env, mode, keyword, 1000)).results };
}
async function getResults(env, mode='', keyword='', limit=100) {
  await ensureDb(env);
  const params=[]; let where="1=1 AND (normalized LIKE '%/folder/%#%' OR normalized LIKE '%mega.co.nz/#F!%')";
  if (mode) { where += ' AND mode=?'; params.push(mode); }
  if (keyword) { where += ' AND keyword=?'; params.push(keyword); }
  params.push(limit);
  const r = await all(env, `SELECT * FROM ${T.links} WHERE ${where} ORDER BY score DESC, last_seen_at DESC LIMIT ?`, params);
  return { ok:true, version:VERSION, results:r.results||[] };
}
async function getArchive(env, limit=2000) {
  await ensureDb(env);
  limit = Math.min(Math.max(Number(limit)||2000, 1), 5000);
  const r = await all(env, `SELECT 'archive' mode, keyword, type, health, score, source, page_url, link, normalized, first_seen_at, last_seen_at, seen_count, snippet FROM ${T.archive} ORDER BY last_seen_at DESC, score DESC LIMIT ?`, [limit]);
  return { ok:true, version:VERSION, results:r.results||[] };
}
async function dashboardStats(env) {
  await ensureDb(env);
  const archive = await runIgnore(first(env, `SELECT COUNT(*) total FROM ${T.archive}`));
  const links = await first(env, `SELECT COUNT(*) total, SUM(CASE WHEN health IN ('alive','valid') THEN 1 ELSE 0 END) alive, SUM(CASE WHEN health='dead' THEN 1 ELSE 0 END) dead, SUM(CASE WHEN health NOT IN ('alive','valid','dead') THEN 1 ELSE 0 END) unknown FROM ${T.links}`);
  const pages = await first(env, `SELECT COUNT(*) total FROM ${T.pages}`);
  const runs = await first(env, `SELECT COUNT(*) total FROM ${T.runs}`);
  const queue = await first(env, `SELECT SUM(CASE WHEN status IN ('pending','running','leased','retry_wait') THEN 1 ELSE 0 END) pending, SUM(CASE WHEN status='running' THEN 1 ELSE 0 END) running, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) done, SUM(CASE WHEN status IN ('failed','dead_letter') THEN 1 ELSE 0 END) failed FROM ${T.queue}`);
  const cache = await first(env, `SELECT COUNT(*) total, SUM(hits) hits FROM ${T.cache}`);
  const allSrc = await getSources(env, {include_disabled:true});
  const sourcesTotal = allSrc.length;
  const sourcesEnabled = allSrc.filter(s=>Number(s.enabled)===1).length;
  const valid = Number(links?.alive || 0);
  const target = Math.max(1, Number(env.SUCCESS_TARGET_LINKS || SUCCESS_TARGET_LINKS || 100));
  const success = Math.min(100, Math.floor((valid / target) * 100));
  return { archive_total:archive?.total||0, links_total:links?.total||0, alive:links?.alive||0, dead:links?.dead||0, unknown:links?.unknown||0, pages_scanned:pages?.total||0, runs:runs?.total||0, queue_pending:queue?.pending||0, queue_running:queue?.running||0, queue_done:queue?.done||0, queue_failed:queue?.failed||0, cache_entries:cache?.total||0, cache_hits:cache?.hits||0, sources_total:sourcesTotal, sources_enabled:sourcesEnabled, sources_disabled:Math.max(0,sourcesTotal-sourcesEnabled), success_target:target, success_rate:success };
}
async function diagnostics(env) {
  await ensureDb(env);
  const tables = {};
  for (const [k,t] of Object.entries(T)) {
    const c = await first(env, `SELECT COUNT(*) c FROM ${t}`);
    tables[t] = c?.c ?? 0;
  }
  return { ok:true, version:VERSION, db_bound:!!env.DB, tables, stats:await dashboardStats(env), features:['single_persistent_run','server_queue_orchestration','cron_resume_fallback','pause_resume','monotonic_scan_progress','global_url_dedup','source_fetch_dedup','atomic_queue_claim','queue_leases','dead_letter','source_metrics','response_classifier','schema_migrations','run_heartbeat','folder_only_mode','valid_key_required','reddit_json_comments','github_comments_optional','raw_paste_targets','redirect_decoders','archive_csv_json','source_on_off','evidence_ranked_sources'] };
}

async function startResilientJob(env, mode='autoscan', keyword='', opts={}) {
  // Hotfix 3: create the D1 shadow queue and immediately drain a small first batch.
  // This proves the pipeline is active and avoids the previous state where runs increased but pages stayed 0.
  const started = Date.now();
  const scheduled = await scheduleQueueRun(env, mode, keyword||'', opts||{});
  const firstLimit = Math.min(Number(opts.initial_limit||6)||6, 8);
  const first = await processQueue(env, scheduled.run_id||'', firstLimit);
  return { ...scheduled, first_processed:first, pending:await queueCount(env, scheduled.run_id||''), elapsed_ms:Date.now()-started, stats:await dashboardStats(env), results:(await getResults(env, mode, keyword||'', 1000)).results };
}
async function tickResilientJob(env, runId, mode='autoscan', keyword='', opts={}) {
  const started=Date.now();
  const run=await first(env,`SELECT * FROM ${T.runs} WHERE id=?`,[runId]);
  if(!run) return {ok:false,error:'run_not_found'};
  if(run.status==='paused') return {ok:true,version:VERSION,run_id:runId,paused:true,snapshot:await runSnapshot(env,runId)};
  if(['done','cancelled'].includes(run.status)) return {ok:true,version:VERSION,run_id:runId,status:run.status,snapshot:await runSnapshot(env,runId)};
  const limit=Math.min(Number(opts.limit||10)||10,14);
  let processed={processed:0,found:0,failed:0,mode:'cloud_queue'};
  if(!(env.AUTOSCAN_QUEUE||env.QUEUE)) processed=await processQueue(env,runId,limit);
  const orchestration=await orchestrateRun(env,runId,{seed_limit:Number(opts.seed_limit||SCHEDULE_SEED_LIMIT)||SCHEDULE_SEED_LIMIT,threshold:6});
  const pending=await queueOutstanding(env,runId);
  return {ok:true,version:VERSION,run_id:runId,mode:run.mode,keyword:run.keyword||'',elapsed_ms:Date.now()-started,pending,processed,seeded:orchestration.seeded,progress:orchestration.progress,stats:await dashboardStats(env)};
}

function csvEscape(s) { s=String(s??''); return '"'+s.replace(/"/g,'""')+'"'; }
async function exportData(env, fmt='json', mode='') {
  await ensureDb(env);
  let rows;
  if (!mode || mode === 'archive') rows = (await getArchive(env, 5000)).results;
  else rows = (await getResults(env, mode, '', 5000)).results;
  if (fmt === 'csv') {
    const header = ['section','mode','keyword','type','health','score','source','source_page','mega_folder','first_seen_at','last_seen_at','seen_count','snippet'];
    const lines = [header.join(',')];
    for (const x of rows) {
      const rec = {
        section: mode || 'archive',
        mode: x.mode || mode || 'archive',
        keyword: x.keyword || '',
        type: x.type || 'folder',
        health: x.health || '',
        score: x.score || 0,
        source: x.source || '',
        source_page: x.page_url || '',
        mega_folder: x.link || x.normalized || '',
        first_seen_at: x.first_seen_at || '',
        last_seen_at: x.last_seen_at || '',
        seen_count: x.seen_count || 1,
        snippet: x.snippet || ''
      };
      lines.push(header.map(h => csvEscape(rec[h])).join(','));
    }
    return text(lines.join('\n'), 'text/csv; charset=utf-8');
  }
  return json({ok:true, version:VERSION, mode:mode||'archive', results:rows});
}

async function handleApi(req, env, ctx) {
  const url = new URL(req.url);
  if (req.method === 'OPTIONS') return json({ok:true});
  if (!(await requireAuth(req, env))) return json({ok:false, version:VERSION, error:'unauthorized'}, 401);
  const path = url.pathname;
  try {
    if (path === '/api/ping') return json({ ok:true, version:VERSION, time:nowIso(), db_bound:!!env.DB });
    if (path === '/api/login') { const b = await parseBody(req); const pin = await getPin(env); if (String(b.pin||'') === pin) return json({ok:true, version:VERSION, token:tokenFor(pin)}); return json({ok:false, version:VERSION, error:'invalid_pin'}, 403); }
    if (path === '/api/db/repair') { await ensureDb(env); return json(await diagnostics(env)); }
    if (path === '/api/db/reset') { await hardReset(env); return json({ok:true, version:VERSION, reset:true, diagnostics:await diagnostics(env)}); }
    if (path === '/api/db/clean') { await cleanData(env); return json({ok:true, version:VERSION, cleaned:true}); }
    if (path === '/api/db/clean-invalid') { const out = await cleanInvalidLinks(env); return json({ok:true, version:VERSION, ...out}); }
    if (path === '/api/diagnostics') return json(await diagnostics(env));
    if (path === '/api/runs/start') { const b=await parseBody(req); const out=await scheduleQueueRun(env,b.mode||'autoscan',b.keyword||'',b); if(!(env.AUTOSCAN_QUEUE||env.QUEUE)&&ctx?.waitUntil) ctx.waitUntil(tickResilientJob(env,out.run_id,b.mode||'autoscan',b.keyword||'',{limit:12,seed_limit:12})); return json(out); }
    if (path === '/api/runs/resume') { const b=await parseBody(req); return json(await resumeRun(env,b.run_id||'',b)); }
    if (path === '/api/runs/snapshot') return json(await runSnapshot(env,url.searchParams.get('run_id')||''));
    if (path === '/api/runs/pause') { const b=await parseBody(req); await q(env,`UPDATE ${T.runs} SET status='paused',stop_reason='user_paused',last_heartbeat=? WHERE id=?`,[nowIso(),b.run_id]); return json(await runSnapshot(env,b.run_id)); }
    if (path === '/api/runs/tick') { const b=await parseBody(req); const out=await tickResilientJob(env,b.run_id||'',b.mode||'autoscan',b.keyword||'',b); return json({...out,snapshot:await runSnapshot(env,b.run_id||'')}); }
    if (path === '/api/autoscan') { const b = await parseBody(req); const out = ((env.AUTOSCAN_QUEUE || env.QUEUE) || b.queue) ? await scheduleQueueRun(env, 'autoscan', b.keyword||'', b) : await runSearch(env, 'autoscan', b.keyword||'', false, b); return json(out); }
    if (path === '/api/search') { const b = await parseBody(req); if (!String(b.keyword||'').trim()) return json({ok:false, error:'keyword_required'}, 400); const out = ((env.AUTOSCAN_QUEUE || env.QUEUE) || b.queue) ? await scheduleQueueRun(env, 'search', String(b.keyword||'').trim(), b) : await runSearch(env, 'search', String(b.keyword||'').trim(), false, b); return json(out); }
    if (path === '/api/extract') { const b = await parseBody(req); if (!b.url) return json({ok:false,error:'url_required'},400); return json(await extractFromUrl(env, b.url, b.mode||'url', b.keyword||'')); }
    if (path === '/api/queue/process') { const b = await parseBody(req); const out = await processQueue(env, b.run_id||'', Number(b.limit||MAX_QUEUE_BATCH)); return json({ok:true, version:VERSION, ...out, stats:await dashboardStats(env)}); }
    if (path === '/api/queue/deep') { const b = await parseBody(req); const out = await deepProcessQueue(env, b.run_id||'', Number(b.rounds||100), Number(b.limit||MAX_QUEUE_BATCH)); return json({ok:true, version:VERSION, ...out, stats:await dashboardStats(env), results:(await getResults(env,b.mode||'',b.keyword||'',1000)).results}); }
    if (path === '/api/health/check') { const b = await parseBody(req); const out = await checkBatch(env, b.run_id||'', Number(b.limit||20)); return json({ok:true, version:VERSION, ...out, stats:await dashboardStats(env)}); }
    if (path === '/api/results') return json(await getResults(env, url.searchParams.get('mode')||'', url.searchParams.get('keyword')||'', Number(url.searchParams.get('limit')||1000)));
    if (path === '/api/archive') return json(await getArchive(env, Number(url.searchParams.get('limit')||2000)));
    if (path === '/api/status') return json(await diagnostics(env));
    if (path === '/api/stats') return json({ok:true, version:VERSION, stats:await dashboardStats(env)});
    if (path === '/api/source-metrics') { await ensureDb(env); const r=await all(env,`SELECT *, CASE WHEN requests>0 THEN ROUND(valid_links*100.0/requests,2) ELSE 0 END yield_per_100, CASE WHEN requests>0 THEN ROUND(total_response_ms*1.0/requests,0) ELSE 0 END avg_response_ms FROM ${T.sourceMetrics} ORDER BY valid_links DESC, successes DESC, requests DESC LIMIT 2000`); return json({ok:true,version:VERSION,metrics:r.results||[]}); }
    if (path === '/api/sources') {
      await ensureDb(env);
      if (req.method==='GET') { const rows = await getSources(env,{include_disabled:true, skip_policy:false}); return json({ok:true, version:VERSION, total:rows.length, enabled:rows.filter(s=>Number(s.enabled)===1).length, disabled:rows.filter(s=>Number(s.enabled)!==1).length, groups:[...new Set(rows.map(s=>s.category||'web'))].length, sources: rows}); }
      const b=await parseBody(req);
      if (b.action === 'toggle') return json(await setSourceEnabled(env, b.id, !!b.enabled, b.priority));
      if (['enable_all','disable_all','high_yield'].includes(b.action)) return json(await applySourcePreset(env, b.action));
      if (!b.name || !b.template) return json({ok:false,error:'name_and_template_required'},400);
      await q(env,`INSERT OR REPLACE INTO ${T.sources}(id,name,type,enabled,priority,template,config,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`,[b.id||uid('src'),b.name,b.type||'html',b.enabled?1:0,b.priority||50,b.template,JSON.stringify(b.config||{}),nowIso(),nowIso()]); return json({ok:true});
    }
    if (path === '/api/export') return exportData(env, url.searchParams.get('format')||'json', url.searchParams.get('mode')||'');
    return json({ok:false, version:VERSION, error:'not_found'},404);
  } catch(e) {
    await logEvent(env, 'error', 'api_exception', { path, error:String(e.message||e), stack:e.stack });
    return json({ok:false, version:VERSION, error:String(e.message||e), stack:e.stack}, 500);
  }
}
async function handleReset(req, env) { await hardReset(env); return json({ok:true, version:VERSION, message:'D1 hard reset complete', next:'/' }); }
async function scheduled(event, env, ctx) {
  ctx.waitUntil((async()=>{
    await ensureDb(env);
    const active=await first(env,`SELECT id,mode,keyword,status,sources_exhausted FROM ${T.runs} WHERE status='running' ORDER BY started_at DESC LIMIT 1`);
    if(active){
      // Safety-drain a tiny D1 batch, then immediately seed the next source slice when the run is low on work.
      await processQueue(env,active.id,3);
      await orchestrateRun(env,active.id,{seed_limit:12,threshold:6});
      return;
    }
    await scheduleQueueRun(env,'autoscan','',{max_sources:12});
  })());
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) return handleApi(req, env, ctx);
    if (url.pathname === '/reset') return handleReset(req, env);
    return env.ASSETS ? env.ASSETS.fetch(req) : text('Nimbus Core V34 Resilient Orchestrator');
  },
  async queue(batch, env, ctx) {
    await ensureDb(env);
    const outcomes = [];
    for (const msg of batch.messages) {
      try {
        const b0=msg.body||{}; const rs=b0.run_id?await first(env,`SELECT status FROM ${T.runs} WHERE id=?`,[b0.run_id]):null; if(rs?.status==='paused'){msg.retry();continue;} if(rs&&['done','cancelled'].includes(rs.status)){msg.ack();continue;}
        const out = await handleQueueMessage(env, msg.body);
        outcomes.push(out);
        try { const b=msg.body||{}; const sourceName=typeof b.source==='string'?b.source:(b.source?.name||b.source_name||''); let qUrl=b.url||''; if(!qUrl&&b.kind==='source'&&b.source?.template) qUrl=sourceUrl(b.source,b.query||b.keyword||'mega.nz/folder'); const qKeyword=b.keyword||b.query||''; const qid=b.id||'q_'+hash([b.run_id||'',b.kind,qUrl,qKeyword,b.mode,sourceName].join('|')); await q(env,`UPDATE ${T.queue} SET status='done',updated_at=?,error='' WHERE id=?`,[nowIso(),qid]); if(b.kind==='source') await q(env,`UPDATE ${T.runTasks} SET status='done',updated_at=? WHERE run_id=? AND source_name=? AND query=?`,[nowIso(),b.run_id,sourceName,b.query||b.keyword||'']); } catch {}
        msg.ack();
      } catch (e) {
        outcomes.push({ ok:false, error:String(e.message||e).slice(0,300) });
        try{const b=msg.body||{};const qid=b.id||'';if(qid)await q(env,`UPDATE ${T.queue} SET attempts=attempts+1,status=CASE WHEN attempts+1>=max_attempts THEN 'dead_letter' ELSE 'pending' END,available_at=?,updated_at=?,error=? WHERE id=?`,[new Date(Date.now()+30000).toISOString(),nowIso(),clamp(String(e.message||e),400),qid]);}catch{}
        msg.retry();
      }
    }
    const runIds=[...new Set(batch.messages.map(m=>m.body?.run_id).filter(Boolean))];
    ctx.waitUntil(Promise.all([logEvent(env,'info','queue_batch_processed',{count:batch.messages.length,outcomes:outcomes.slice(0,5)}),...runIds.map(id=>orchestrateRun(env,id,{seed_limit:SCHEDULE_SEED_LIMIT,threshold:4}))]));
  },
  scheduled
};
