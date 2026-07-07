const VERSION = '22.0.0-link-first-resilient';
const MAX_TEXT_BYTES = 450000;

const URL_SHAPE_QUERIES = [
  '"https://mega.nz/folder/"',
  '"https://mega.nz/file/"',
  '"mega.nz/folder/" "#"',
  '"mega.nz/file/" "#"',
  '"mega.nz/#F!"',
  '"mega.nz/#!"',
  '"mega.nz" "/folder/"',
  '"mega.nz" "/file/"',
  'site:rentry.co "mega.nz/folder/"',
  'site:rentry.co "mega.nz/file/"',
  'site:pastebin.com "mega.nz/folder/"',
  'site:pastebin.com "mega.nz/file/"',
  'site:telegra.ph "mega.nz/folder/"',
  'site:gist.github.com "mega.nz"',
  'site:github.com "mega.nz/folder/"',
  'site:github.com "mega.nz/file/"',
  'site:reddit.com "mega.nz/folder/"',
  'site:reddit.com "mega.nz/file/"',
  'site:pastelink.net "mega.nz"',
  'site:paste.ee "mega.nz"',
  'site:justpaste.it "mega.nz"',
  'site:controlc.com "mega.nz"',
  'site:pastes.io "mega.nz"',
  'site:notes.io "mega.nz"'
];

const MANUAL_SEEDS = [
  'https://rentry.co', 'https://pastebin.com', 'https://pastelink.net', 'https://paste.ee',
  'https://justpaste.it', 'https://telegra.ph', 'https://gist.github.com', 'https://github.com',
  'https://reddit.com', 'https://controlc.com', 'https://pastes.io', 'https://notes.io',
  'https://ahmia.fi', 'https://onionland.io', 'https://onionengine.com', 'https://dark.fail'
];

const BLOCKED_TEXT = [
  /captcha/i, /verify\s+you\s+are\s+human/i, /login/i, /log\s*in/i, /sign\s*in/i,
  /subscribe/i, /subscription/i, /paywall/i, /unlock/i, /credits?/i, /forbidden/i,
  /private\s+account/i, /permission/i, /access\s+denied/i
];

const MEGA_RE = /https?:\/\/(?:www\.)?mega\.nz\/(?:folder\/[-_a-zA-Z0-9]+(?:#[!_\-$a-zA-Z0-9]+)?|file\/[-_a-zA-Z0-9]+(?:#[!_\-$a-zA-Z0-9]+)?|#F![!_\-$a-zA-Z0-9]+|#![!_\-$a-zA-Z0-9]+)/g;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/login' && request.method === 'POST') return await login(request, env);
      if (url.pathname === '/reset') return resetPage();
      if (url.pathname === '/api/health') return json({ ok: true, version: VERSION, note: 'public-indexed-link-first-only' });
      if (url.pathname.startsWith('/api/')) return await withAuth(request, env, () => apiRoute(request, env, ctx, url));
      return await serveAsset(request, env, url);
    } catch (err) {
      return json({ ok: false, version: VERSION, error: 'worker_exception', message: String(err && err.message ? err.message : err) }, 500);
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async () => {
      if (String(env.CRON_ENABLED || '').toLowerCase() === 'true') await runAutoScan(env, { limitPages: Number(env.CRON_LIMIT || 45), runBy: 'cron' });
    })());
  }
};

async function serveAsset(request, env, url) {
  if (env.ASSETS) {
    const res = await env.ASSETS.fetch(request);
    const h = new Headers(res.headers);
    if (url.pathname === '/' || /\.(html|js|css)$/.test(url.pathname)) h.set('cache-control', 'no-store, max-age=0, must-revalidate');
    return new Response(res.body, { status: res.status, headers: h });
  }
  return text('Nimbus Core V22 assets unavailable', 404);
}

async function apiRoute(request, env, ctx, url) {
  if (url.pathname === '/api/session') return json({ ok: true, version: VERSION, session: 'valid' });
  if (url.pathname === '/api/ping') return json({ ok: true, version: VERSION, db_bound: Boolean(env.DB), auth_pin_configured: Boolean(env.AUTH_PIN), brave_enabled: Boolean(env.BRAVE_API_KEY), policy: 'public-indexed-link-first-only' });
  if (url.pathname === '/api/schema') return ensureSchemaResponse(env);
  if (url.pathname === '/api/search' && request.method === 'POST') return search(request, env);
  if (url.pathname === '/api/latest') return listLinks(env, url);
  if (url.pathname === '/api/archive') return listLinks(env, url);
  if (url.pathname === '/api/manual-sources') return listManual(env, url);
  if (url.pathname === '/api/stats') return stats(env);
  if (url.pathname === '/api/export') return exportLinks(env, url);
  if (url.pathname === '/api/delete-link' && request.method === 'POST') return deleteLink(request, env);
  if (url.pathname === '/api/bulk-delete' && request.method === 'POST') return bulkDelete(request, env);
  if (url.pathname === '/api/cleanup' && request.method === 'POST') return cleanup(env);
  if (url.pathname === '/api/reset-cursor' && request.method === 'POST') return resetCursor(env);
  return json({ ok: false, error: 'api_route_not_found' }, 404);
}

async function login(request, env) {
  const body = await request.json().catch(() => ({}));
  const pin = String(body.pin || '');
  if (!env.AUTH_PIN) return json({ ok: false, error: 'AUTH_PIN_missing' }, 500);
  if (pin !== String(env.AUTH_PIN)) return json({ ok: false, error: 'invalid_pin' }, 401);
  const exp = Date.now() + 14 * 24 * 60 * 60 * 1000;
  return json({ ok: true, version: VERSION, token: await signToken({ exp, v: VERSION }, env), expires_at: new Date(exp).toISOString() });
}

async function withAuth(request, env, fn) {
  try {
    if (!env.AUTH_PIN) return json({ ok: false, error: 'AUTH_PIN_missing' }, 500);
    const raw = request.headers.get('authorization') || '';
    const token = raw.replace(/^Bearer\s+/i, '');
    if (!token || !(await verifyToken(token, env))) return json({ ok: false, error: 'unauthorized' }, 401);
    return await fn();
  } catch (err) {
    return json({ ok: false, version: VERSION, error: 'api_exception', message: safeError(err) }, 500);
  }
}

async function signToken(payload, env) {
  const body = b64url(JSON.stringify(payload));
  return body + '.' + await hmac(body, env.AUTH_SECRET || env.AUTH_PIN);
}
async function verifyToken(token, env) {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return false;
    const expected = await hmac(parts[0], env.AUTH_SECRET || env.AUTH_PIN);
    if (expected !== parts[1]) return false;
    const payload = JSON.parse(fromB64url(parts[0]));
    return Number(payload.exp || 0) > Date.now();
  } catch { return false; }
}
async function hmac(data, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(String(secret)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}
function b64url(s) { return btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''); }
function fromB64url(s) { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return decodeURIComponent(escape(atob(s))); }

function getDb(env) { if (!env.DB) throw new Error('D1 binding named DB is missing'); return env.DB; }
function safeError(err) { return String(err && err.message ? err.message : err).slice(0, 1200); }
async function ensureSchemaResponse(env) { await ensureSchema(getDb(env)); return json({ ok: true, version: VERSION, message: 'schema_ready' }); }
async function ensureSchema(d) {
  await d.prepare(`CREATE TABLE IF NOT EXISTS mega_links (id INTEGER PRIMARY KEY AUTOINCREMENT, mega_url TEXT UNIQUE NOT NULL, canonical_url TEXT, source_url TEXT, source_host TEXT, title TEXT, link_type TEXT, confidence INTEGER DEFAULT 50, confidence_reason TEXT, first_seen_at TEXT DEFAULT CURRENT_TIMESTAMP, last_seen_at TEXT DEFAULT CURRENT_TIMESTAMP, hit_count INTEGER DEFAULT 0, status TEXT DEFAULT 'active')`).run();
  await d.prepare(`CREATE TABLE IF NOT EXISTS manual_sources (id INTEGER PRIMARY KEY AUTOINCREMENT, source_url TEXT UNIQUE NOT NULL, source_host TEXT, title TEXT, reason TEXT, first_seen_at TEXT DEFAULT CURRENT_TIMESTAMP, last_seen_at TEXT DEFAULT CURRENT_TIMESTAMP, status TEXT DEFAULT 'open')`).run();
  await d.prepare(`CREATE TABLE IF NOT EXISTS scan_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, mode TEXT, run_by TEXT, pages_collected INTEGER DEFAULT 0, pages_scanned INTEGER DEFAULT 0, mega_found INTEGER DEFAULT 0, new_links INTEGER DEFAULT 0, manual_sources INTEGER DEFAULT 0, engines TEXT, cursor_before INTEGER, cursor_after INTEGER, message TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await d.prepare(`CREATE TABLE IF NOT EXISTS scan_state (id TEXT PRIMARY KEY, cursor INTEGER DEFAULT 0, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();

  await ensureColumns(d, 'mega_links', {
    canonical_url: 'TEXT', source_url: 'TEXT', source_host: 'TEXT', title: 'TEXT', link_type: 'TEXT',
    confidence: 'INTEGER DEFAULT 50', confidence_reason: 'TEXT', first_seen_at: 'TEXT DEFAULT CURRENT_TIMESTAMP',
    last_seen_at: 'TEXT DEFAULT CURRENT_TIMESTAMP', hit_count: 'INTEGER DEFAULT 0', status: "TEXT DEFAULT 'active'"
  });
  await ensureColumns(d, 'manual_sources', {
    source_host: 'TEXT', title: 'TEXT', reason: 'TEXT', first_seen_at: 'TEXT DEFAULT CURRENT_TIMESTAMP',
    last_seen_at: 'TEXT DEFAULT CURRENT_TIMESTAMP', status: "TEXT DEFAULT 'open'"
  });
  await ensureColumns(d, 'scan_logs', {
    mode: 'TEXT', run_by: 'TEXT', pages_collected: 'INTEGER DEFAULT 0', pages_scanned: 'INTEGER DEFAULT 0',
    mega_found: 'INTEGER DEFAULT 0', new_links: 'INTEGER DEFAULT 0', manual_sources: 'INTEGER DEFAULT 0',
    engines: 'TEXT', cursor_before: 'INTEGER', cursor_after: 'INTEGER', message: 'TEXT', created_at: 'TEXT DEFAULT CURRENT_TIMESTAMP'
  });
  await d.prepare(`CREATE INDEX IF NOT EXISTS idx_mega_last ON mega_links(last_seen_at DESC)`).run();
  await d.prepare(`CREATE INDEX IF NOT EXISTS idx_manual_last ON manual_sources(last_seen_at DESC)`).run();
}
async function ensureColumns(d, table, columns) {
  const info = await d.prepare(`PRAGMA table_info(${table})`).all();
  const have = new Set((info.results || []).map(x => x.name));
  for (const [name, def] of Object.entries(columns)) {
    if (!have.has(name)) await d.prepare(`ALTER TABLE ${table} ADD COLUMN ${name} ${def}`).run();
  }
}

async function search(request, env) {
  const body = await request.json().catch(() => ({}));
  const q = String(body.q || '').trim();
  if (q) return manualSearch(env, q, Number(body.limitPages || 50));
  return runAutoScan(env, { limitPages: Number(body.limitPages || 75), runBy: 'user' });
}

async function runAutoScan(env, opts) {
  const d = getDb(env); await ensureSchema(d);
  const limitPages = clamp(opts.limitPages || 75, 10, 140);
  const state = await getState(d, 'link-first-v22');
  const cursorBefore = state.cursor;
  const queries = nextQueries(cursorBefore, 8);
  const cursorAfter = cursorBefore + queries.length;
  await setState(d, 'link-first-v22', cursorAfter);

  const collected = [];
  const engines = new Set();
  for (const q of queries) {
    const packs = await Promise.allSettled([
      braveSearch(q, env), bingRssSearch(q), ddgLiteSearch(q), bingSearch(q), mojeekSearch(q), yepSearch(q), ahmiaSearch(q), onionlandSearch(q), onionengineSearch(q)
    ]);
    for (const pack of packs) {
      if (pack.status !== 'fulfilled') continue;
      for (const item of pack.value) {
        if (item && item.url) { collected.push(item); engines.add(item.engine || 'unknown'); }
      }
    }
    if (collected.length >= limitPages * 2) break;
  }

  const pages = uniquePages(collected).slice(0, limitPages);
  let scanned = 0, found = 0, fresh = 0, manual = 0;
  for (const page of pages) {
    const result = await inspectPage(d, page);
    scanned += 1; found += result.found; fresh += result.newLinks; manual += result.manual;
  }
  await addManualSeeds(d);
  await logScan(d, { mode: 'link-first-url-shape', run_by: opts.runBy || 'user', pages_collected: pages.length, pages_scanned: scanned, mega_found: found, new_links: fresh, manual_sources: manual, engines: Array.from(engines).join(','), cursor_before: cursorBefore, cursor_after: cursorAfter, message: 'V22 stable scan completed. Public indexed pages only; no bypass.' });
  const items = await selectLinks(d, 250, 0, '');
  return json({ ok: true, version: VERSION, mode: 'link-first-url-shape', cursor_before: cursorBefore, cursor_after: cursorAfter, queries_used: queries.length, engines_used: Array.from(engines), pages_collected: pages.length, pages_scanned: scanned, mega_found: found, new_links: fresh, manual_sources: manual, items });
}

async function manualSearch(env, q, limitPages) {
  const d = getDb(env); await ensureSchema(d);
  const safe = q.slice(0, 80);
  const queries = [`${safe} "mega.nz/folder/"`, `${safe} "mega.nz/file/"`, `site:rentry.co ${safe} "mega.nz"`, `site:pastebin.com ${safe} "mega.nz"`];
  let pages = [];
  const engines = new Set();
  for (const query of queries) {
    const packs = await Promise.allSettled([braveSearch(query, env), bingRssSearch(query), ddgLiteSearch(query), bingSearch(query)]);
    for (const pack of packs) if (pack.status === 'fulfilled') for (const item of pack.value) { pages.push(item); engines.add(item.engine || 'unknown'); }
  }
  pages = uniquePages(pages).slice(0, clamp(limitPages || 50, 10, 100));
  let found = 0, fresh = 0, manual = 0;
  for (const page of pages) {
    const result = await inspectPage(d, page);
    found += result.found; fresh += result.newLinks; manual += result.manual;
  }
  await logScan(d, { mode: 'manual-keyword-separated', run_by: 'user', pages_collected: pages.length, pages_scanned: pages.length, mega_found: found, new_links: fresh, manual_sources: manual, engines: Array.from(engines).join(','), cursor_before: null, cursor_after: null, message: 'Manual search is separate from Auto Scan.' });
  return json({ ok: true, version: VERSION, mode: 'manual-separated', pages_scanned: pages.length, mega_found: found, new_links: fresh, manual_sources: manual, items: await selectLinks(d, 250, 0, '') });
}

function nextQueries(cursor, count) { return Array.from({ length: count }, (_, i) => URL_SHAPE_QUERIES[(cursor + i) % URL_SHAPE_QUERIES.length]); }
async function getState(d, id) { const row = await d.prepare('SELECT cursor FROM scan_state WHERE id=?').bind(id).first(); return { cursor: Number(row && row.cursor ? row.cursor : 0) }; }
async function setState(d, id, cursor) { await d.prepare('INSERT INTO scan_state(id,cursor,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET cursor=excluded.cursor, updated_at=CURRENT_TIMESTAMP').bind(id, cursor).run(); }

async function inspectPage(d, page) {
  let found = 0, newLinks = 0, manual = 0;
  if (!page || !/^https?:\/\//i.test(page.url)) return { found, newLinks, manual };
  if (/\.onion\b/i.test(page.url)) { await saveManual(d, page.url, page.title, 'Tor-only source. Open manually in Tor.'); return { found, newLinks, manual: 1 }; }

  for (const direct of extractMega(page.url)) {
    const saved = await saveMega(d, direct, page.url, page.title || 'Search result', score(direct, page), 'MEGA URL found directly in public search result URL');
    found += 1; if (saved) newLinks += 1;
  }

  const fetched = await safeFetchText(page.url);
  if (!fetched.ok) {
    if (fetched.manual) { await saveManual(d, page.url, page.title, fetched.reason); manual += 1; }
    return { found, newLinks, manual };
  }
  const title = page.title || titleFromHtml(fetched.text) || 'Public source';
  if (isBlockedHtml(fetched.text)) { await saveManual(d, page.url, title, 'Login/paywall/captcha/unlock signal detected. No bypass attempted.'); return { found, newLinks, manual: manual + 1 }; }
  const links = extractMega(fetched.text);
  for (const link of links) {
    const saved = await saveMega(d, link, page.url, title, score(link, page), reasonFor(link, page));
    found += 1; if (saved) newLinks += 1;
  }
  if (!links.length && /mega\.nz/i.test(fetched.text)) { await saveManual(d, page.url, title, 'MEGA text found, but no complete valid MEGA URL was extractable.'); manual += 1; }
  return { found, newLinks, manual };
}

async function safeFetchText(url) {
  try {
    const res = await fetch(url, { headers: { 'accept': 'text/html,application/xhtml+xml,application/xml,text/plain,application/json;q=0.8,*/*;q=0.1' } });
    const ctype = res.headers.get('content-type') || '';
    if ([401, 403, 407, 429].includes(res.status)) return { ok: false, manual: true, reason: 'HTTP ' + res.status + ': manual review only' };
    if (!res.ok) return { ok: false, manual: false, reason: 'HTTP ' + res.status };
    if (!/text|html|json|javascript|xml/i.test(ctype)) return { ok: false, manual: false, reason: 'Non-text content' };
    let text = await res.text();
    if (text.length > MAX_TEXT_BYTES) text = text.slice(0, MAX_TEXT_BYTES);
    return { ok: true, text };
  } catch (e) { return { ok: false, manual: true, reason: 'Fetch failed or blocked. Manual review only.' }; }
}

function extractMega(text) {
  const set = new Set();
  const raw = String(text || '');
  const variants = [raw, safeDecode(raw), decodeHtml(raw)];
  for (const src of variants) {
    const matches = src.match(MEGA_RE) || [];
    for (const m of matches) {
      const cleaned = cleanMega(m);
      if (cleaned) set.add(cleaned);
    }
  }
  return Array.from(set);
}
function cleanMega(u) { return String(u || '').replace(/&amp;/g, '&').replace(/[\]\[)}>{"'،。\s]+$/g, '').trim(); }
function safeDecode(s) { try { return decodeURIComponent(s); } catch { return s; } }
function decodeHtml(s) { return String(s || '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>'); }
function isBlockedHtml(html) { const sample = String(html || '').slice(0, 50000); return BLOCKED_TEXT.some(r => r.test(sample)); }
function titleFromHtml(html) { return strip(((String(html || '').match(/<title[^>]*>([\s\S]{1,240}?)<\/title>/i) || [])[1] || '')); }
function host(u) { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } }
function typeOfMega(u) { return /\/folder\/|#F!/i.test(u) ? 'folder' : 'file'; }
function score(mega, page) { let s = 58; const h = host(page.url); if (/rentry|paste|gist|github|telegra|reddit|notes|controlc/i.test(h)) s += 14; if (typeOfMega(mega) === 'folder') s += 8; if (/mega\.nz/i.test(page.url)) s += 8; return Math.min(98, s); }
function reasonFor(mega, page) { return `${typeOfMega(mega)} link extracted from public indexed source ${host(page.url) || 'unknown'}`; }

async function saveMega(d, mega, source, title, confidence, reason) {
  const inserted = await d.prepare('INSERT OR IGNORE INTO mega_links(mega_url,canonical_url,source_url,source_host,title,link_type,confidence,confidence_reason,hit_count,status) VALUES(?,?,?,?,?,?,?,?,1,\'active\')').bind(mega, mega, source, host(source), title || 'MEGA Link', typeOfMega(mega), confidence, reason).run();
  await d.prepare('UPDATE mega_links SET last_seen_at=CURRENT_TIMESTAMP, hit_count=hit_count+1, confidence=CASE WHEN confidence > ? THEN confidence ELSE ? END, source_url=COALESCE(source_url, ?), source_host=COALESCE(source_host, ?), title=COALESCE(title, ?), status=\'active\' WHERE mega_url=?').bind(confidence, confidence, source, host(source), title || 'MEGA Link', mega).run();
  return Number(inserted.meta && inserted.meta.changes ? inserted.meta.changes : 0) > 0;
}
async function saveManual(d, source, title, reason) {
  const inserted = await d.prepare('INSERT OR IGNORE INTO manual_sources(source_url,source_host,title,reason,status) VALUES(?,?,?,?,\'open\')').bind(source, host(source), title || 'Manual Source', reason || 'Manual review').run();
  await d.prepare('UPDATE manual_sources SET last_seen_at=CURRENT_TIMESTAMP, reason=?, title=COALESCE(title, ?), status=\'open\' WHERE source_url=?').bind(reason || 'Manual review', title || 'Manual Source', source).run();
  return Number(inserted.meta && inserted.meta.changes ? inserted.meta.changes : 0) > 0;
}
async function addManualSeeds(d) { for (const s of MANUAL_SEEDS) await saveManual(d, s, host(s), 'Reference source seed for manual review only.'); }
async function logScan(d, x) { await d.prepare('INSERT INTO scan_logs(mode,run_by,pages_collected,pages_scanned,mega_found,new_links,manual_sources,engines,cursor_before,cursor_after,message) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(x.mode, x.run_by, x.pages_collected, x.pages_scanned, x.mega_found, x.new_links, x.manual_sources, x.engines, x.cursor_before, x.cursor_after, x.message).run(); }

async function braveSearch(q, env) {
  if (!env.BRAVE_API_KEY) return [];
  const res = await fetch('https://api.search.brave.com/res/v1/web/search?q=' + encodeURIComponent(q) + '&count=20', { headers: { 'Accept': 'application/json', 'X-Subscription-Token': env.BRAVE_API_KEY } });
  if (!res.ok) return [];
  const j = await res.json().catch(() => ({}));
  return (j.web && j.web.results ? j.web.results : []).map(x => ({ url: x.url, title: strip(x.title) || 'Brave result', engine: 'brave' }));
}

async function bingRssSearch(q) {
  const xml = await fetchSearchText('https://www.bing.com/search?format=rss&q=' + encodeURIComponent(q));
  const out = [];
  const itemRe = /<item>[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<\/item>/gi;
  let m;
  while ((m = itemRe.exec(String(xml || '')))) {
    const u = decodeHtml(stripCdata(m[2]));
    if (/^https?:\/\//i.test(u) && !isNoise(u)) out.push({ url: u, title: strip(stripCdata(m[1])) || 'Bing RSS result', engine: 'bing-rss' });
    if (out.length >= 20) break;
  }
  return out;
}
function stripCdata(s) { return String(s || '').replace(/^<!\[CDATA\[/, '').replace(/\]\]>$/, '').trim(); }

async function ddgLiteSearch(q) { const html = await fetchSearchText('https://duckduckgo.com/html/?q=' + encodeURIComponent(q)); return parseResultLinks(html, 'duckduckgo'); }
async function bingSearch(q) { const html = await fetchSearchText('https://www.bing.com/search?q=' + encodeURIComponent(q)); return parseResultLinks(html, 'bing'); }
async function mojeekSearch(q) { const html = await fetchSearchText('https://www.mojeek.com/search?q=' + encodeURIComponent(q)); return parseResultLinks(html, 'mojeek'); }
async function yepSearch(q) { const html = await fetchSearchText('https://yep.com/web?q=' + encodeURIComponent(q)); return parseResultLinks(html, 'yep'); }
async function ahmiaSearch(q) { const html = await fetchSearchText('https://ahmia.fi/search/?q=' + encodeURIComponent(q)); return parseResultLinks(html, 'ahmia'); }
async function onionlandSearch(q) { const html = await fetchSearchText('https://onionland.io/search?q=' + encodeURIComponent(q)); return parseResultLinks(html, 'onionland-web'); }
async function onionengineSearch(q) { const html = await fetchSearchText('https://onionengine.com/search.php?search=' + encodeURIComponent(q)); return parseResultLinks(html, 'onionengine-web'); }
async function fetchSearchText(url) { try { const r = await fetch(url, { headers: { 'accept': 'text/html,application/rss+xml,application/xml,*/*;q=0.8' } }); if (!r.ok) return ''; let t = await r.text(); return t.slice(0, MAX_TEXT_BYTES); } catch { return ''; } }
function parseResultLinks(html, engine) {
  const out = [];
  const re = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(String(html || '')))) {
    let u = decodeHtml(m[1]);
    u = unwrapUrl(u);
    if (!/^https?:\/\//i.test(u)) continue;
    if (isNoise(u)) continue;
    out.push({ url: u, title: strip(m[2]) || engine + ' result', engine });
    if (out.length >= 25) break;
  }
  return out;
}
function unwrapUrl(u) {
  try {
    if (u.startsWith('//')) u = 'https:' + u;
    if (u.startsWith('/')) return '';
    const parsed = new URL(u);
    for (const k of ['uddg', 'u', 'url', 'q', 'r']) {
      const v = parsed.searchParams.get(k);
      if (v && /^https?:/i.test(v)) return decodeURIComponent(v);
    }
    return u;
  } catch { return u; }
}
function isNoise(u) { return /(?:duckduckgo|bing|microsoft|mojeek|yep)\.(?:com|net)\/(?:search|html|images|maps|account|ck\/?)/i.test(u); }
function strip(s) { return decodeHtml(String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()).slice(0, 220); }
function uniquePages(arr) { const seen = new Set(); const out = []; for (const x of arr) { const key = String(x.url || '').split('#')[0]; if (!key || seen.has(key)) continue; seen.add(key); out.push(x); } return out; }
function clamp(n, min, max) { n = Number(n); if (!Number.isFinite(n)) n = min; return Math.max(min, Math.min(max, n)); }

async function selectLinks(d, limit, offset, q) {
  if (q) {
    const like = '%' + q + '%';
    const r = await d.prepare('SELECT * FROM mega_links WHERE status=\'active\' AND (mega_url LIKE ? OR source_url LIKE ? OR title LIKE ? OR source_host LIKE ?) ORDER BY datetime(last_seen_at) DESC, confidence DESC, id DESC LIMIT ? OFFSET ?').bind(like, like, like, like, limit, offset).all();
    return r.results || [];
  }
  const r = await d.prepare('SELECT * FROM mega_links WHERE status=\'active\' ORDER BY datetime(last_seen_at) DESC, confidence DESC, id DESC LIMIT ? OFFSET ?').bind(limit, offset).all();
  return r.results || [];
}
async function listLinks(env, url) { const d = getDb(env); await ensureSchema(d); const limit = clamp(url.searchParams.get('limit') || 60, 10, 200); const offset = clamp(url.searchParams.get('offset') || 0, 0, 100000); const q = String(url.searchParams.get('q') || '').trim(); const total = await d.prepare('SELECT COUNT(*) AS count FROM mega_links WHERE status=\'active\'').first(); return json({ ok: true, version: VERSION, limit, offset, total: Number(total && total.count ? total.count : 0), items: await selectLinks(d, limit, offset, q) }); }
async function listManual(env, url) { const d = getDb(env); await ensureSchema(d); const limit = clamp(url.searchParams.get('limit') || 80, 10, 200); const offset = clamp(url.searchParams.get('offset') || 0, 0, 100000); const r = await d.prepare('SELECT * FROM manual_sources WHERE status=\'open\' ORDER BY datetime(last_seen_at) DESC, id DESC LIMIT ? OFFSET ?').bind(limit, offset).all(); return json({ ok: true, version: VERSION, limit, offset, items: r.results || [] }); }
async function stats(env) { const d = getDb(env); await ensureSchema(d); const links = await d.prepare('SELECT COUNT(*) AS count FROM mega_links WHERE status=\'active\'').first(); const manual = await d.prepare('SELECT COUNT(*) AS count FROM manual_sources WHERE status=\'open\'').first(); const scans = await d.prepare('SELECT * FROM scan_logs ORDER BY id DESC LIMIT 10').all(); const hosts = await d.prepare('SELECT source_host, COUNT(*) AS count FROM mega_links WHERE status=\'active\' GROUP BY source_host ORDER BY count DESC LIMIT 10').all(); return json({ ok: true, version: VERSION, links: Number(links && links.count ? links.count : 0), manual: Number(manual && manual.count ? manual.count : 0), recent_scans: scans.results || [], top_hosts: hosts.results || [] }); }
async function exportLinks(env, url) { const d = getDb(env); await ensureSchema(d); const format = String(url.searchParams.get('format') || 'json'); const r = await d.prepare('SELECT mega_url,source_url,title,link_type,confidence,confidence_reason,first_seen_at,last_seen_at,hit_count FROM mega_links WHERE status=\'active\' ORDER BY datetime(last_seen_at) DESC').all(); const rows = r.results || []; if (format === 'csv') { const csv = ['mega_url,source_url,title,link_type,confidence,first_seen_at,last_seen_at,hit_count'].concat(rows.map(x => [x.mega_url, x.source_url, x.title, x.link_type, x.confidence, x.first_seen_at, x.last_seen_at, x.hit_count].map(csvCell).join(','))).join('\n'); return new Response(csv, { headers: { 'content-type': 'text/csv;charset=utf-8', 'content-disposition': 'attachment; filename="nimbus-core-v22-export.csv"' } }); } return json({ ok: true, version: VERSION, exported_at: new Date().toISOString(), items: rows }); }
function csvCell(v) { return '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"'; }
async function deleteLink(request, env) { const body = await request.json().catch(() => ({})); const id = Number(body.id || 0); const d = getDb(env); await ensureSchema(d); await d.prepare('UPDATE mega_links SET status=\'deleted\' WHERE id=?').bind(id).run(); return json({ ok: true, id }); }
async function bulkDelete(request, env) { const body = await request.json().catch(() => ({})); const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter(Boolean).slice(0, 200) : []; const d = getDb(env); await ensureSchema(d); for (const id of ids) await d.prepare('UPDATE mega_links SET status=\'deleted\' WHERE id=?').bind(id).run(); return json({ ok: true, deleted: ids.length }); }
async function cleanup(env) { const d = getDb(env); await ensureSchema(d); let changed = 0; for (const table of ['mega_links', 'manual_sources']) { const info = await d.prepare('PRAGMA table_info(' + table + ')').all(); const cols = (info.results || []).map(x => x.name); for (const col of ['query', 'region', 'regions']) { if (cols.includes(col)) { try { const r = await d.prepare('UPDATE ' + table + ' SET ' + col + '=NULL').run(); changed += Number(r.meta && r.meta.changes ? r.meta.changes : 0); } catch {} } } } const dup = await d.prepare('DELETE FROM mega_links WHERE id NOT IN (SELECT MIN(id) FROM mega_links GROUP BY mega_url)').run(); await d.prepare('DELETE FROM manual_sources WHERE source_url IN (SELECT source_url FROM mega_links WHERE source_url IS NOT NULL)').run(); return json({ ok: true, version: VERSION, legacy_labels_removed: changed, duplicate_rows_deleted: Number(dup.meta && dup.meta.changes ? dup.meta.changes : 0), message: 'Cleanup finished. V22 uses link-first data only.' }); }
async function resetCursor(env) { const d = getDb(env); await ensureSchema(d); await setState(d, 'link-first-v22', 0); return json({ ok: true, version: VERSION, cursor: 0 }); }

function resetPage() { return new Response(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nimbus Reset</title><body style="font-family:system-ui;background:#050816;color:white;padding:24px"><h1>Nimbus Core Reset</h1><pre id="log">Resetting...</pre><script>(async()=>{const log=document.getElementById('log');try{if('caches'in window){const ks=await caches.keys();await Promise.all(ks.map(k=>caches.delete(k)));log.textContent+='\\nCaches deleted: '+ks.length}if('serviceWorker'in navigator){const rs=await navigator.serviceWorker.getRegistrations();await Promise.all(rs.map(r=>r.unregister()));log.textContent+='\\nService workers unregistered: '+rs.length}localStorage.clear();sessionStorage.clear();if(indexedDB&&indexedDB.databases){const dbs=await indexedDB.databases();for(const db of dbs){if(db.name)indexedDB.deleteDatabase(db.name)}}log.textContent+='\\nDone. Redirecting...';setTimeout(()=>location.href='/?v=22&fresh=1',1200)}catch(e){log.textContent+='\\nError: '+e.message}})()</script></body>`, { headers: { 'content-type': 'text/html;charset=utf-8', 'cache-control': 'no-store' } }); }
function json(data, status = 200) { return new Response(JSON.stringify(data, null, 2), { status, headers: { 'content-type': 'application/json;charset=utf-8', 'cache-control': 'no-store, max-age=0' } }); }
function text(data, status = 200) { return new Response(data, { status, headers: { 'content-type': 'text/plain;charset=utf-8', 'cache-control': 'no-store' } }); }
