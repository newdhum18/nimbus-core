/* Nimbus Core V28 HyperSearch
 * Fresh Cloudflare Pages Worker + D1 app.
 * Frontend and extraction are integrated; AutoScan and Keyword Search are separated by mode.
 */
const VERSION = '28-queue-archive-comments-hotfix4';
const T = {
  runs: 'nimbus_v27sb_runs',
  pages: 'nimbus_v27sb_pages',
  links: 'nimbus_v27sb_links',
  archive: 'nimbus_v28_archive_links',
  queue: 'nimbus_v27sb_queue',
  cache: 'nimbus_v27sb_cache',
  events: 'nimbus_v27sb_events',
  sources: 'nimbus_v27sb_sources',
  settings: 'nimbus_v27sb_settings'
};
const DEFAULT_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1 NimbusCore/28';
const TIMEOUT_MS = 11000;
const CACHE_TTL_MS = 1000 * 60 * 60 * 6;
const HEALTH_TTL_MS = 1000 * 60 * 60 * 12;
const DEFAULT_MAX_SOURCE_FETCHES = 44;
const HARD_MAX_SOURCE_FETCHES = 72;
const MAX_CRAWL_PAGES = 240;
const MAX_QUEUE_BATCH = 10;
const SCHEDULE_SEED_LIMIT = 36; // Hotfix4: never insert 1000 queue rows in one Worker invocation
const SCHEDULE_SEED_LIMIT_KEYWORD = 48;
const SCHEDULE_SEED_LIMIT_AUTOSCAN = 36;
const MAX_DEEP_ROUNDS = 300;
const REQUEST_BUDGET_MS = 26000;
const QUEUE_SOURCE_BATCH = 12;
const QUEUE_CRAWL_CHILD_LIMIT = 8;
const QUEUE_MESSAGE_BATCH_LIMIT = 12;
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
  'site:github.com "mega.nz/folder"', 'site:gist.github.com "mega.nz/folder"', 'site:archive.org "mega.nz/folder"',
  'site:gitlab.com "mega.nz/folder"', 'site:bitbucket.org "mega.nz/folder"', 'site:linktr.ee "mega.nz/folder"',
  'site:meawfy.com "mega.nz/folder"', 'site:ofversedrops.com "mega.nz/folder"', 'site:telegra.ph "mega.nz/folder"',
  'site:medium.com "mega.nz/folder"', 'site:substack.com "mega.nz/folder"', 'site:notion.site "mega.nz/folder"',
  'site:paste.ee "mega.nz/folder"', 'site:justpaste.it "mega.nz/folder"', 'site:controlc.com "mega.nz/folder"',
  'site:hastebin.com "mega.nz/folder"', 'site:dpaste.org "mega.nz/folder"', 'site:pastes.io "mega.nz/folder"',
  'site:pastelink.net "mega.nz/folder"', 'site:github.io "mega.nz/folder"', 'site:raw.githubusercontent.com "mega.nz/folder"',
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
    `CREATE INDEX IF NOT EXISTS idx_${T.cache}_expires ON ${T.cache}(expires_at)`
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
    ['bing_rss','Bing RSS','rss',130,'https://www.bing.com/search?format=rss&q={q}'],
    ['bing_web','Bing Web','html',118,'https://www.bing.com/search?q={q}&count=50'],
    ['duckduckgo_html','DuckDuckGo HTML','html',116,'https://duckduckgo.com/html/?q={q}'],
    ['yahoo_search','Yahoo Search','html',108,'https://search.yahoo.com/search?p={q}&n=30'],
    ['brave_web','Brave Web','html',42,'https://search.brave.com/search?q={q}'],
    ['mojeek','Mojeek','html',92,'https://www.mojeek.com/search?q={q}'],
    ['qwant','Qwant','html',82,'https://www.qwant.com/?q={q}&t=web'],
    ['startpage','Startpage','html',78,'https://www.startpage.com/sp/search?query={q}'],
    ['yandex','Yandex','html',70,'https://yandex.com/search/?text={q}']
  ];
  for (const e of engines) add(...e);
  const apiLike = [
    ['reddit_search_json','Reddit Search JSON','json',112,'https://www.reddit.com/search.json?q={q}&limit=100&sort=new'],
    ['reddit_all_url_json','Reddit URL JSON','json',106,'https://www.reddit.com/search.json?q={q}%20url%3Amega.nz%2Ffolder&limit=100&sort=new'],
    ['reddit_megalinks_json','Reddit Megalinks JSON','json',84,'https://www.reddit.com/r/megalinks/search.json?q={q}&restrict_sr=1&limit=100&sort=new'],
    ['hn_algolia','HN Algolia','json',35,'https://hn.algolia.com/api/v1/search?query={q}%20mega.nz%2Ffolder&tags=story,comment'],
    ['github_code','GitHub Code Web','html',104,'https://github.com/search?q={q}+mega.nz%2Ffolder&type=code'],
    ['github_issues','GitHub Issues Web','html',94,'https://github.com/search?q={q}+mega.nz%2Ffolder&type=issues'],
    ['github_repos','GitHub Repos Web','html',86,'https://github.com/search?q={q}+mega.nz%2Ffolder&type=repositories'],
    ['gist_search','Gist Search','html',90,'https://gist.github.com/search?q={q}+mega.nz%2Ffolder'],
    ['gitlab_search','GitLab Search','html',80,'https://gitlab.com/search?search={q}%20mega.nz%2Ffolder'],
    ['bitbucket_search','Bitbucket Search','html',68,'https://bitbucket.org/repo/all?name={q}%20mega.nz%2Ffolder'],
    ['archive_search','Archive Search','html',86,'https://archive.org/search?query={q}%20mega.nz%2Ffolder'],
    ['archive_fulltext','Archive Full Text','html',70,'https://archive.org/advancedsearch.php?q={q}%20mega.nz%2Ffolder&fl%5B%5D=identifier&rows=50&output=json'],
    ['meawfy_web','Meawfy Web','html',100,'https://meawfy.com/search?q={q}'],
    ['ofversedrops_web','OfverseDrops Web','html',98,'https://ofversedrops.com/?s={q}'],
    ['ahmia','Ahmia Web','html',44,'https://ahmia.fi/search/?q={q}%20mega.nz']
  ];
  for (const a of apiLike) add(...a);
  const domains = [
    'rentry.co','pastebin.com','paste.ee','justpaste.it','controlc.com','hastebin.com','dpaste.org','pastes.io','paste.rs','pastelink.net','ghostbin.co','privatebin.net','gist.github.com','github.com','raw.githubusercontent.com','github.io','gitlab.com','bitbucket.org','reddit.com','old.reddit.com','archive.org','ofversedrops.com','meawfy.com','linktr.ee','linktree.com','beacons.ai','bio.link','solo.to','msha.ke','taplink.cc','allmylinks.com','instabio.cc','heylink.me','lnk.bio','flow.page','about.me','carrd.co','campsite.bio','linkin.bio','bio.fm','hypage.com','koji.to','linkpop.com','snipfeed.co','milkshake.app','shor.by','tap.bio','telegra.ph','medium.com','substack.com','notion.site','notion.so','docs.google.com','sites.google.com','blogspot.com','wordpress.com','tumblr.com','wixsite.com','weebly.com','gitbook.io','readthedocs.io','readme.io','sourceforge.net','scribd.com','slideshare.net','issuu.com','calameo.com'
  ];
  const patterns = [
    ['web','https://www.bing.com/search?q=site%3A{domain}%20{q}%20%22mega.nz%2Ffolder%22&count=30',76],
    ['rss','https://www.bing.com/search?format=rss&q=site%3A{domain}%20{q}%20%22mega.nz%2Ffolder%22',74],
    ['ddg','https://duckduckgo.com/html/?q=site%3A{domain}%20{q}%20%22mega.nz%2Ffolder%22',70],
    ['yahoo','https://search.yahoo.com/search?p=site%3A{domain}%20{q}%20%22mega.nz%2Ffolder%22&n=20',66],
    ['folder','https://www.bing.com/search?q=site%3A{domain}%20{q}%20%22mega.nz%2Ffolder%22&count=30',82]
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
  const base = safeSearchTerm(keyword);
  let patterns;
  if (mode === 'autoscan' && !base) {
    const domains = ['rentry.co','pastebin.com','paste.ee','justpaste.it','controlc.com','hastebin.com','dpaste.org','pastes.io','pastelink.net','reddit.com','old.reddit.com','github.com','gist.github.com','raw.githubusercontent.com','github.io','archive.org','gitlab.com','bitbucket.org','ofversedrops.com','meawfy.com','linktr.ee','linktree.com','beacons.ai','bio.link','solo.to','heylink.me','lnk.bio','telegra.ph','medium.com','substack.com','notion.site','blogspot.com','wordpress.com','tumblr.com','sites.google.com','docs.google.com','carrd.co'];
    const needles = ['mega.nz/folder','mega.co.nz/#F!','\"mega.nz/folder\"','\"mega.nz/folder\" \"index\"','\"mega.nz/folder\" \"archive\"','\"mega.nz/folder\" \"collection\"'];
    patterns = [...AUTOSCAN_PATTERNS];
    for (const d of domains) for (const n of needles) patterns.push(`site:${d} ${n}`);
  }
  else patterns = [
    base, `"${base}"`, `${base} mega.nz/folder`, `"${base}" "mega.nz/folder"`,
    `site:reddit.com ${base} "mega.nz/folder"`, `site:github.com ${base} "mega.nz/folder"`, `site:gist.github.com ${base} "mega.nz/folder"`,
    `site:pastebin.com ${base} "mega.nz/folder"`, `site:rentry.co ${base} "mega.nz/folder"`, `site:archive.org ${base} "mega.nz/folder"`,
    `site:gitlab.com ${base} "mega.nz/folder"`, `site:linktr.ee ${base} "mega.nz/folder"`, `site:meawfy.com ${base} "mega.nz/folder"`,
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
  if (/ofversedrops|meawfy|linktree|linktr|beacons|bio\.link|solo\.to|carrd|heylink|lnk|allmylinks|taplink|bio\.fm|hypage|koji|linkpop|snipfeed|milkshake|shor\.by|tap\.bio/.test(n)) return 'linkhub';
  if (/bing|duck|yahoo|brave|mojeek|qwant|startpage|yandex/.test(n)) return 'engine';
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
  const order = ['paste','reddit','code','archive','linkhub','structured','engine','web'];
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
async function getSources(env, opts = {}) {
  const maxSources = intEnv(env, 'MAX_SOURCES_PER_RUN', 1000, 25, 1000);
  let rows = catalogSources();
  try {
    const r = await all(env, `SELECT * FROM ${T.sources} WHERE enabled=1 ORDER BY priority DESC LIMIT 300`);
    rows = rows.concat(r.results || []);
  } catch {}
  const seen = new Set();
  rows = rows.filter(r => { const k=String(r.id||r.name||r.template); if(seen.has(k)) return false; seen.add(k); return true; });
  return balancedSources(rows, Number(opts.offset||0)).slice(0, maxSources);
}
function sourceUrl(source, query) { return source.template.replace('{q}', encodeURIComponent(query)); }
async function cachedFetch(env, url, sourceName) {
  // D1 cache was intentionally removed from the hot path.
  // Writing cache rows for every source consumed the Worker subrequest budget before searching began.
  try {
    const res = await fetchWithTimeout(url, {}, TIMEOUT_MS);
    const txt = await bodyText(res);
    return { fromCache:false, status:res.status, text:txt };
  } catch (e) {
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
  const source = hostOf(data.page_url||'') || String(data.source||'');
  const id = 'ln_' + hash((data.mode||'') + '|' + keywordKey + '|' + norm);
  const score = scoreResult({link:norm, source, title:data.title, pageUrl:data.page_url, mode:data.mode});
  const now = nowIso();
  await q(env, `INSERT INTO ${T.links}(id,run_id,mode,keyword,keyword_key,link,normalized,type,source,page_url,title,snippet,score,health,first_seen_at,last_seen_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(mode, normalized, keyword_key) DO UPDATE SET last_seen_at=excluded.last_seen_at, score=max(score, excluded.score), source=excluded.source, page_url=excluded.page_url, title=COALESCE(excluded.title,title), health='folder'`,
    [id, data.run_id||'', data.mode||'search', data.keyword||'', keywordKey, norm, norm, type, source, data.page_url||'', data.title||'', data.snippet||'', score, 'folder', now, now]);
  const srcJson = JSON.stringify([source].filter(Boolean));
  await q(env, `INSERT INTO ${T.archive}(normalized,link,type,source,sources,page_url,keyword,first_seen_at,last_seen_at,seen_count,score,health,snippet)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(normalized) DO UPDATE SET last_seen_at=excluded.last_seen_at, seen_count=seen_count+1, score=max(score, excluded.score), health='folder', source=excluded.source, page_url=COALESCE(excluded.page_url,page_url), keyword=COALESCE(NULLIF(excluded.keyword,''),keyword), snippet=COALESCE(excluded.snippet,snippet)`,
    [norm, norm, type, source, srcJson, data.page_url||'', data.keyword||'', now, now, 1, score, 'folder', data.snippet||'']);
  return true;
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
  const id = item.id || 'q_' + hash([item.kind,qUrl,qKeyword,item.mode,sourceName].join('|'));
  await q(env, `INSERT OR IGNORE INTO ${T.queue}(id,run_id,mode,kind,url,keyword,source,priority,status,attempts,max_attempts,available_at,created_at,updated_at,error) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [id, item.run_id||'', item.mode||'search', item.kind, qUrl, qKeyword, sourceName, item.priority||50, 'pending', 0, item.max_attempts||3, item.available_at||nowIso(), nowIso(), nowIso(), '']);
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
  // Hotfix 3: Pages cannot reliably act as a Cloudflare Queue consumer.
  // Therefore every task is persisted in the D1 shadow queue first and processed by /api/v28/tick.
  // If a real Worker consumer is added later, the same bindings can still be used, but the UI no longer
  // depends on Cloudflare Queue draining messages in the background.
  let n = 0;
  for (const it of items) {
    await enqueue(env, { ...it, id:it.id || 'q_' + hash([it.kind,it.url||it.template||'',it.query||it.keyword||'',it.mode,it.run_id,it.source_name||''].join('|')) });
    n++;
  }
  return { mode:'d1-shadow-autopilot', enqueued:n };
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
  const l = await first(env, `SELECT COUNT(*) links, SUM(CASE WHEN health IN ('alive','folder') THEN 1 ELSE 0 END) alive, SUM(CASE WHEN health='dead' THEN 1 ELSE 0 END) dead, SUM(CASE WHEN health NOT IN ('alive','folder','dead') THEN 1 ELSE 0 END) unknown FROM ${T.links} WHERE run_id=?`, [runId]);
  return { pages:p?.pages||0, sources:p?.sources||0, links:l?.links||0, alive:l?.alive||0, dead:l?.dead||0, unknown:l?.unknown||0 };
}
async function processSourceFetch(env, runId, mode, keyword, src, query, started = Date.now(), preferCloud = true) {
  let direct = 0, queued = 0;
  const url = sourceUrl(src, query);
  const got = await cachedFetch(env, url, src.name);
  const links = extractMegaLinks(got.text);
  for (const link of links) {
    if (await saveLink(env, { run_id:runId, mode, keyword:keyword||'', link, source:src.name, page_url:url, title:query, snippet:'direct from source response' })) direct++;
  }
  await q(env, `INSERT OR IGNORE INTO ${T.pages}(id,run_id,mode,source,url,title,status,depth,links_found,scanned_at,error) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
    ['pg_'+hash(runId+url), runId, mode, src.name, url, query, got.status||0, 0, links.length, nowIso(), got.error||'']);
  const targetLimit = mode === 'autoscan' ? QUEUE_CRAWL_CHILD_LIMIT : 6;
  const targets = parseSearchTargets(got.text, src, url).slice(0, targetLimit);
  const tasks = targets.map(t => ({ run_id:runId, mode, kind:'crawl', url:t, keyword:keyword||query, source:hostOf(t)||src.name, priority: src.priority || 50, max_attempts:3 }));
  if (tasks.length) {
    if (preferCloud && (env.AUTOSCAN_QUEUE || env.QUEUE)) { await enqueueManyCloud(env, tasks); queued += tasks.length; }
    else { for (const t of tasks) { await enqueue(env, t); queued++; } }
  }
  return { direct, queued, status:got.status||0, targets:targets.length };
}
async function scheduleQueueRun(env, mode='autoscan', keyword='', opts={}) {
  await ensureDb(env);
  const runId = await startRun(env, mode, keyword||'');
  const allSources = await getSources(env, {offset:Number(opts.source_offset||0)||0});
  const queries = buildQueries(keyword, mode);
  const sourceOffset = Math.max(0, Number(opts.source_offset || 0) || 0) % Math.max(1, allSources.length);
  const queryOffset = Math.max(0, Number(opts.query_offset || 0) || 0) % Math.max(1, queries.length);
  // Hotfix4: Cloudflare/D1 has a hard per-invocation subrequest ceiling. Do NOT enqueue
  // all 1000 sources in one request. Seed a safe balanced slice; the frontend AutoPilot and
  // Continue Deep Processing can create/drain more slices without hitting 1102.
  const requested = Number(opts.max_sources || 0) || (mode === 'search' ? SCHEDULE_SEED_LIMIT_KEYWORD : SCHEDULE_SEED_LIMIT_AUTOSCAN);
  const safeLimit = Math.min(requested, mode === 'search' ? SCHEDULE_SEED_LIMIT_KEYWORD : SCHEDULE_SEED_LIMIT_AUTOSCAN, allSources.length);
  const selected = [];
  for (let i=0; i<safeLimit; i++) selected.push(allSources[(sourceOffset + i) % allSources.length]);
  const tasks = selected.map((src, i) => ({
    kind:'source',
    run_id:runId,
    mode,
    keyword:keyword||'',
    source: src,
    source_name: src.name || 'source',
    query:queries[(queryOffset+i) % queries.length],
    priority:src.priority||50
  }));
  let enqueued = 0, queueMode = 'd1';
  for (let i=0; i<tasks.length; i+=QUEUE_MESSAGE_BATCH_LIMIT) {
    const chunk = tasks.slice(i, i+QUEUE_MESSAGE_BATCH_LIMIT);
    const out = await enqueueManyCloud(env, chunk);
    enqueued += out.enqueued || 0;
    queueMode = out.mode || queueMode;
  }
  const next_source_offset = (sourceOffset + selected.length) % Math.max(1, allSources.length);
  const remaining_estimate = Math.max(0, allSources.length - selected.length);
  return { ok:true, version:VERSION, queued:true, queue_mode:queueMode, run_id:runId, mode, keyword:keyword||'', enqueued, catalog_sources:allSources.length, source_offset:sourceOffset, next_source_offset, remaining_estimate, safe_seed_limit:safeLimit, message:'Queue/Archive job created in safe chunks. AutoPilot drains D1 Shadow Queue without exceeding Cloudflare limits.' };
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
  const got = await cachedFetch(env, item.url, item.source);
  let found = 0, children = 0;
  const links = extractMegaLinks(got.text);
  for (const link of links) {
    if (await saveLink(env, { run_id:item.run_id, mode:item.mode, keyword:item.keyword||'', link, source:hostOf(item.url)||item.source, page_url:item.url, title:item.keyword||'', snippet:snippetFrom(got.text) })) found++;
  }
  await q(env, `INSERT OR IGNORE INTO ${T.pages}(id,run_id,mode,source,url,title,status,depth,links_found,scanned_at,error) VALUES(?,?,?,?,?,?,?,?,?,?,?)`,
    ['pg_'+hash((item.run_id||'')+item.url), item.run_id||'', item.mode||'', hostOf(item.url)||item.source, item.url, item.keyword||'', got.status||0, 1, found, nowIso(), got.error||'']);
  const discovered = parseSearchTargets(got.text, {name:item.source||hostOf(item.url)}, item.url)
    .filter(u => !/\.(?:jpg|jpeg|png|gif|webp|css|ico|svg|woff2?)(?:$|[?#])/i.test(u))
    .slice(0, 4);
  for (const u of discovered) {
    await enqueue(env, { run_id:item.run_id, mode:item.mode, kind:'crawl', url:u, keyword:item.keyword||'', source:hostOf(u)||hostOf(item.url)||item.source, priority: Math.max(10,(item.priority||50)-12), max_attempts:2 });
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
      if (item.kind === 'source') {
        const src = { name:item.source || hostOf(item.url) || 'source', template:item.url, priority:item.priority || 50 };
        r = await processSourceFetch(env, item.run_id || '', item.mode || 'autoscan', item.keyword || 'mega.nz/folder', src, item.keyword || 'mega.nz/folder', Date.now(), false);
        r.found = (r.direct || 0);
      }
      else if (item.kind === 'crawl') r = await crawlPage(env, item);
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
  const links = await first(env, `SELECT COUNT(*) total, SUM(CASE WHEN health IN ('alive','folder') THEN 1 ELSE 0 END) alive, SUM(CASE WHEN health='dead' THEN 1 ELSE 0 END) dead, SUM(CASE WHEN health NOT IN ('alive','folder','dead') THEN 1 ELSE 0 END) unknown FROM ${T.links}`);
  const pages = await first(env, `SELECT COUNT(*) total FROM ${T.pages}`);
  const runs = await first(env, `SELECT COUNT(*) total FROM ${T.runs}`);
  const queue = await first(env, `SELECT SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) pending, SUM(CASE WHEN status='running' THEN 1 ELSE 0 END) running, SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) done, SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) failed FROM ${T.queue}`);
  const cache = await first(env, `SELECT COUNT(*) total, SUM(hits) hits FROM ${T.cache}`);
  const customSources = await runIgnore(first(env, `SELECT COUNT(*) total, SUM(CASE WHEN enabled=1 THEN 1 ELSE 0 END) enabled FROM ${T.sources}`));
  const builtins = catalogSources().length;
  const success = links?.total ? Math.round(((links.alive||0) / links.total) * 100) : 0;
  return { archive_total:archive?.total||0, links_total:links?.total||0, alive:links?.alive||0, dead:links?.dead||0, unknown:links?.unknown||0, pages_scanned:pages?.total||0, runs:runs?.total||0, queue_pending:queue?.pending||0, queue_running:queue?.running||0, queue_done:queue?.done||0, queue_failed:queue?.failed||0, cache_entries:cache?.total||0, cache_hits:cache?.hits||0, sources_total:builtins + (customSources?.total||0), sources_enabled:builtins + (customSources?.enabled||0), success_rate:success };
}
async function diagnostics(env) {
  await ensureDb(env);
  const tables = {};
  for (const [k,t] of Object.entries(T)) {
    const c = await first(env, `SELECT COUNT(*) c FROM ${t}`);
    tables[t] = c?.c ?? 0;
  }
  return { ok:true, version:VERSION, db_bound:!!env.DB, tables, stats:await dashboardStats(env), features:['separate_autoscan_page','separate_keyword_search_page','integrated_extractor','multi_source','json_html_rss_sources','crawler','queue','cache','health','dashboard','csv_json_export','db_repair','deep_200_round_processing','encoded_url_extraction','old_mega_format_extraction','reddit_json_targets','wide_1000_source_catalog','adaptive_source_budget','safe_query_sanitizer','false_positive_url_guard','one_button_auto_batch','no_d1_seed_hotpath','balanced_source_rotation','low_subrequest_deep','valid_mega_key_required','ios_universal_open_links','autopilot_continuous_frontend','v28_virtual_queue_scheduler','balanced_round_robin_groups','source_host_attribution','safari_self_navigation_mega_open','folder_only_mode','permanent_d1_archive','ofversedrops_source','real_source_label_preference'] };
}

async function startV28Job(env, mode='autoscan', keyword='', opts={}) {
  // Hotfix 3: create the D1 shadow queue and immediately drain a small first batch.
  // This proves the pipeline is active and avoids the previous state where runs increased but pages stayed 0.
  const started = Date.now();
  const scheduled = await scheduleQueueRun(env, mode, keyword||'', opts||{});
  const firstLimit = Math.min(Number(opts.initial_limit||6)||6, 8);
  const first = await processQueue(env, scheduled.run_id||'', firstLimit);
  return { ...scheduled, first_processed:first, pending:await queueCount(env, scheduled.run_id||''), elapsed_ms:Date.now()-started, stats:await dashboardStats(env), results:(await getResults(env, mode, keyword||'', 1000)).results };
}
async function tickV28Job(env, runId, mode='autoscan', keyword='', opts={}) {
  // Always drain the D1 shadow queue in small safe batches. This makes AutoPilot work even when
  // Cloudflare Queue consumer is not attached to the Pages deployment.
  const started = Date.now();
  const limit = Math.min(Number(opts.limit||10)||10, 14);
  let processed = await processQueue(env, runId||'', limit);
  // Fallback: if the specific run id has no rows, drain the global queue. This helps after browser reloads
  // or when the frontend did not persist the latest run_id correctly.
  if (!(processed.processed||processed.failed) && runId) processed = await processQueue(env, '', Math.min(limit, 8));
  return { ok:true, version:VERSION, run_id:runId||'', mode, keyword:keyword||'', elapsed_ms:Date.now()-started, pending:await queueCount(env, runId||''), processed, stats:await dashboardStats(env), results:(await getResults(env, mode, keyword||'', 1000)).results };
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
    if (path === '/api/db/clean-invalid') { const out = await cleanInvalidLinks(env); return json({ok:true, version:VERSION, ...out}); }
    if (path === '/api/diagnostics') return json(await diagnostics(env));
    if (path === '/api/v28/start') { const b=await parseBody(req); return json(await startV28Job(env, b.mode||'autoscan', b.keyword||'', b)); }
    if (path === '/api/v28/tick') { const b=await parseBody(req); return json(await tickV28Job(env, b.run_id||'', b.mode||'autoscan', b.keyword||'', b)); }
    if (path === '/api/autoscan') { const b = await parseBody(req); const out = ((env.AUTOSCAN_QUEUE || env.QUEUE) || b.queue) ? await scheduleQueueRun(env, 'autoscan', b.keyword||'', b) : await runSearch(env, 'autoscan', b.keyword||'', false, b); return json(out); }
    if (path === '/api/search') { const b = await parseBody(req); if (!String(b.keyword||'').trim()) return json({ok:false, error:'keyword_required'}, 400); const out = ((env.AUTOSCAN_QUEUE || env.QUEUE) || b.queue) ? await scheduleQueueRun(env, 'search', String(b.keyword||'').trim(), b) : await runSearch(env, 'search', String(b.keyword||'').trim(), false, b); return json(out); }
    if (path === '/api/extract') { const b = await parseBody(req); if (!b.url) return json({ok:false,error:'url_required'},400); return json(await extractFromUrl(env, b.url, b.mode||'url', b.keyword||'')); }
    if (path === '/api/queue/process') { const b = await parseBody(req); const out = await processQueue(env, b.run_id||'', Number(b.limit||MAX_QUEUE_BATCH)); return json({ok:true, version:VERSION, ...out, stats:await dashboardStats(env)}); }
    if (path === '/api/queue/deep') { const b = await parseBody(req); const out = await deepProcessQueue(env, b.run_id||'', Number(b.rounds||100), Number(b.limit||MAX_QUEUE_BATCH)); return json({ok:true, version:VERSION, ...out, stats:await dashboardStats(env), results:(await getResults(env,b.mode||'',b.keyword||'',1000)).results}); }
    if (path === '/api/health/check') { const b = await parseBody(req); const out = await checkBatch(env, b.run_id||'', Number(b.limit||20)); return json({ok:true, version:VERSION, ...out, stats:await dashboardStats(env)}); }
    if (path === '/api/results') return json(await getResults(env, url.searchParams.get('mode')||'', url.searchParams.get('keyword')||'', Number(url.searchParams.get('limit')||1000)));
    if (path === '/api/archive') return json(await getArchive(env, Number(url.searchParams.get('limit')||2000)));
    if (path === '/api/stats') return json({ok:true, version:VERSION, stats:await dashboardStats(env)});
    if (path === '/api/sources') { await ensureDb(env); if (req.method==='GET') return json({ok:true, version:VERSION, sources: await getSources(env)}); const b=await parseBody(req); await q(env,`INSERT OR REPLACE INTO ${T.sources}(id,name,type,enabled,priority,template,config,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`,[b.id||uid('src'),b.name,b.type||'html',b.enabled?1:0,b.priority||50,b.template,JSON.stringify(b.config||{}),nowIso(),nowIso()]); return json({ok:true}); }
    if (path === '/api/export') return exportData(env, url.searchParams.get('format')||'json', url.searchParams.get('mode')||'');
    return json({ok:false, version:VERSION, error:'not_found'},404);
  } catch(e) {
    await logEvent(env, 'error', 'api_exception', { path, error:String(e.message||e), stack:e.stack });
    return json({ok:false, version:VERSION, error:String(e.message||e), stack:e.stack}, 500);
  }
}
async function handleReset(req, env) { await hardReset(env); return json({ok:true, version:VERSION, message:'D1 hard reset complete', next:'/' }); }
async function scheduled(event, env, ctx) {
  ctx.waitUntil((async()=>{ await ensureDb(env); if (env.AUTOSCAN_QUEUE || env.QUEUE) await scheduleQueueRun(env, 'autoscan', '', {max_sources:72}); else { await runSearch(env, 'autoscan', '', true, { max_sources: 12, deep_rounds: 3 }); await processQueue(env, '', 8); } })());
}
export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/api/')) return handleApi(req, env, ctx);
    if (url.pathname === '/reset') return handleReset(req, env);
    return env.ASSETS ? env.ASSETS.fetch(req) : text('Nimbus Core V28 Queue Archive Comments');
  },
  async queue(batch, env, ctx) {
    await ensureDb(env);
    const outcomes = [];
    for (const msg of batch.messages) {
      try {
        const out = await handleQueueMessage(env, msg.body);
        outcomes.push(out);
        msg.ack();
      } catch (e) {
        outcomes.push({ ok:false, error:String(e.message||e).slice(0,300) });
        msg.retry();
      }
    }
    ctx.waitUntil(logEvent(env, 'info', 'queue_batch_processed', { count:batch.messages.length, outcomes:outcomes.slice(0,5) }));
  },
  scheduled
};
