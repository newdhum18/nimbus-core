const VERSION = "1.0.0-v10";

const MEGA_RE = /https?:\/\/(?:www\.)?(?:mega\.nz|mega\.co\.nz)\/(?:file|folder)\/[A-Za-z0-9_-]{6,}#[A-Za-z0-9_-]{8,}|https?:\/\/(?:www\.)?(?:mega\.nz|mega\.co\.nz)\/(?:#!|#F!)[A-Za-z0-9!_-]{12,}/gi;
const PROTECTED_HINTS = ["login","log in","sign in","signin","subscribe","subscription","unlock","credits","captcha","verification","register","premium","paywall","forbidden","access denied","cloudflare challenge","cf-chl","please wait","human verification"];
const BLOCKED_FILE_HINTS = /\.(png|jpe?g|webp|gif|svg|css|js|ico|woff2?|ttf|mp4|mp3|zip|rar|7z)(\?|#|$)/i;

const CLEARWEB_SOURCES = [
  "rentry.co","pastebin.com","pastelink.net","paste.ee","justpaste.it","telegra.ph","gist.github.com","github.com","reddit.com","controlc.com","pastes.io","hastebin.com","dpaste.com","notes.io","0bin.net","throwbin.io","ghostbin.co","textbin.net","paste.mozilla.org","paste.rs","paste.c-net.org","pastecode.io"
];
const DEEPWEB_CLEAR_ENGINES = [
  {name:"ahmia", base:"https://ahmia.fi/search/?q="},
  {name:"onionland", base:"https://onionland.io/search?q="},
  {name:"onionengine", base:"https://onionengine.com/search.php?search="}
];
const ONION_REFERENCES = [
  "duckduckgo onion search", "haystak onion search", "torch onion search", "tornote onion", "onionland onion", "candle onion search", "vormweb onion search", "tor66 onion search", "excavator onion search", "darksearch onion", "deepsearch onion", "recon onion", "kilos onion", "dark.fail onion search"
];
const COUNTRY_TERMS = {US:"United States OR USA", UK:"United Kingdom OR Britain OR UK", JP:"Japan OR Japanese", BR:"Brazil OR Portuguese", DE:"Germany OR German", FR:"France OR French", RU:"Russia OR Russian", IN:"India OR Hindi", KR:"Korea OR Korean"};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/login" && request.method === "POST") return login(request, env);
      if (url.pathname === "/api/ping") return withAuth(request, env, () => json({ok:true, version:VERSION, db_bound:!!env.DB, auth_pin_configured:!!env.AUTH_PIN, brave_configured:!!env.BRAVE_API_KEY, message:"API ready"}));
      if (url.pathname === "/api/session") return withAuth(request, env, () => json({ok:true, version:VERSION, session:"valid"}));
      if (url.pathname === "/api/schema") return withAuth(request, env, () => schema(env));
      if (url.pathname === "/api/latest") return withAuth(request, env, () => latest(env, url));
      if (url.pathname === "/api/protected") return withAuth(request, env, () => protectedList(env, url));
      if (url.pathname === "/api/search" && request.method === "POST") return withAuth(request, env, () => search(request, env, ctx));
      if (url.pathname === "/api/cron" && request.method === "POST") return cronEndpoint(request, env, ctx);
      if (url.pathname.startsWith("/api/")) return json({ok:false, error:"API route not found"}, 404);
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return new Response("Nimbus Core static assets are not available.", {status:404});
    } catch (err) {
      return json({ok:false, error:"Worker exception", version:VERSION, message:err?.message || String(err)}, 500);
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runAutoScan(env, ctx));
  }
};

async function login(request, env) {
  if (!env.AUTH_PIN) return json({ok:false, error:"AUTH_PIN is missing. Add Cloudflare variable AUTH_PIN."}, 500);
  const body = await request.json().catch(() => ({}));
  if (String(body.pin || "") !== String(env.AUTH_PIN)) return json({ok:false, error:"Invalid PIN"}, 401);
  const exp = Math.floor(Date.now()/1000) + 60*60*24*30;
  const payload = b64url(JSON.stringify({exp, iat:Math.floor(Date.now()/1000), v:VERSION}));
  const sig = await sign(payload, env);
  return json({ok:true, version:VERSION, token:`${payload}.${sig}`, expires:exp});
}
async function withAuth(request, env, fn) { const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""); const valid = await verifyToken(token, env); if (!valid.ok) return json({ok:false, error:"Unauthorized", reason:valid.reason}, 401); return fn(); }
async function verifyToken(token, env) { if (!env.AUTH_PIN) return {ok:false, reason:"AUTH_PIN missing"}; const parts = String(token || "").split("."); if (parts.length !== 2) return {ok:false, reason:"token missing"}; const [payload, sig] = parts; const expected = await sign(payload, env); if (sig !== expected) return {ok:false, reason:"bad signature"}; try { const data = JSON.parse(atob(payload.replace(/-/g,"+").replace(/_/g,"/"))); if (data.exp < Math.floor(Date.now()/1000)) return {ok:false, reason:"expired"}; return {ok:true}; } catch { return {ok:false, reason:"bad payload"}; } }
async function sign(payload, env) { const secret = env.AUTH_SECRET || env.AUTH_PIN; const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), {name:"HMAC", hash:"SHA-256"}, false, ["sign"]); const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload)); return b64urlBytes(new Uint8Array(sig)); }
function b64url(s) { return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,""); }
function b64urlBytes(bytes) { let s=""; for (const b of bytes) s += String.fromCharCode(b); return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,""); }

async function cronEndpoint(request, env, ctx) {
  const secret = request.headers.get("x-nimbus-cron-secret") || "";
  if (!env.CRON_SECRET || secret !== env.CRON_SECRET) return json({ok:false, error:"Unauthorized cron"}, 401);
  return runAutoScan(env, ctx);
}
async function runAutoScan(env, ctx) {
  const keywords = String(env.AUTO_KEYWORDS || "mega.nz, mega.nz/folder, mega.nz/file, rentry mega.nz").split(",").map(x => x.trim()).filter(Boolean).slice(0, 8);
  const results = [];
  for (const q of keywords) results.push(await searchCore({q, countries:["ALL"], limitPages: Number(env.AUTO_LIMIT_PAGES || 120), mode:"auto"}, env, ctx));
  return json({ok:true, version:VERSION, auto:true, runs:results.length, results});
}

async function schema(env) { const db = getDB(env); if (!db.ok) return db.response; await createTables(db.value); return json({ok:true, version:VERSION, message:"D1 schema is ready", binding:"DB"}); }
async function latest(env, url) {
  const db = getDB(env); if (!db.ok) return db.response; await createTables(db.value);
  const limit = clamp(Number(url.searchParams.get("limit") || 500), 1, 1000);
  const hours = Number(url.searchParams.get("hours") || 0);
  const binds = []; let where = "";
  if (hours > 0) { where = `WHERE datetime(discovered_at) >= datetime('now', ?)`; binds.push(`-${hours} hours`); }
  const items = await db.value.prepare(`SELECT * FROM mega_links ${where} ORDER BY datetime(discovered_at) DESC, id DESC LIMIT ?`).bind(...binds, limit).all();
  const total = await db.value.prepare(`SELECT COUNT(*) AS count FROM mega_links ${where}`).bind(...binds).first();
  const last = await db.value.prepare(`SELECT created_at FROM scan_logs ORDER BY id DESC LIMIT 1`).first();
  return json({ok:true, version:VERSION, total:total?.count || 0, items:items.results || [], lastScan:last?.created_at || "--"});
}
async function protectedList(env, url) { const db = getDB(env); if (!db.ok) return db.response; await createTables(db.value); const limit = clamp(Number(url.searchParams.get("limit") || 300), 1, 1000); const items = await db.value.prepare(`SELECT * FROM protected_sources ORDER BY datetime(discovered_at) DESC, id DESC LIMIT ?`).bind(limit).all(); const total = await db.value.prepare(`SELECT COUNT(*) AS count FROM protected_sources`).first(); return json({ok:true, version:VERSION, total:total?.count || 0, items:items.results || []}); }
async function search(request, env, ctx) { const body = await request.json().catch(() => ({})); return json(await searchCore(body, env, ctx)); }

async function searchCore(body, env, ctx) {
  const db = getDB(env); if (!db.ok) return {ok:false, error:"D1 binding DB is missing"}; await createTables(db.value);
  const q = String(body.q || "").trim();
  const countries = Array.isArray(body.countries) && body.countries.length ? body.countries : ["ALL"];
  const limitPages = clamp(Number(body.limitPages || 140), 30, 260);
  const queries = buildQueries(q, countries);
  const engineStats = {};
  let pages = [];

  for (const query of queries) {
    const tasks = [
      braveSearch(query, env),
      duckSearch(query),
      bingSearch(query),
      ahmiaSearch(query),
      genericSearch("onionland", "https://onionland.io/search?q=" + encodeURIComponent(query)),
      genericSearch("onionengine", "https://onionengine.com/search.php?search=" + encodeURIComponent(query))
    ];
    const results = await Promise.allSettled(tasks);
    for (const r of results) if (r.status === "fulfilled") { pages.push(...r.value); for (const p of r.value) engineStats[p.engine] = (engineStats[p.engine] || 0) + 1; }
    pages = dedupePages(pages);
    if (pages.length >= limitPages * 2) break;
  }

  pages.push(...directSeedPages(q));
  pages = rankPages(dedupePages(pages), q).slice(0, limitPages);

  let megaFound=0, protectedFound=0, scanned=0, newLinks=0, seenLinks=0;
  const scanLimit = pLimit(6);
  const inspected = await Promise.all(pages.map(page => scanLimit(() => inspectPage(page, q, db.value))));
  for (const r of inspected) { scanned++; megaFound += r.mega || 0; protectedFound += r.protected || 0; newLinks += r.newLinks || 0; seenLinks += r.seenLinks || 0; }

  await db.value.prepare(`INSERT INTO scan_logs(query,regions,pages_scanned,mega_found,protected_found) VALUES(?,?,?,?,?)`).bind(q || "auto", countries.join(","), scanned, megaFound, protectedFound).run();
  const items = await db.value.prepare(q ? `SELECT * FROM mega_links WHERE query=? ORDER BY datetime(discovered_at) DESC, id DESC LIMIT 300` : `SELECT * FROM mega_links ORDER BY datetime(discovered_at) DESC, id DESC LIMIT 300`).bind(...(q ? [q] : [])).all();
  const latestTotal = await db.value.prepare(`SELECT COUNT(*) AS count FROM mega_links`).first();
  const protectedTotal = await db.value.prepare(`SELECT COUNT(*) AS count FROM protected_sources`).first();
  return {ok:true, version:VERSION, mode:"v10_multi_engine_public_discovery", query:q || "auto", countries, queries_used:queries.length, search_results_collected:pages.length, pages_scanned:scanned, mega_found:megaFound, protected_found:protectedFound, new_links:newLinks, seen_links:seenLinks, engine_stats:engineStats, latest_total:latestTotal?.count || 0, protected_total:protectedTotal?.count || 0, scan_time:new Date().toISOString(), items:items.results || [], note:"V10 uses Brave API when BRAVE_API_KEY exists, plus public web indexes and clear-web onion indexes. Direct .onion fetching requires Tor and is not performed by this Cloudflare Worker."};
}

async function createTables(db) {
  await db.prepare(`CREATE TABLE IF NOT EXISTS mega_links (id INTEGER PRIMARY KEY AUTOINCREMENT, mega_url TEXT UNIQUE NOT NULL, source_url TEXT, title TEXT, query TEXT, region TEXT, discovered_at TEXT DEFAULT CURRENT_TIMESTAMP, last_seen_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS protected_sources (id INTEGER PRIMARY KEY AUTOINCREMENT, source_url TEXT UNIQUE NOT NULL, title TEXT, reason TEXT, query TEXT, region TEXT, discovered_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS scan_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, query TEXT, regions TEXT, pages_scanned INTEGER DEFAULT 0, mega_found INTEGER DEFAULT 0, protected_found INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
}

function buildQueries(q, countries) {
  const geo = (countries || []).includes("ALL") ? [""] : [...(countries || []).map(c => COUNTRY_TERMS[c]).filter(Boolean), ""];
  const keyword = q ? [`"${q}"`, q] : [""];
  const megaTerms = [`"mega.nz/folder/"`, `"mega.nz/file/"`, `"mega.nz"`, `"mega.co.nz"`];
  const out = [];
  for (const g of geo.slice(0, 10)) for (const k of keyword) for (const m of megaTerms) out.push([k, m, g].filter(Boolean).join(" "));
  for (const site of CLEARWEB_SOURCES) for (const k of keyword) { out.push(`site:${site} ${k} "mega.nz"`.trim()); out.push(`site:${site} ${k} "mega.nz/folder/"`.trim()); out.push(`site:${site} ${k} "mega.nz/file/"`.trim()); }
  for (const engine of ["ahmia.fi", "onionland.io", "onionengine.com", "dark.fail"]) for (const k of keyword) out.push(`site:${engine} ${k} "mega.nz"`.trim());
  for (const ref of ONION_REFERENCES) for (const k of keyword) out.push(`${k} ${ref} "mega.nz"`.trim());
  out.push(`"mega.nz/folder/" "download" -logo -wordmark`);
  out.push(`"mega.nz/file/" "download" -logo -wordmark`);
  return [...new Set(out.map(x => x.replace(/\s+/g," ").trim()).filter(Boolean))].slice(0, 120);
}
function directSeedPages(q) { const seeds = []; if (q) seeds.push({url:`https://rentry.co/${encodeURIComponent(q)}`, title:"Rentry direct guess", query:q, engine:"direct_seed"}); return seeds; }

async function braveSearch(query, env) {
  if (!env.BRAVE_API_KEY) return [];
  try {
    const res = await fetch("https://api.search.brave.com/res/v1/web/search?q=" + encodeURIComponent(query) + "&count=20&search_lang=en&safe_search=off", {headers:{"Accept":"application/json", "X-Subscription-Token":env.BRAVE_API_KEY}});
    if (!res.ok) return [];
    const data = await res.json();
    return (data.web?.results || []).map(x => ({url:x.url, title:x.title || "Brave Result", query, engine:"brave"})).filter(validPage).slice(0, 20);
  } catch { return []; }
}
async function duckSearch(query) { try { const res = await fetch("https://html.duckduckgo.com/html/?q=" + encodeURIComponent(query), {headers:{"User-Agent":"Mozilla/5.0", "Accept":"text/html"}}); const html = await res.text(); const out = []; const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gsi; let m; while ((m = re.exec(html)) !== null) { const href = cleanDuckUrl(decodeHtml(m[1])); const title = stripTags(decodeHtml(m[2])); if (href) out.push({url:href, title:title || "DuckDuckGo Result", query, engine:"duckduckgo"}); } return out.filter(validPage).slice(0, 15); } catch { return []; } }
async function bingSearch(query) { try { const res = await fetch("https://www.bing.com/search?q=" + encodeURIComponent(query) + "&count=20", {headers:{"User-Agent":"Mozilla/5.0", "Accept":"text/html"}}); const html = await res.text(); const out = []; const re = /<li class="b_algo"[\s\S]*?<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gsi; let m; while ((m = re.exec(html)) !== null) { const href = decodeHtml(m[1]); const title = stripTags(decodeHtml(m[2])); if (href) out.push({url:href, title:title || "Bing Result", query, engine:"bing"}); } return out.filter(validPage).slice(0, 15); } catch { return []; } }
async function ahmiaSearch(query) { return genericSearch("ahmia", "https://ahmia.fi/search/?q=" + encodeURIComponent(query)); }
async function genericSearch(engine, url) {
  try { const res = await fetch(url, {headers:{"User-Agent":"Mozilla/5.0 NimbusCore", "Accept":"text/html"}}); const html = await res.text(); const out = []; const re = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gsi; let m; while ((m = re.exec(html)) !== null) { const href = absolutize(decodeHtml(m[1]), url); const title = stripTags(decodeHtml(m[2])); if (href && validPage({url:href})) out.push({url:href, title:title || `${engine} result`, query:url, engine}); } return out.slice(0, 18); } catch { return []; }
}

async function inspectPage(page, q, db) {
  let mega=0, protectedCount=0, newLinks=0, seenLinks=0;
  const direct = extractMega(page.url + " " + (page.title || ""));
  for (const link of direct) { const saved = await saveMega(db, link, page.url, page.title, q); mega++; saved ? newLinks++ : seenLinks++; }
  if (!validPage(page) || String(page.url).includes(".onion")) return {mega, protected:0, newLinks, seenLinks};
  try {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 9000);
    const res = await fetch(page.url, {signal:controller.signal, redirect:"follow", headers:{"User-Agent":"Mozilla/5.0 NimbusCore/10", "Accept":"text/html,text/plain,application/json,*/*"}});
    clearTimeout(timer);
    const status = res.status; const type = (res.headers.get("content-type") || "").toLowerCase(); let text="";
    if (type.includes("text") || type.includes("html") || type.includes("json") || type === "") text = (await res.text()).slice(0, 1200000);
    const links = extractMega(text);
    for (const link of links) { const saved = await saveMega(db, link, page.url, page.title, q); mega++; saved ? newLinks++ : seenLinks++; }
    if (links.length === 0 && direct.length === 0 && (status === 401 || status === 402 || status === 403 || isProtected(text, page.url))) { const saved = await saveProtected(db, page.url, page.title, reasonFrom(status, text), q); if (saved) protectedCount++; }
  } catch {}
  return {mega, protected:protectedCount, newLinks, seenLinks};
}

async function saveMega(db, mega, source, title, q) { const r = await db.prepare(`INSERT OR IGNORE INTO mega_links(mega_url,source_url,title,query,region) VALUES(?,?,?,?,?)`).bind(mega, source, title || "Search Result", q || "auto", "global").run(); await db.prepare(`UPDATE mega_links SET last_seen_at=CURRENT_TIMESTAMP, source_url=COALESCE(source_url, ?), title=COALESCE(title, ?) WHERE mega_url=?`).bind(source, title || "Search Result", mega).run(); return (r.meta?.changes || 0) > 0; }
async function saveProtected(db, source, title, reason, q) { const r = await db.prepare(`INSERT OR IGNORE INTO protected_sources(source_url,title,reason,query,region) VALUES(?,?,?,?,?)`).bind(source, title || "Protected Source", reason, q || "auto", "global").run(); return (r.meta?.changes || 0) > 0; }
function extractMega(text) { const matches = String(text || "").match(MEGA_RE) || []; return [...new Set(matches.map(cleanMega).filter(isRealMega))]; }
function cleanMega(x) { return String(x).replace(/&amp;/g,"&").replace(/%23/g,"#").replace(/["'<>)\]}،؛\s]+$/g,"").trim(); }
function isRealMega(x) { const l = String(x || "").toLowerCase(); return (l.includes("mega.nz/file/") || l.includes("mega.nz/folder/") || l.includes("mega.co.nz/") || l.includes("mega.nz/#!") || l.includes("mega.nz/#f!")) && !/(example|xxxx|placeholder|demo|wordmark|logo)/i.test(l); }
function isProtected(text, url) { const t = (String(text || "") + " " + url).toLowerCase(); return PROTECTED_HINTS.some(w => t.includes(w)); }
function reasonFrom(status, text) { if (status === 401) return "Login required"; if (status === 403) return "Access forbidden"; if (status === 402) return "Payment required"; const t = String(text || "").toLowerCase(); if (t.includes("captcha") || t.includes("verification")) return "Captcha or verification"; if (t.includes("credits")) return "Credits required"; if (t.includes("unlock")) return "Unlock required"; if (t.includes("subscribe") || t.includes("subscription")) return "Subscription required"; if (t.includes("login") || t.includes("sign in")) return "Login required"; return "Protected or restricted"; }
function validPage(p) { try { const u = new URL(p.url); if (!/^https?:$/.test(u.protocol)) return false; if (BLOCKED_FILE_HINTS.test(u.pathname)) return false; return true; } catch { return false; } }
function rankPages(items, q) { const qq = String(q || "").toLowerCase(); return items.sort((a,b) => scorePage(b,qq) - scorePage(a,qq)); }
function scorePage(p, q) { const s = ((p.url || "") + " " + (p.title || "")).toLowerCase(); let n = 0; if (s.includes("mega.nz")) n += 100; if (s.includes("rentry.co")) n += 30; if (CLEARWEB_SOURCES.some(x => s.includes(x))) n += 20; if (q && s.includes(q)) n += 25; if (p.engine === "brave") n += 12; if (p.engine === "ahmia") n += 10; if (s.includes("/search") || s.includes("?q=")) n -= 15; return n; }
function dedupePages(items) { const seen = new Set(), out = []; for (const item of items) { try { const u = new URL(item.url); u.hash = ""; const clean = u.href; if (!seen.has(clean) && validPage({url:clean})) { seen.add(clean); out.push({...item, url:clean}); } } catch {} } return out; }
function cleanDuckUrl(href) { try { href = href.replace(/&amp;/g,"&"); if (href.includes("/l/?")) { const u = new URL("https://duckduckgo.com" + href); return decodeURIComponent(u.searchParams.get("uddg") || ""); } return href; } catch { return ""; } }
function absolutize(href, base) { try { if (href.startsWith("//")) return "https:" + href; return new URL(href, base).href; } catch { return ""; } }
function decodeHtml(x) { return String(x).replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#x2F;/g,"/").replace(/&#39;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">"); }
function stripTags(x) { return String(x).replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim(); }
function getDB(env) { if (!env.DB) return {ok:false, response:json({ok:false, error:"D1 binding DB is missing"},500)}; return {ok:true, value:env.DB}; }
function clamp(n, min, max) { return Math.max(min, Math.min(max, Number.isFinite(n) ? n : min)); }
function json(data, status=200) { return new Response(JSON.stringify(data, null, 2), {status, headers:{"content-type":"application/json;charset=utf-8", "cache-control":"no-store", "access-control-allow-origin":"*"}}); }
function pLimit(concurrency) { const queue=[]; let active=0; const next=()=>{ active--; if(queue.length) queue.shift()(); }; return fn => new Promise((resolve,reject)=>{ const run=()=>{ active++; Promise.resolve(fn()).then(resolve,reject).finally(next); }; active < concurrency ? run() : queue.push(run); }); }
