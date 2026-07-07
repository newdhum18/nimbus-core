const VERSION = '20.0.0-link-first-cleanroom';
const CACHE_BUST = 'v20';
const MEGA_PATTERNS = [
  '"https://mega.nz/folder/"', '"https://mega.nz/file/"', '"mega.nz/folder/" "#"', '"mega.nz/file/" "#"',
  '"mega.nz/#F!"', '"mega.nz/#!"', '"mega.nz" "/folder/"', '"mega.nz" "/file/"',
  '"mega.nz/folder/" "rentry.co"', '"mega.nz/file/" "rentry.co"', '"mega.nz/folder/" "paste"', '"mega.nz/file/" "paste"',
  'site:rentry.co "mega.nz/folder/"', 'site:rentry.co "mega.nz/file/"', 'site:pastebin.com "mega.nz/folder/"', 'site:pastebin.com "mega.nz/file/"',
  'site:telegra.ph "mega.nz/folder/"', 'site:github.com "mega.nz/folder/"', 'site:reddit.com "mega.nz/folder/"', 'site:ofversedrops.com "mega.nz"'
];
const SOURCE_SEEDS = ['https://rentry.co','https://pastebin.com','https://telegra.ph','https://gist.github.com','https://github.com','https://reddit.com','https://ofversedrops.com','https://ahmia.fi','https://onionland.io','https://onionengine.com','https://dark.fail'];
const BLOCKED_REASONS = [/login/i,/sign in/i,/subscribe/i,/paywall/i,/captcha/i,/unlock/i,/credits/i,/permission/i,/forbidden/i,/cloudflare/i,/verify you are human/i];
const MEGA_RE = /https?:\/\/(?:www\.)?mega\.nz\/(?:folder\/[-_a-zA-Z0-9]+(?:#[!_\-$a-zA-Z0-9]+)?|file\/[-_a-zA-Z0-9]+(?:#[!_\-$a-zA-Z0-9]+)?|#F![!_\-$a-zA-Z0-9]+|#![!_\-$a-zA-Z0-9]+)/g;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/login' && request.method === 'POST') return login(request, env);
      if (url.pathname.startsWith('/api/')) {
        return withAuth(request, env, async () => routeApi(request, env, ctx, url));
      }
      if (env.ASSETS) {
        const res = await env.ASSETS.fetch(request);
        const headers = new Headers(res.headers);
        if (url.pathname === '/' || /\.(html|js|css)$/.test(url.pathname)) headers.set('cache-control','no-store, max-age=0');
        return new Response(res.body, {status: res.status, headers});
      }
      return text('Nimbus Core V20 assets unavailable', 404);
    } catch (err) {
      return json({ok:false, version:VERSION, error:'worker_exception', message:String(err?.message || err)}, 500);
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil((async()=>{ if (env.CRON_ENABLED === 'true') await runScan(env, {limitPages: Number(env.CRON_LIMIT || 60), runBy:'cron'}); })());
  }
};

async function routeApi(request, env, ctx, url) {
  if (url.pathname === '/api/session') return json({ok:true, version:VERSION, session:'valid'});
  if (url.pathname === '/api/ping') return json({ok:true, version:VERSION, db_bound:!!env.DB, auth_pin_configured:!!env.AUTH_PIN, brave_enabled:!!env.BRAVE_API_KEY, policy:'public-indexed-link-first-only'});
  if (url.pathname === '/api/schema') return schema(env);
  if (url.pathname === '/api/search' && request.method === 'POST') return search(request, env);
  if (url.pathname === '/api/latest') return listLinks(env, url, false);
  if (url.pathname === '/api/archive') return listLinks(env, url, true);
  if (url.pathname === '/api/manual-sources') return listManual(env, url);
  if (url.pathname === '/api/stats') return stats(env);
  if (url.pathname === '/api/export') return exportArchive(env, url);
  if (url.pathname === '/api/delete-link' && request.method === 'POST') return deleteLink(request, env);
  if (url.pathname === '/api/bulk-delete' && request.method === 'POST') return bulkDelete(request, env);
  if (url.pathname === '/api/cleanup' && request.method === 'POST') return cleanup(env);
  if (url.pathname === '/api/reset-cursor' && request.method === 'POST') return resetCursor(env);
  return json({ok:false, error:'api_route_not_found'}, 404);
}

async function login(request, env) {
  const body = await request.json().catch(()=>({}));
  const pin = String(body.pin || '');
  if (!env.AUTH_PIN) return json({ok:false, error:'AUTH_PIN_missing'}, 500);
  if (pin !== String(env.AUTH_PIN)) return json({ok:false, error:'invalid_pin'}, 401);
  const exp = Date.now() + 1000*60*60*24*14;
  const token = await signToken({exp, v:VERSION}, env);
  return json({ok:true, token, expires_at:new Date(exp).toISOString(), version:VERSION});
}
async function withAuth(request, env, fn) {
  if (!env.AUTH_PIN) return json({ok:false, error:'AUTH_PIN_missing'}, 500);
  const auth = request.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i,'');
  if (!token || !(await verifyToken(token, env))) return json({ok:false, error:'unauthorized'}, 401);
  return fn();
}
async function signToken(payload, env) {
  const secret = env.AUTH_SECRET || env.AUTH_PIN;
  const body = btoa(JSON.stringify(payload)).replace(/=+$/,'');
  const sig = await hmac(body, secret);
  return `${body}.${sig}`;
}
async function verifyToken(token, env) {
  const [body, sig] = token.split('.');
  if (!body || !sig) return false;
  if (await hmac(body, env.AUTH_SECRET || env.AUTH_PIN) !== sig) return false;
  const p = JSON.parse(atob(body));
  return Number(p.exp || 0) > Date.now();
}
async function hmac(data, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), {name:'HMAC', hash:'SHA-256'}, false, ['sign']);
  const buf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
}

function db(env){ if(!env.DB) throw new Error('D1 DB binding named DB is missing'); return env.DB; }
async function schema(env){ const d=db(env); await createTables(d); return json({ok:true, version:VERSION, message:'schema_ready'}); }
async function createTables(d) {
  await d.prepare(`CREATE TABLE IF NOT EXISTS mega_links (id INTEGER PRIMARY KEY AUTOINCREMENT, mega_url TEXT UNIQUE NOT NULL, canonical_url TEXT, source_url TEXT, source_host TEXT, title TEXT, link_type TEXT, confidence INTEGER DEFAULT 50, confidence_reason TEXT, first_seen_at TEXT DEFAULT CURRENT_TIMESTAMP, last_seen_at TEXT DEFAULT CURRENT_TIMESTAMP, hit_count INTEGER DEFAULT 1, status TEXT DEFAULT 'active')`).run();
  await d.prepare(`CREATE TABLE IF NOT EXISTS manual_sources (id INTEGER PRIMARY KEY AUTOINCREMENT, source_url TEXT UNIQUE NOT NULL, source_host TEXT, title TEXT, reason TEXT, first_seen_at TEXT DEFAULT CURRENT_TIMESTAMP, last_seen_at TEXT DEFAULT CURRENT_TIMESTAMP, status TEXT DEFAULT 'open')`).run();
  await d.prepare(`CREATE TABLE IF NOT EXISTS scan_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, mode TEXT, run_by TEXT, pages_collected INTEGER DEFAULT 0, pages_scanned INTEGER DEFAULT 0, mega_found INTEGER DEFAULT 0, new_links INTEGER DEFAULT 0, manual_sources INTEGER DEFAULT 0, engines TEXT, cursor_before INTEGER, cursor_after INTEGER, message TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await d.prepare(`CREATE TABLE IF NOT EXISTS scan_state (id TEXT PRIMARY KEY, cursor INTEGER DEFAULT 0, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await d.prepare(`CREATE INDEX IF NOT EXISTS idx_mega_last ON mega_links(last_seen_at DESC)`).run();
  await d.prepare(`CREATE INDEX IF NOT EXISTS idx_mega_host ON mega_links(source_host)`).run();
  await d.prepare(`CREATE INDEX IF NOT EXISTS idx_manual_last ON manual_sources(last_seen_at DESC)`).run();
}

async function search(request, env){
  const body = await request.json().catch(()=>({}));
  const manual = String(body.q || '').trim();
  if (manual) return manualSearch(env, manual, Number(body.limitPages || 50));
  return runScan(env, {limitPages:Number(body.limitPages || 90), runBy:'user'});
}
async function runScan(env, opts={}) {
  const d=db(env); await createTables(d);
  const limitPages = clamp(opts.limitPages || 90, 10, 180);
  const state = await getState(d, 'link-first');
  const cursorBefore = state.cursor;
  const queries = nextQueries(cursorBefore, 10);
  const cursorAfter = cursorBefore + queries.length;
  await setState(d, 'link-first', cursorAfter);
  let collected=[]; const engines=new Set();
  for (const q of queries) {
    const packs = await Promise.allSettled([braveSearch(q, env), ddgSearch(q), bingSearch(q), mojeekSearch(q), yepSearch(q), ahmiaSearch(q), onionlandSearch(q), onionengineSearch(q)]);
    for (const p of packs) if (p.status === 'fulfilled') for (const item of p.value) { collected.push(item); engines.add(item.engine); }
    if (collected.length >= limitPages * 3) break;
  }
  collected = uniquePages(collected).slice(0, limitPages);
  let pagesScanned=0, megaFound=0, newLinks=0, manualSources=0;
  for (const page of collected) {
    const r = await inspectPage(d, page);
    pagesScanned++; megaFound += r.found; newLinks += r.newLinks; manualSources += r.manual;
  }
  await addKnownManualSeeds(d);
  await d.prepare(`INSERT INTO scan_logs(mode,run_by,pages_collected,pages_scanned,mega_found,new_links,manual_sources,engines,cursor_before,cursor_after,message) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind('link-first-url-shape', opts.runBy||'user', collected.length, pagesScanned, megaFound, newLinks, manualSources, [...engines].join(','), cursorBefore, cursorAfter, 'Public indexed scan only. No bypass, no login, no captcha, no paywall access.').run();
  const items = await d.prepare(`SELECT * FROM mega_links WHERE status='active' ORDER BY datetime(last_seen_at) DESC, confidence DESC, id DESC LIMIT 250`).all();
  return json({ok:true, version:VERSION, mode:'link-first-url-shape', cursor_before:cursorBefore, cursor_after:cursorAfter, queries_used:queries.length, engines_used:[...engines], pages_collected:collected.length, pages_scanned:pagesScanned, mega_found:megaFound, new_links:newLinks, manual_sources:manualSources, items:items.results || []});
}
async function manualSearch(env, q, limit){
  const d=db(env); await createTables(d);
  const queries = [`${q} "mega.nz/folder/"`, `${q} "mega.nz/file/"`, `site:rentry.co ${q} "mega.nz"`, `site:pastebin.com ${q} "mega.nz"`];
  let pages=[]; const engines=new Set();
  for (const query of queries) {
    const packs = await Promise.allSettled([braveSearch(query, env), ddgSearch(query), bingSearch(query)]);
    for (const p of packs) if (p.status === 'fulfilled') for (const item of p.value) { pages.push(item); engines.add(item.engine); }
  }
  pages = uniquePages(pages).slice(0, clamp(limit, 10, 120));
  let megaFound=0,newLinks=0,manualSources=0;
  for (const p of pages) { const r=await inspectPage(d,p); megaFound+=r.found; newLinks+=r.newLinks; manualSources+=r.manual; }
  await d.prepare(`INSERT INTO scan_logs(mode,run_by,pages_collected,pages_scanned,mega_found,new_links,manual_sources,engines,message) VALUES(?,?,?,?,?,?,?,?,?)`).bind('manual-keyword-plus-link-shape','user',pages.length,pages.length,megaFound,newLinks,manualSources,[...engines].join(','),'Manual search is separated from Auto Scan.').run();
  const items = await d.prepare(`SELECT * FROM mega_links WHERE status='active' ORDER BY datetime(last_seen_at) DESC, confidence DESC LIMIT 250`).all();
  return json({ok:true, version:VERSION, mode:'manual-separated', pages_scanned:pages.length, mega_found:megaFound, new_links:newLinks, manual_sources:manualSources, items:items.results || []});
}
function nextQueries(cursor, count){ const out=[]; for(let i=0;i<count;i++) out.push(MEGA_PATTERNS[(cursor+i)%MEGA_PATTERNS.length]); return out; }
async function getState(d,id){ const row=await d.prepare(`SELECT cursor FROM scan_state WHERE id=?`).bind(id).first(); return {cursor:Number(row?.cursor || 0)}; }
async function setState(d,id,cursor){ await d.prepare(`INSERT INTO scan_state(id,cursor,updated_at) VALUES(?,?,CURRENT_TIMESTAMP) ON CONFLICT(id) DO UPDATE SET cursor=excluded.cursor, updated_at=CURRENT_TIMESTAMP`).bind(id,cursor).run(); }

async function inspectPage(d, page){
  let manual=0, found=0, newLinks=0;
  if (!/^https?:\/\//i.test(page.url)) return {found, newLinks, manual};
  if (/\.onion\b/i.test(page.url)) { await saveManual(d, page.url, page.title, 'Tor-only source. Open manually in Tor.'); return {found, newLinks, manual:1}; }
  const direct = extractMega(page.url);
  if (direct.length) for (const m of direct) { const saved=await saveMega(d, m, page.url, page.title, score(m,page), 'MEGA URL found directly in search result URL'); found++; if(saved)newLinks++; }
  try {
    const res = await fetch(page.url, {headers:{'user-agent':'NimbusCoreV20-PublicLinkIndexer/1.0 (+public indexed link discovery; no bypass)'}});
    const ctype = res.headers.get('content-type') || '';
    if (!res.ok) { if ([401,403,429].includes(res.status)) { await saveManual(d, page.url, page.title, `HTTP ${res.status}: manual review only`); manual++; } return {found,newLinks,manual}; }
    if (!/text|html|json|javascript|xml/i.test(ctype)) return {found,newLinks,manual};
    const html = await res.text();
    if (isBlockedHtml(html)) { await saveManual(d, page.url, page.title || titleFromHtml(html), 'Login/paywall/captcha/unlock signal detected. No bypass attempted.'); manual++; return {found,newLinks,manual}; }
    const links = extractMega(html);
    for (const m of links) { const saved=await saveMega(d, m, page.url, page.title || titleFromHtml(html), score(m,page), reasonFor(m,page)); found++; if(saved)newLinks++; }
    if (!links.length && /mega\.nz/i.test(html)) { await saveManual(d, page.url, page.title || titleFromHtml(html), 'MEGA text found but no valid full URL extracted'); manual++; }
  } catch(e) { await saveManual(d, page.url, page.title, 'Fetch failed or blocked. Manual review only.'); manual++; }
  return {found,newLinks,manual};
}
function extractMega(text){ const set=new Set(); const decoded = safeDecode(text || ''); for (const src of [String(text||''), decoded]) { const matches = src.match(MEGA_RE) || []; for (let m of matches) set.add(cleanMega(m)); } return [...set].filter(Boolean); }
function cleanMega(u){ return u.replace(/&amp;/g,'&').replace(/[\])}>"'،。]+$/g,'').trim(); }
function safeDecode(s){ try { return decodeURIComponent(s); } catch { return s; } }
function isBlockedHtml(html){ const sample=html.slice(0,30000); return BLOCKED_REASONS.some(r=>r.test(sample)); }
function titleFromHtml(html){ return ((html.match(/<title[^>]*>([^<]{1,180})<\/title>/i)||[])[1]||'Public source').replace(/\s+/g,' ').trim(); }
function host(u){ try { return new URL(u).hostname.replace(/^www\./,''); } catch { return ''; } }
function typeOfMega(u){ return /\/folder\/|#F!/i.test(u) ? 'folder' : 'file'; }
function score(mega,page){ let s=55; const h=host(page.url); if (/rentry|paste|gist|github|telegra/i.test(h)) s+=15; if (typeOfMega(mega)==='folder') s+=10; if (/mega\.nz/i.test(page.url)) s+=10; return Math.min(98,s); }
function reasonFor(mega,page){ return `${typeOfMega(mega)} link extracted from public indexed source ${host(page.url) || 'unknown'}`; }
async function saveMega(d, mega, source, title, confidence, reason){
  const canonical = mega;
  const r=await d.prepare(`INSERT OR IGNORE INTO mega_links(mega_url,canonical_url,source_url,source_host,title,link_type,confidence,confidence_reason) VALUES(?,?,?,?,?,?,?,?)`).bind(mega,canonical,source,host(source),title||'MEGA Link',typeOfMega(mega),confidence,reason).run();
  await d.prepare(`UPDATE mega_links SET last_seen_at=CURRENT_TIMESTAMP, hit_count=hit_count+1, confidence=MAX(confidence, ?), source_url=COALESCE(source_url, ?), source_host=COALESCE(source_host, ?), title=COALESCE(title, ?), status='active' WHERE mega_url=?`).bind(confidence,source,host(source),title||'MEGA Link',mega).run();
  return (r.meta?.changes || 0) > 0;
}
async function saveManual(d, source, title, reason){
  const r=await d.prepare(`INSERT OR IGNORE INTO manual_sources(source_url,source_host,title,reason) VALUES(?,?,?,?)`).bind(source,host(source),title||'Manual Source',reason).run();
  await d.prepare(`UPDATE manual_sources SET last_seen_at=CURRENT_TIMESTAMP, reason=COALESCE(reason, ?), status='open' WHERE source_url=?`).bind(reason, source).run();
  return (r.meta?.changes || 0) > 0;
}
async function addKnownManualSeeds(d){ for (const s of SOURCE_SEEDS) await saveManual(d, s, host(s), 'Reference source seed for manual review, not a protected result.'); }

async function braveSearch(q, env){ if(!env.BRAVE_API_KEY) return []; const r=await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=20`,{headers:{'Accept':'application/json','X-Subscription-Token':env.BRAVE_API_KEY}}); if(!r.ok)return[]; const j=await r.json(); return (j.web?.results||[]).map(x=>({url:x.url,title:strip(x.title)||'Brave result',engine:'brave'})); }
async function ddgSearch(q){ const html=await fetchText(`https://duckduckgo.com/html/?q=${encodeURIComponent(q)}`); return parseLinks(html,'duckduckgo'); }
async function bingSearch(q){ const html=await fetchText(`https://www.bing.com/search?q=${encodeURIComponent(q)}`); return parseLinks(html,'bing'); }
async function mojeekSearch(q){ const html=await fetchText(`https://www.mojeek.com/search?q=${encodeURIComponent(q)}`); return parseLinks(html,'mojeek'); }
async function yepSearch(q){ const html=await fetchText(`https://yep.com/web?q=${encodeURIComponent(q)}`); return parseLinks(html,'yep'); }
async function ahmiaSearch(q){ const html=await fetchText(`https://ahmia.fi/search/?q=${encodeURIComponent(q)}`); return parseLinks(html,'ahmia'); }
async function onionlandSearch(q){ const html=await fetchText(`https://onionland.io/search?q=${encodeURIComponent(q)}`); return parseLinks(html,'onionland-web'); }
async function onionengineSearch(q){ const html=await fetchText(`https://onionengine.com/search.php?search=${encodeURIComponent(q)}`); return parseLinks(html,'onionengine-web'); }
async function fetchText(url){ try{ const r=await fetch(url,{headers:{'user-agent':'NimbusCoreV20-PublicSearch/1.0'}}); if(!r.ok)return ''; return await r.text(); }catch{return '';} }
function parseLinks(html, engine){ const out=[]; const re=/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi; let m; while((m=re.exec(html||''))){ let u=decodeHtml(m[1]); u=unwrapSearchUrl(u); if(!/^https?:\/\//i.test(u)) continue; if (/duckduckgo\.com\/y\.js/i.test(u)) u=unwrapSearchUrl(u); if (isNoise(u)) continue; out.push({url:u,title:strip(m[2])||engine+' result',engine}); if(out.length>=30)break; } return out; }
function unwrapSearchUrl(u){ try{ if(u.startsWith('//'))u='https:'+u; if(u.startsWith('/')) return ''; const url=new URL(u); for(const k of ['uddg','u','url','q','r']){ const v=url.searchParams.get(k); if(v && /^https?:/i.test(v)) return decodeURIComponent(v); } return u; }catch{return u;} }
function isNoise(u){ return /(?:duckduckgo|bing|microsoft|mojeek|yep)\.(?:com|net)\/(?:search|html|images|maps|account)/i.test(u); }
function strip(s){ return decodeHtml(String(s||'').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim()).slice(0,220); }
function decodeHtml(s){ return String(s||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>'); }
function uniquePages(arr){ const seen=new Set(); const out=[]; for(const x of arr){ const k=(x.url||'').split('#')[0]; if(!k||seen.has(k))continue; seen.add(k); out.push(x); } return out; }
function clamp(n,min,max){ n=Number.isFinite(n)?n:min; return Math.max(min,Math.min(max,n)); }

async function listLinks(env,url,archive){ const d=db(env); await createTables(d); const limit=clamp(Number(url.searchParams.get('limit')||60),10,200); const offset=clamp(Number(url.searchParams.get('offset')||0),0,100000); const q=String(url.searchParams.get('q')||'').trim(); const where=q?`WHERE status='active' AND (mega_url LIKE ? OR source_url LIKE ? OR title LIKE ? OR source_host LIKE ?)`:`WHERE status='active'`; const binds=q?[`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`,limit,offset]:[limit,offset]; const rows=await d.prepare(`SELECT * FROM mega_links ${where} ORDER BY datetime(last_seen_at) DESC, confidence DESC, id DESC LIMIT ? OFFSET ?`).bind(...binds).all(); const total=await d.prepare(`SELECT COUNT(*) AS count FROM mega_links WHERE status='active'`).first(); return json({ok:true, version:VERSION, archive, limit, offset, total:total?.count||0, items:rows.results||[]}); }
async function listManual(env,url){ const d=db(env); await createTables(d); const limit=clamp(Number(url.searchParams.get('limit')||60),10,200); const offset=clamp(Number(url.searchParams.get('offset')||0),0,100000); const rows=await d.prepare(`SELECT * FROM manual_sources WHERE status='open' ORDER BY datetime(last_seen_at) DESC, id DESC LIMIT ? OFFSET ?`).bind(limit,offset).all(); return json({ok:true, version:VERSION, limit, offset, items:rows.results||[]}); }
async function stats(env){ const d=db(env); await createTables(d); const a=await d.prepare(`SELECT COUNT(*) count FROM mega_links WHERE status='active'`).first(); const b=await d.prepare(`SELECT COUNT(*) count FROM manual_sources WHERE status='open'`).first(); const c=await d.prepare(`SELECT * FROM scan_logs ORDER BY id DESC LIMIT 12`).all(); const hosts=await d.prepare(`SELECT source_host, COUNT(*) count FROM mega_links WHERE status='active' GROUP BY source_host ORDER BY count DESC LIMIT 12`).all(); return json({ok:true, version:VERSION, links:a?.count||0, manual:b?.count||0, recent_scans:c.results||[], top_hosts:hosts.results||[]}); }
async function exportArchive(env,url){ const d=db(env); await createTables(d); const format=url.searchParams.get('format')||'json'; const rows=(await d.prepare(`SELECT mega_url,source_url,title,link_type,confidence,confidence_reason,first_seen_at,last_seen_at,hit_count FROM mega_links WHERE status='active' ORDER BY datetime(last_seen_at) DESC`).all()).results||[]; if(format==='csv'){ const csv=['mega_url,source_url,title,link_type,confidence,first_seen_at,last_seen_at,hit_count',...rows.map(r=>[r.mega_url,r.source_url,r.title,r.link_type,r.confidence,r.first_seen_at,r.last_seen_at,r.hit_count].map(csvCell).join(','))].join('\n'); return new Response(csv,{headers:{'content-type':'text/csv;charset=utf-8','content-disposition':'attachment; filename="nimbus-core-v20-export.csv"'}}); } return json({ok:true, version:VERSION, exported_at:new Date().toISOString(), items:rows}); }
function csvCell(v){ return '"'+String(v??'').replace(/"/g,'""')+'"'; }
async function deleteLink(request,env){ const body=await request.json().catch(()=>({})); const id=Number(body.id||0); const d=db(env); await createTables(d); await d.prepare(`UPDATE mega_links SET status='deleted' WHERE id=?`).bind(id).run(); return json({ok:true, id}); }
async function bulkDelete(request,env){ const body=await request.json().catch(()=>({})); const ids=Array.isArray(body.ids)?body.ids.map(Number).filter(Boolean).slice(0,200):[]; const d=db(env); await createTables(d); for(const id of ids) await d.prepare(`UPDATE mega_links SET status='deleted' WHERE id=?`).bind(id).run(); return json({ok:true, deleted:ids.length}); }
async function cleanup(env){ const d=db(env); await createTables(d); let legacy=0; const legacyCols=[String.fromCharCode(113,117,101,114,121),String.fromCharCode(114,101,103,105,111,110),String.fromCharCode(114,101,103,105,111,110,115)]; for(const table of ['mega_links','manual_sources']){ const cols=(await d.prepare(`PRAGMA table_info(${table})`).all()).results?.map(x=>x.name)||[]; for(const col of legacyCols.filter(c=>cols.includes(c))){ try{ const r=await d.prepare(`UPDATE ${table} SET ${col}=NULL`).run(); legacy += r.meta?.changes||0; }catch{} } } const dupe=await d.prepare(`DELETE FROM mega_links WHERE id NOT IN (SELECT MIN(id) FROM mega_links GROUP BY mega_url)`).run(); await d.prepare(`DELETE FROM manual_sources WHERE source_url IN (SELECT source_url FROM mega_links WHERE source_url IS NOT NULL)`).run(); return json({ok:true, version:VERSION, legacy_labels_removed:legacy, duplicate_rows_deleted:dupe.meta?.changes||0, message:'Cleanup finished. V20 stores link-first data only.'}); }
async function resetCursor(env){ const d=db(env); await createTables(d); await setState(d,'link-first',0); return json({ok:true, cursor:0}); }
function json(data,status=200){ return new Response(JSON.stringify(data,null,2),{status,headers:{'content-type':'application/json;charset=utf-8','cache-control':'no-store'}}); }
function text(data,status=200){ return new Response(data,{status,headers:{'content-type':'text/plain;charset=utf-8'}}); }
