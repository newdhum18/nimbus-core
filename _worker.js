/* Nimbus Core V27 Source Boost
 * Fresh Cloudflare Pages Worker + D1 app.
 * Frontend and extraction are integrated; AutoScan and Keyword Search are separated by mode.
 */
const VERSION = '27-sourceboost.3-deep';
const T = {
  runs: 'nimbus_v27sb_runs',
  pages: 'nimbus_v27sb_pages',
  links: 'nimbus_v27sb_links',
  queue: 'nimbus_v27sb_queue',
  cache: 'nimbus_v27sb_cache',
  events: 'nimbus_v27sb_events',
  sources: 'nimbus_v27sb_sources',
  settings: 'nimbus_v27sb_settings'
};
const DEFAULT_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1 NimbusCore/27';
const TIMEOUT_MS = 11000;
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const HEALTH_TTL_MS = 1000 * 60 * 60 * 12;
const MAX_SOURCE_FETCHES = 48;
const MAX_CRAWL_PAGES = 120;
const MAX_QUEUE_BATCH = 40;
const MAX_DEEP_ROUNDS = 100;
const REQUEST_BUDGET_MS = 42000;
const MAX_TEXT = 350000;
const LINK_RE = /(^|[^A-Za-z0-9_.-])((?:https?:\/\/)?(?:www\.)?mega\.(?:nz|co\.nz|io)\/(?:file|folder)\/[A-Za-z0-9_-]+(?:#[A-Za-z0-9_!\-]+)?)/gi;
const OLD_LINK_RE = /(^|[^A-Za-z0-9_.-])((?:https?:\/\/)?(?:www\.)?mega\.(?:nz|co\.nz)\/#(?:F!|N!|!)?[A-Za-z0-9_-]+![A-Za-z0-9_!\-]+)/gi;
const MEGA_HOST_RE = /^https?:\/\/(?:www\.)?mega\.(?:nz|co\.nz|io)\//i;

const AUTOSCAN_PATTERNS = [
  'mega.nz/folder', 'mega.nz/file', 'mega.nz/#F!', 'mega.co.nz/#F!',
  '"mega.nz/folder"', '"mega.nz/file"', '"mega.nz" "folder"', '"mega.nz" "file"',
  '"mega.nz/folder" "index"', '"mega.nz/file" "key"',
  'site:pastebin.com mega.nz', 'site:rentry.co mega.nz', 'site:reddit.com mega.nz',
  'site:github.com mega.nz', 'site:gist.github.com mega.nz', 'site:archive.org mega.nz',
  'site:gitlab.com mega.nz', 'site:bitbucket.org mega.nz', 'site:linktr.ee mega.nz',
  'site:meawfy.com mega.nz', 'site:telegra.ph mega.nz', 'site:medium.com mega.nz',
  'site:substack.com mega.nz', 'site:notion.site mega.nz', 'site:paste.ee mega.nz',
  'site:justpaste.it mega.nz', 'site:controlc.com mega.nz', 'site:hastebin.com mega.nz',
  'site:anonpaste.org mega.nz', 'site:ghostbin.co mega.nz', 'site:txti.es mega.nz'
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
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function decodeLoose(s) {
  s = String(s || '');
  const variants = new Set([s]);
  const html = s.replace(/&amp;/g,'&').replace(/&#x2F;/gi,'/').replace(/\\\//g,'/').replace(/\u002F/gi,'/').replace(/%23/g,'#').replace(/%2F/gi,'/').replace(/%3A/gi,':');
  variants.add(html);
  try { variants.add(decodeURIComponent(html)); } catch {}
  try { variants.add(decodeURIComponent(decodeURIComponent(html))); } catch {}
  return [...variants].join('\\n');
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
    return u.href.replace(/&utm_[^#]+/g,'');
  } catch { return ''; }
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
  await ensureColumn(env, T.links, 'keyword_key', "TEXT NOT NULL DEFAULT ''");
  await runIgnore(q(env, `UPDATE ${T.links} SET keyword_key=COALESCE(keyword,'') WHERE keyword_key IS NULL OR keyword_key=''`));
  const idx = [
    `CREATE INDEX IF NOT EXISTS idx_${T.links}_run ON ${T.links}(run_id)`,
    `CREATE INDEX IF NOT EXISTS idx_${T.links}_mode ON ${T.links}(mode, first_seen_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_${T.links}_health ON ${T.links}(health)`,
    `CREATE INDEX IF NOT EXISTS idx_${T.queue}_status ON ${T.queue}(status, priority DESC, available_at)`,
    `CREATE INDEX IF NOT EXISTS idx_${T.pages}_run ON ${T.pages}(run_id)`,
    `CREATE INDEX IF NOT EXISTS idx_${T.cache}_expires ON ${T.cache}(expires_at)`
  ];
  for (const s of idx) await runIgnore(q(env, s));
  await seedSources(env);
}
async function seedSources(env) {
  const n = await first(env, `SELECT COUNT(*) c FROM ${T.sources}`);
  if (n && n.c > 0) return;
  const sources = [
    ['bing_rss','Bing RSS','rss',120,'https://www.bing.com/search?format=rss&q={q}'],
    ['bing_web','Bing Web','html',108,'https://www.bing.com/search?q={q}&count=50'],
    ['duckduckgo_html','DuckDuckGo HTML','html',110,'https://duckduckgo.com/html/?q={q}'],
    ['yahoo_search','Yahoo Search','html',95,'https://search.yahoo.com/search?p={q}&n=30'],
    ['brave_web','Brave Web','html',70,'https://search.brave.com/search?q={q}'],
    ['mojeek','Mojeek','html',70,'https://www.mojeek.com/search?q={q}'],
    ['reddit_search_json','Reddit Search JSON','json',105,'https://www.reddit.com/search.json?q={q}&limit=100&sort=new'],
    ['reddit_megalinks_json','Reddit Megalinks JSON','json',100,'https://www.reddit.com/r/megalinks/search.json?q={q}&restrict_sr=1&limit=100&sort=new'],
    ['reddit_all_comments_hint','Reddit Comments Hint','json',92,'https://www.reddit.com/search.json?q={q}%20url%3Amega.nz&limit=100&sort=new'],
    ['github_code','GitHub Code Web','html',92,'https://github.com/search?q={q}+mega.nz&type=code'],
    ['github_issues','GitHub Issues Web','html',82,'https://github.com/search?q={q}+mega.nz&type=issues'],
    ['github_repos','GitHub Repos Web','html',78,'https://github.com/search?q={q}+mega.nz&type=repositories'],
    ['gist_search','Gist Search','html',80,'https://gist.github.com/search?q={q}+mega.nz'],
    ['gitlab_search','GitLab Search','html',70,'https://gitlab.com/search?search={q}%20mega.nz'],
    ['bitbucket_search','Bitbucket Search','html',62,'https://bitbucket.org/repo/all?name={q}%20mega.nz'],
    ['archive_search','Archive Search','html',74,'https://archive.org/search?query={q}%20mega.nz'],
    ['pastebin_web','Pastebin Web','html',72,'https://pastebin.com/search?q={q}%20mega.nz'],
    ['rentry_web','Rentry Web','html',70,'https://rentry.co/search?q={q}%20mega.nz'],
    ['paste_ee','Paste.ee','html',58,'https://paste.ee/search?q={q}%20mega.nz'],
    ['justpaste','JustPaste','html',58,'https://justpaste.it/search?q={q}%20mega.nz'],
    ['controlc','ControlC','html',55,'https://controlc.com/search?q={q}%20mega.nz'],
    ['telegra','Telegraph','html',52,'https://telegra.ph/search?query={q}%20mega.nz'],
    ['ahmia','Ahmia Web','html',50,'https://ahmia.fi/search/?q={q}%20mega.nz'],
    ['meawfy_web','Meawfy Web','html',95,'https://meawfy.com/search?q={q}'],
    ['linktree_web','Linktree Web','html',45,'https://linktr.ee/search?q={q}%20mega.nz']
  ];  for (const s of sources) {
    await q(env, `INSERT OR IGNORE INTO ${T.sources}(id,name,type,enabled,priority,template,config,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`, [s[0],s[1],s[2],1,s[3],s[4],'{}',nowIso(),nowIso()]);
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
async function getPin(env) { return String(env.AUTH_PIN || env.NIMBUS_PIN || '0000'); }
function tokenFor(pin) { return 'nimbus_' + hash('pin:' + pin + ':v27'); }
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
  const base = String(keyword || '').trim();
  let patterns;
  if (mode === 'autoscan' && !base) patterns = AUTOSCAN_PATTERNS;
  else patterns = [
    base, `"${base}"`, `${base} mega.nz`, `"${base}" "mega.nz"`,
    `"${base}" "mega.nz/folder"`, `"${base}" "mega.nz/file"`,
    `site:reddit.com ${base} mega.nz`, `site:github.com ${base} mega.nz`, `site:gist.github.com ${base} mega.nz`,
    `site:pastebin.com ${base} mega.nz`, `site:rentry.co ${base} mega.nz`, `site:archive.org ${base} mega.nz`,
    `site:gitlab.com ${base} mega.nz`, `site:linktr.ee ${base} mega.nz`, `site:meawfy.com ${base} mega.nz`,
    `"mega.nz/folder" ${base}`, `"mega.nz/file" ${base}`, `"mega.co.nz/#F!" ${base}`
  ];
  return [...new Set(patterns.filter(Boolean))].slice(0, mode === 'autoscan' ? 32 : 24);
}
async function getSources(env) {
  const r = await all(env, `SELECT * FROM ${T.sources} WHERE enabled=1 ORDER BY priority DESC LIMIT 50`);
  return r.results || [];
}
function sourceUrl(source, query) { return source.template.replace('{q}', encodeURIComponent(query)); }
async function cachedFetch(env, url, sourceName) {
  const key = hash(url);
  const c = await first(env, `SELECT value,status,expires_at,hits FROM ${T.cache} WHERE key=?`, [key]);
  if (c && new Date(c.expires_at).getTime() > Date.now()) {
    await q(env, `UPDATE ${T.cache} SET hits=hits+1 WHERE key=?`, [key]);
    return { fromCache:true, status:c.status, text:c.value || '' };
  }
  try {
    const res = await fetchWithTimeout(url, {}, TIMEOUT_MS);
    const txt = await bodyText(res);
    await q(env, `INSERT OR REPLACE INTO ${T.cache}(key,value,status,created_at,expires_at,hits) VALUES(?,?,?,?,?,?)`, [key, txt, res.status, nowIso(), new Date(Date.now()+CACHE_TTL_MS).toISOString(), 0]);
    return { fromCache:false, status:res.status, text:txt };
  } catch (e) {
    await logEvent(env, 'warn', 'fetch_failed', { url, sourceName, error:String(e.message||e) });
    return { fromCache:false, status:0, text:'', error:String(e.message||e) };
  }
}
function addCandidateUrl(set, val, baseUrl) {
  if (!val) return;
  const decoded = decodeLoose(String(val));
  const candidates = decoded.split(/[\s"'<>]+/).slice(0, 500);
  for (let c of candidates) {
    c = c.trim().replace(/&amp;/g,'&').replace(/[\])},.;]+$/g,'');
    if (!c) continue;
    const redirect = c.match(/[?&](?:url|u|target|redirect|to|q)=([^&]+)/i);
    if (redirect) {
      try { c = decodeURIComponent(redirect[1]); } catch { c = redirect[1]; }
    }
    const u = safeUrl(c, baseUrl);
    if (!u || !/^https?:/i.test(u)) continue;
    const h = hostOf(u);
    if (!h) continue;
    if (/^(www\.)?(bing|duckduckgo|yahoo|google)\./i.test(h)) continue;
    set.add(u);
    if (set.size >= 120) break;
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
function parseSearchTargets(text, source, baseUrl) {
  const urls = new Set();
  const decoded = decodeLoose(text);
  for (const u of extractPageUrls(decoded, baseUrl)) addCandidateUrl(urls, u, baseUrl);
  // RSS link tags and atom links
  let m;
  const linkRe = /<link[^>]*>([\s\S]*?)<\/link>|<link[^>]+href=["']([^"']+)/gi;
  while ((m = linkRe.exec(decoded)) !== null && urls.size < 120) addCandidateUrl(urls, (m[1]||m[2]||'').replace(/<!\[CDATA\[|\]\]>/g,''), baseUrl);
  // JSON recursive extraction
  try { extractJsonUrls(JSON.parse(decoded), urls, baseUrl); } catch {}
  // Reddit comments JSON targets from permalinks
  for (const u of [...urls]) {
    if (/reddit\.com\/r\//i.test(u) && !/\.json(?:$|[?#])/i.test(u)) {
      try { urls.add(new URL(u).origin + new URL(u).pathname.replace(/\/$/,'') + '.json'); } catch {}
    }
  }
  return [...urls].slice(0, 120);
}
async function saveLink(env, data) {
  const norm = normalizeLink(data.link);
  if (!norm) return false;
  const type = /\/folder\//i.test(norm) ? 'folder' : 'file';
  const keywordKey = String(data.keyword||'');
  const id = 'ln_' + hash((data.mode||'') + '|' + keywordKey + '|' + norm);
  const score = scoreResult({link:norm, source:data.source, title:data.title, pageUrl:data.page_url, mode:data.mode});
  await q(env, `INSERT INTO ${T.links}(id,run_id,mode,keyword,keyword_key,link,normalized,type,source,page_url,title,snippet,score,health,first_seen_at,last_seen_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(mode, normalized, keyword_key) DO UPDATE SET last_seen_at=excluded.last_seen_at, score=max(score, excluded.score), source=excluded.source, page_url=excluded.page_url, title=COALESCE(excluded.title,title)`,
    [id, data.run_id||'', data.mode||'search', data.keyword||'', keywordKey, norm, norm, type, data.source||'', data.page_url||'', data.title||'', data.snippet||'', score, 'unknown', nowIso(), nowIso()]);
  return true;
}
async function enqueue(env, item) {
  const id = item.id || 'q_' + hash([item.kind,item.url,item.keyword,item.mode].join('|'));
  await q(env, `INSERT OR IGNORE INTO ${T.queue}(id,run_id,mode,kind,url,keyword,source,priority,status,attempts,max_attempts,available_at,created_at,updated_at,error) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, item.run_id||'', item.mode||'search', item.kind, item.url||'', item.keyword||'', item.source||'', item.priority||50, 'pending', 0, item.max_attempts||3, item.available_at||nowIso(), nowIso(), nowIso(), '']);
}
async function startRun(env, mode, keyword) {
  await ensureDb(env);
  const runId = uid('run');
  await q(env, `INSERT INTO ${T.runs}(id,mode,keyword,status,started_at,notes) VALUES(?,?,?,?,?,?)`, [runId, mode, keyword||'', 'running', nowIso(), '']);
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
  const l = await first(env, `SELECT COUNT(*) links, SUM(CASE WHEN health='alive' THEN 1 ELSE 0 END) alive, SUM(CASE WHEN health='dead' THEN 1 ELSE 0 END) dead, SUM(CASE WHEN health='unknown' THEN 1 ELSE 0 END) unknown FROM ${T.links} WHERE run_id=?`, [runId]);
  return { pages:p?.pages||0, sources:p?.sources||0, links:l?.links||0, alive:l?.alive||0, dead:l?.dead||0, unknown:l?.unknown||0 };
}
async function runSearch(env, mode, keyword, quick = false) {
  const runId = await startRun(env, mode, keyword||'');
  const started = Date.now();
  const sources = await getSources(env);
  const queries = buildQueries(keyword, mode);
  let sourceFetches = 0, direct = 0, queued = 0;
  const selected = [];
  for (const query of queries) {
    for (const src of sources) {
      selected.push([src, query]);
      if (selected.length >= MAX_SOURCE_FETCHES) break;
    }
    if (selected.length >= MAX_SOURCE_FETCHES) break;
  }
  await Promise.all(selected.map(async ([src, query]) => {
    sourceFetches++;
    const url = sourceUrl(src, query);
    const got = await cachedFetch(env, url, src.name);
    const links = extractMegaLinks(got.text);
    for (const link of links) {
      if (await saveLink(env, { run_id:runId, mode, keyword:keyword||'', link, source:src.name, page_url:url, title:query, snippet:'direct from source response' })) direct++;
    }
    await q(env, `INSERT OR IGNORE INTO ${T.pages}(id,run_id,mode,source,url,title,status,depth,links_found,scanned_at,error) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
      ['pg_'+hash(runId+url), runId, mode, src.name, url, query, got.status||0, 0, links.length, nowIso(), got.error||'']);
    const targets = parseSearchTargets(got.text, src, url).slice(0, mode === 'autoscan' ? 10 : 7);
    for (const t of targets) {
      await enqueue(env, { run_id:runId, mode, kind:'crawl', url:t, keyword:keyword||query, source:src.name, priority: src.priority || 50 });
      queued++;
    }
  }));
  const rounds = quick ? 8 : Number(env.DEEP_ROUNDS || 100);
  const processed = await deepProcessQueue(env, runId, Math.min(rounds, MAX_DEEP_ROUNDS), quick ? 16 : MAX_QUEUE_BATCH, started);
  const health = await checkBatch(env, runId, quick ? 10 : 60);
  await finishRun(env, runId);
  const results = await getResults(env, mode, keyword, 200);
  return { ok:true, version:VERSION, run_id:runId, mode, keyword:keyword||'', source_fetches:sourceFetches, direct_links:direct, queued, processed, health, elapsed_ms:Date.now()-started, results:results.results, stats: await dashboardStats(env) };
}
async function crawlPage(env, item) {
  const got = await cachedFetch(env, item.url, item.source);
  let found = 0, children = 0;
  const links = extractMegaLinks(got.text);
  for (const link of links) {
    if (await saveLink(env, { run_id:item.run_id, mode:item.mode, keyword:item.keyword||'', link, source:item.source||hostOf(item.url), page_url:item.url, title:item.keyword||'', snippet:snippetFrom(got.text) })) found++;
  }
  await q(env, `INSERT OR IGNORE INTO ${T.pages}(id,run_id,mode,source,url,title,status,depth,links_found,scanned_at,error) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
    ['pg_'+hash((item.run_id||'')+item.url), item.run_id||'', item.mode||'', item.source||hostOf(item.url), item.url, item.keyword||'', got.status||0, 1, found, nowIso(), got.error||'']);
  const discovered = parseSearchTargets(got.text, {name:item.source||hostOf(item.url)}, item.url)
    .filter(u => !/\.(?:jpg|jpeg|png|gif|webp|css|ico|svg|woff2?)(?:$|[?#])/i.test(u))
    .slice(0, 12);
  for (const u of discovered) {
    await enqueue(env, { run_id:item.run_id, mode:item.mode, kind:'crawl', url:u, keyword:item.keyword||'', source:item.source||hostOf(item.url), priority: Math.max(10,(item.priority||50)-10), max_attempts:2 });
    children++;
  }
  return { found, children, status:got.status||0 };
}
async function processQueue(env, runId = '', limit = MAX_QUEUE_BATCH) {
  await ensureDb(env);
  const rows = await all(env, `SELECT * FROM ${T.queue} WHERE status='pending' AND available_at<=? ${runId?'AND run_id=?':''} ORDER BY priority DESC, created_at ASC LIMIT ?`, runId ? [nowIso(), runId, limit] : [nowIso(), limit]);
  let processed=0, found=0, failed=0;
  for (const item of (rows.results||[])) {
    await q(env, `UPDATE ${T.queue} SET status='running', attempts=attempts+1, updated_at=? WHERE id=?`, [nowIso(), item.id]);
    try {
      let r = {found:0};
      if (item.kind === 'crawl') r = await crawlPage(env, item);
      else if (item.kind === 'health') r = await healthOne(env, item.url);
      found += r.found || 0;
      await q(env, `UPDATE ${T.queue} SET status='done', updated_at=?, error='' WHERE id=?`, [nowIso(), item.id]);
      processed++;
    } catch (e) {
      failed++;
      const attempts = (item.attempts||0)+1;
      const status = attempts >= (item.max_attempts||3) ? 'failed' : 'pending';
      const next = new Date(Date.now() + Math.min(300000, 15000 * attempts)).toISOString();
      await q(env, `UPDATE ${T.queue} SET status=?, attempts=?, available_at=?, updated_at=?, error=? WHERE id=?`, [status, attempts, next, nowIso(), String(e.message||e).slice(0,400), item.id]);
    }
  }
  return { processed, found, failed };
}

async function queueCount(env, runId='') {
  const r = await first(env, `SELECT COUNT(*) c FROM ${T.queue} WHERE status='pending' ${runId?'AND run_id=?':''}`, runId?[runId]:[]);
  return r?.c || 0;
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
  try {
    const res = await fetchWithTimeout(norm, { method:'HEAD', redirect:'follow' }, 8000);
    if (res.status >= 200 && res.status < 400) health = 'alive';
    else if ([404,410].includes(res.status)) health = 'dead';
    else health = 'unknown';
  } catch {
    try {
      const res = await fetchWithTimeout(norm, { method:'GET', redirect:'follow', headers:{ range:'bytes=0-0' } }, 8000);
      if (res.status >= 200 && res.status < 400) health = 'alive'; else if ([404,410].includes(res.status)) health='dead';
    } catch { health = 'unknown'; }
  }
  await q(env, `UPDATE ${T.links} SET health=?, health_checked_at=? WHERE normalized=?`, [health, nowIso(), norm]);
  return { health };
}
async function checkBatch(env, runId='', limit=20) {
  await ensureDb(env);
  const rows = await all(env, `SELECT normalized FROM ${T.links} WHERE (health_checked_at IS NULL OR health_checked_at='') ${runId?'AND run_id=?':''} ORDER BY score DESC LIMIT ?`, runId ? [runId, limit] : [limit]);
  let alive=0, dead=0, unknown=0;
  await Promise.all((rows.results||[]).map(async r => {
    const h = (await healthOne(env, r.normalized)).health;
    if (h==='alive') alive++; else if (h==='dead') dead++; else unknown++;
  }));
  return { checked:(rows.results||[]).length, alive, dead, unknown };
}
async function extractFromUrl(env, url, mode='url', keyword='') {
  await ensureDb(env);
  const runId = await startRun(env, mode, keyword||url);
  const got = await cachedFetch(env, url, 'Manual URL');
  const links = extractMegaLinks(got.text);
  let saved = 0;
  for (const link of links) if (await saveLink(env, {run_id:runId, mode, keyword, link, source:'Manual URL', page_url:url, title:url, snippet:snippetFrom(got.text)})) saved++;
  await q(env, `INSERT OR IGNORE INTO ${T.pages}(id,run_id,mode,source,url,title,status,depth,links_found,scanned_at,error) VALUES(?,?,?,?,?,?,?,?,?,?,?)`, ['pg_'+hash(runId+url),runId,mode,'Manual URL',url,url,got.status||0,0,saved,nowIso(),got.error||'']);
  await finishRun(env, runId);
  return { ok:true, version:VERSION, run_id:runId, url, found:saved, links, results:(await getResults(env, mode, keyword, 100)).results };
}
async function getResults(env, mode='', keyword='', limit=100) {
  await ensureDb(env);
  const params=[]; let where='1=1';
  if (mode) { where += ' AND mode=?'; params.push(mode); }
  if (keyword) { where += ' AND keyword=?'; params.push(keyword); }
  params.push(limit);
  const r = await all(env, `SELECT * FROM ${T.links} WHERE ${where} ORDER BY score DESC, last_seen_at DESC LIMIT ?`, params);
  return { ok:true, version:VERSION, results:r.results||[] };
}
async function dashboardStats(env) {
  await ensureDb(env);
  const links = await first(env, `SELECT COUNT(*) total, SUM(CASE WHEN health='alive' THEN 1 ELSE 0 END) alive, SUM(CASE WHEN health='dead' THEN 1 ELSE 0 END) dead, SUM(CASE WHEN health='unknown' THEN 1 ELSE 0 END) unknown FROM ${T.links}`);
  const pages = await first(env, `SELECT COUNT(*) total FROM ${T.pages}`);
  const runs = await first(env, `SELECT COUNT(*) total FROM ${T.runs}`);
  const queue = await first(env, `SELECT SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) pending, SUM(CASE WHEN status='running' THEN 1 ELSE 0 END) running, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) done, SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) failed FROM ${T.queue}`);
  const cache = await first(env, `SELECT COUNT(*) total, SUM(hits) hits FROM ${T.cache}`);
  const sources = await first(env, `SELECT COUNT(*) total, SUM(CASE WHEN enabled=1 THEN 1 ELSE 0 END) enabled FROM ${T.sources}`);
  const success = links?.total ? Math.round(((links.alive||0) / links.total) * 100) : 0;
  return { links_total:links?.total||0, alive:links?.alive||0, dead:links?.dead||0, unknown:links?.unknown||0, pages_scanned:pages?.total||0, runs:runs?.total||0, queue_pending:queue?.pending||0, queue_running:queue?.running||0, queue_done:queue?.done||0, queue_failed:queue?.failed||0, cache_entries:cache?.total||0, cache_hits:cache?.hits||0, sources_total:sources?.total||0, sources_enabled:sources?.enabled||0, success_rate:success };
}
async function diagnostics(env) {
  await ensureDb(env);
  const tables = {};
  for (const [k,t] of Object.entries(T)) {
    const c = await first(env, `SELECT COUNT(*) c FROM ${t}`);
    tables[t] = c?.c ?? 0;
  }
  return { ok:true, version:VERSION, db_bound:!!env.DB, tables, stats:await dashboardStats(env), features:['separate_autoscan_page','separate_keyword_search_page','integrated_extractor','multi_source','json_html_rss_sources','crawler','queue','cache','health','dashboard','csv_json_export','db_repair','deep_100_round_processing','encoded_url_extraction','old_mega_format_extraction','reddit_json_targets','more_sources'] };
}
function csvEscape(s) { s=String(s??''); return '"'+s.replace(/"/g,'""')+'"'; }
async function exportData(env, fmt='json', mode='') {
  const r = await getResults(env, mode, '', 1000);
  if (fmt === 'csv') {
    const header = ['mode','keyword','type','health','score','source','page_url','link','first_seen_at'];
    const rows = [header.join(',')].concat(r.results.map(x => header.map(h => csvEscape(x[h])).join(',')));
    return text(rows.join('\n'), 'text/csv; charset=utf-8');
  }
  return json(r);
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
    if (path === '/api/diagnostics') return json(await diagnostics(env));
    if (path === '/api/autoscan') { const b = await parseBody(req); const out = await runSearch(env, 'autoscan', b.keyword||'', false); return json(out); }
    if (path === '/api/search') { const b = await parseBody(req); if (!String(b.keyword||'').trim()) return json({ok:false, error:'keyword_required'}, 400); const out = await runSearch(env, 'search', String(b.keyword||'').trim(), false); return json(out); }
    if (path === '/api/extract') { const b = await parseBody(req); if (!b.url) return json({ok:false,error:'url_required'},400); return json(await extractFromUrl(env, b.url, b.mode||'url', b.keyword||'')); }
    if (path === '/api/queue/process') { const b = await parseBody(req); const out = await processQueue(env, b.run_id||'', Number(b.limit||MAX_QUEUE_BATCH)); return json({ok:true, version:VERSION, ...out, stats:await dashboardStats(env)}); }
    if (path === '/api/queue/deep') { const b = await parseBody(req); const out = await deepProcessQueue(env, b.run_id||'', Number(b.rounds||100), Number(b.limit||MAX_QUEUE_BATCH)); return json({ok:true, version:VERSION, ...out, stats:await dashboardStats(env), results:(await getResults(env,b.mode||'',b.keyword||'',200)).results}); }
    if (path === '/api/health/check') { const b = await parseBody(req); const out = await checkBatch(env, b.run_id||'', Number(b.limit||20)); return json({ok:true, version:VERSION, ...out, stats:await dashboardStats(env)}); }
    if (path === '/api/results') return json(await getResults(env, url.searchParams.get('mode')||'', url.searchParams.get('keyword')||'', Number(url.searchParams.get('limit')||100)));
    if (path === '/api/stats') return json({ok:true, version:VERSION, stats:await dashboardStats(env)});
    if (path === '/api/sources') { await ensureDb(env); if (req.method==='GET') return json({ok:true, version:VERSION, sources:(await all(env,`SELECT * FROM ${T.sources} ORDER BY priority DESC`)).results||[]}); const b=await parseBody(req); await q(env,`INSERT OR REPLACE INTO ${T.sources}(id,name,type,enabled,priority,template,config,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`,[b.id||uid('src'),b.name,b.type||'html',b.enabled?1:0,b.priority||50,b.template,JSON.stringify(b.config||{}),nowIso(),nowIso()]); return json({ok:true}); }
    if (path === '/api/export') return exportData(env, url.searchParams.get('format')||'json', url.searchParams.get('mode')||'');
    return json({ok:false, version:VERSION, error:'not_found'},404);
  } catch(e) {
    await logEvent(env, 'error', 'api_exception', { path, error:String(e.message||e), stack:e.stack });
    return json({ok:false, version:VERSION, error:String(e.message||e), stack:e.stack}, 500);
  }
}
async function handleReset(req, env) { await hardReset(env); return json({ok:true, version:VERSION, message:'D1 hard reset complete', next:'/' }); }
async function scheduled(event, env, ctx) {
  ctx.waitUntil((async()=>{ await ensureDb(env); await runSearch(env, 'autoscan', '', true); await processQueue(env, '', 20); await checkBatch(env, '', 20); })());
}
export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) return handleApi(req, env, ctx);
    if (url.pathname === '/reset') return handleReset(req, env);
    return env.ASSETS ? env.ASSETS.fetch(req) : text('Nimbus Core V27 Source Boost');
  },
  scheduled
};
