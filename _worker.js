const VERSION = '27.1.0-core-from-v26';
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;
const DEFAULT_SCAN_LIMIT = 12;
const DEFAULT_QUEUE_LIMIT = 10;
const PAGE_CACHE_SECONDS = 60 * 60 * 6;
const HEALTH_CACHE_SECONDS = 60 * 60 * 12;

const TRUSTED_TEXT_DOMAINS = [
  'rentry.co','pastebin.com','gist.github.com','github.com','reddit.com','old.reddit.com',
  'archive.org','telegra.ph','justpaste.it','hastebin.com','controlc.com','dpaste.org','paste.ee'
];
const MANUAL_REVIEW_DOMAINS = ['meawfy.com','linkvertise.com','loot-link.com','work.ink','rekonise.com','linktree.com'];
const DISCOVERY_PATTERNS = [
  '"mega.nz/folder/"', '"mega.nz/file/"',
  'site:rentry.co "mega.nz/folder/"', 'site:rentry.co "mega.nz/file/"',
  'site:pastebin.com "mega.nz/folder/"', 'site:pastebin.com "mega.nz/file/"',
  'site:gist.github.com "mega.nz/folder/"', 'site:gist.github.com "mega.nz/file/"',
  'site:github.com "mega.nz/folder/"', 'site:github.com "mega.nz/file/"',
  'site:reddit.com "mega.nz/folder/"', 'site:reddit.com "mega.nz/file/"',
  'site:archive.org "mega.nz/folder/"', 'site:archive.org "mega.nz/file/"',
  'site:telegra.ph "mega.nz/folder/"', 'site:telegra.ph "mega.nz/file/"'
];
const SEARCH_ENGINES = [
  { id:'bing_rss', label:'Bing RSS', type:'rss', enabled:true },
  { id:'duckduckgo_lite', label:'DuckDuckGo Lite', type:'html', enabled:true },
  { id:'ahmia', label:'Ahmia Public Web', type:'html', enabled:true },
  { id:'brave', label:'Brave Search API', type:'json', enabled:'env.BRAVE_API_KEY' }
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/reset') return resetPage();
    if (!url.pathname.startsWith('/api/')) return serveAsset(request, env);
    return handleApi(request, env, ctx);
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(autoScan(env, { continueScan:true, scheduled:true, limit:8 }));
    ctx.waitUntil(processQueue(env, { limit:8 }));
  }
};

async function serveAsset(request, env) {
  if (env?.ASSETS?.fetch) return env.ASSETS.fetch(request);
  return new Response('Nimbus Core asset binding is not available.', { status:500, headers:{'content-type':'text/plain;charset=utf-8'} });
}

async function handleApi(request, env, ctx) {
  const headers = corsHeaders();
  try {
    if (request.method === 'OPTIONS') return new Response(null, { status:204, headers });
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
    if (path === '/api/queue') return json(await queueStatus(env, url), 200, headers);
    if (path === '/api/process-queue') return json(await processQueue(env, await readJson(request)), 200, headers);
    if (path === '/api/check-links') return json(await checkLinks(env, await readJson(request)), 200, headers);
    if (path === '/api/dashboard') return json(await dashboard(env), 200, headers);
    if (path === '/api/delete-link') return json(await deleteLink(request, env), 200, headers);
    if (path === '/api/cleanup') return json(await cleanup(env), 200, headers);
    if (path === '/api/reset-cursor') return json(await resetCursor(env), 200, headers);
    if (path === '/api/diagnostics') return json(await diagnostics(env), 200, headers);
    if (path === '/api/export') return exportLinks(env, url, headers);
    return json({ ok:false, version:VERSION, error:'not_found', path }, 404, headers);
  } catch (error) {
    return json({ ok:false, version:VERSION, error:'api_exception', message:String(error?.message || error), stack:shortStack(error) }, 200, headers);
  }
}

function corsHeaders(){ return {'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,DELETE,OPTIONS','access-control-allow-headers':'content-type,authorization','cache-control':'no-store, no-cache, must-revalidate, max-age=0','pragma':'no-cache','x-nimbus-version':VERSION}; }
function json(data,status=200,extra={}){ return new Response(JSON.stringify(data,null,2),{status,headers:{...extra,'content-type':'application/json;charset=utf-8'}}); }
async function readJson(request){ try{return await request.json()}catch{return {}} }
async function publicStatus(env){ return {ok:true,version:VERSION,db_bound:!!env.DB,auth_pin_configured:!!env.AUTH_PIN,brave_enabled:!!env.BRAVE_API_KEY,storage:'isolated_v27_tables',engines:SEARCH_ENGINES.map(e=>({id:e.id,label:e.label,enabled:e.id==='brave'?!!env.BRAVE_API_KEY:e.enabled})),note:'V27 core build from V26+ with source engine, extraction, queue, cache, health checking, dashboard, and export.'}; }
async function login(request, env){ const body=await readJson(request); if(!env.AUTH_PIN) return {ok:false,version:VERSION,error:'AUTH_PIN_missing'}; if(String(body.pin||'')!==String(env.AUTH_PIN)) return {ok:false,version:VERSION,error:'invalid_pin'}; return {ok:true,version:VERSION,token:await signToken({iat:nowSec(),exp:nowSec()+TOKEN_TTL_SECONDS},env)}; }
async function session(request, env){ return {...await requireAuth(request,env),version:VERSION}; }
async function requireAuth(request, env){ if(!env.AUTH_PIN) return {ok:false,error:'AUTH_PIN_missing'}; const token=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim(); if(!token) return {ok:false,error:'missing_token'}; const payload=await verifyToken(token,env); if(!payload) return {ok:false,error:'invalid_token'}; if(payload.exp && payload.exp<nowSec()) return {ok:false,error:'expired_token'}; return {ok:true}; }
async function signToken(payload, env){ const p=base64Url(JSON.stringify(payload)); return `${p}.${await hmac(p, secret(env))}`; }
async function verifyToken(token, env){ const parts=token.split('.'); if(parts.length!==2)return null; const expected=await hmac(parts[0],secret(env)); if(expected!==parts[1])return null; try{return JSON.parse(fromBase64Url(parts[0]))}catch{return null} }
function secret(env){return String(env.AUTH_SECRET||env.AUTH_PIN||'nimbus-core-local-secret')} function nowSec(){return Math.floor(Date.now()/1000)} function nowIso(){return new Date().toISOString()}
function base64Url(text){return btoa(unescape(encodeURIComponent(text))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'')} function fromBase64Url(text){return decodeURIComponent(escape(atob(text.replace(/-/g,'+').replace(/_/g,'/'))))}
async function hmac(message,key){ const enc=new TextEncoder(); const k=await crypto.subtle.importKey('raw',enc.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']); const sig=await crypto.subtle.sign('HMAC',k,enc.encode(message)); return Array.from(new Uint8Array(sig)).map(b=>b.toString(16).padStart(2,'0')).join(''); }
function shortStack(error){return String(error?.stack||'').split('\n').slice(0,6).join('\n')}
function db(env){ if(!env.DB) throw new Error('DB binding missing. Add Cloudflare D1 binding named DB.'); return env.DB; }
async function run(env,sql,bind=[]){ return db(env).prepare(sql).bind(...bind).run(); } async function all(env,sql,bind=[]){ return db(env).prepare(sql).bind(...bind).all(); } async function first(env,sql,bind=[]){ return db(env).prepare(sql).bind(...bind).first(); }
async function runIgnore(env,sql,bind=[]){ try{return await run(env,sql,bind)}catch(e){ if(/already exists|duplicate column/i.test(String(e.message||e))) return {success:true,skipped:true}; throw e; } }

async function ensureSchema(env){
  const steps=[]; const add=async(name,sql,bind=[])=>{ await runIgnore(env,sql,bind); steps.push(name); };
  await add('links', `CREATE TABLE IF NOT EXISTS nimbus_v27_links (id INTEGER PRIMARY KEY AUTOINCREMENT, mega_url TEXT NOT NULL UNIQUE, normalized_url TEXT, link_type TEXT, public_id TEXT, source_url TEXT, source_domain TEXT, title TEXT, source_type TEXT, confidence INTEGER, confidence_reason TEXT, health_status TEXT DEFAULT 'unchecked', health_reason TEXT, health_checked_at TEXT, discovered_at TEXT, last_seen_at TEXT, notes TEXT)`);
  await add('sources', `CREATE TABLE IF NOT EXISTS nimbus_v27_sources (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT NOT NULL UNIQUE, domain TEXT, reason TEXT, title TEXT, depth INTEGER DEFAULT 0, discovered_at TEXT, last_seen_at TEXT, status TEXT DEFAULT 'open')`);
  await add('queue', `CREATE TABLE IF NOT EXISTS nimbus_v27_queue (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT NOT NULL UNIQUE, domain TEXT, priority INTEGER DEFAULT 50, depth INTEGER DEFAULT 0, status TEXT DEFAULT 'pending', attempts INTEGER DEFAULT 0, last_error TEXT, created_at TEXT, updated_at TEXT)`);
  await add('cache', `CREATE TABLE IF NOT EXISTS nimbus_v27_cache (cache_key TEXT PRIMARY KEY, cache_type TEXT, value TEXT, expires_at INTEGER, updated_at TEXT)`);
  await add('logs', `CREATE TABLE IF NOT EXISTS nimbus_v27_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, mode TEXT, started_at TEXT, finished_at TEXT, engines TEXT, queries_checked INTEGER, pages_found INTEGER, pages_fetched INTEGER, queue_added INTEGER, links_found INTEGER, new_links INTEGER, manual_sources INTEGER, health_checked INTEGER, errors TEXT)`);
  await add('state', `CREATE TABLE IF NOT EXISTS nimbus_v27_state (name TEXT PRIMARY KEY, value TEXT, updated_at TEXT)`);
  await add('idx_links_domain','CREATE INDEX IF NOT EXISTS idx_v27_links_domain ON nimbus_v27_links(source_domain)');
  await add('idx_links_time','CREATE INDEX IF NOT EXISTS idx_v27_links_time ON nimbus_v27_links(discovered_at)');
  await add('idx_links_health','CREATE INDEX IF NOT EXISTS idx_v27_links_health ON nimbus_v27_links(health_status)');
  await add('idx_queue_status','CREATE INDEX IF NOT EXISTS idx_v27_queue_status ON nimbus_v27_queue(status, priority DESC, id ASC)');
  await add('idx_sources_domain','CREATE INDEX IF NOT EXISTS idx_v27_sources_domain ON nimbus_v27_sources(domain)');
  await run(env, `INSERT OR IGNORE INTO nimbus_v27_state (name,value,updated_at) VALUES ('auto_cursor','0',?)`, [nowIso()]);
  await run(env, `INSERT OR IGNORE INTO nimbus_v27_state (name,value,updated_at) VALUES ('last_batch','{}',?)`, [nowIso()]);
  return steps;
}
async function schema(env){ const steps=await ensureSchema(env); const tables=await all(env,`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'nimbus_v27_%' ORDER BY name`); return {ok:true,version:VERSION,applied_steps:steps.length,tables:rows(tables).map(r=>r.name),counts:await getCounts(env)}; }
async function getCounts(env){ await ensureSchema(env); const mega=await first(env,'SELECT COUNT(*) c FROM nimbus_v27_links'); const manual=await first(env,'SELECT COUNT(*) c FROM nimbus_v27_sources'); const queue=await first(env,"SELECT COUNT(*) c FROM nimbus_v27_queue WHERE status='pending'"); const logs=await first(env,'SELECT COUNT(*) c FROM nimbus_v27_logs'); const checked=await first(env,"SELECT COUNT(*) c FROM nimbus_v27_links WHERE health_status!='unchecked'"); const alive=await first(env,"SELECT COUNT(*) c FROM nimbus_v27_links WHERE health_status IN ('format_valid','reachable_unknown')"); return {mega_links:Number(mega?.c||0),manual_sources:Number(manual?.c||0),pending_queue:Number(queue?.c||0),scan_logs:Number(logs?.c||0),health_checked:Number(checked?.c||0),likely_valid:Number(alive?.c||0)}; }
async function getState(env,name){ const r=await first(env,'SELECT value FROM nimbus_v27_state WHERE name=?',[name]); return r?.value||null; }
async function setState(env,name,value){ await run(env,`INSERT INTO nimbus_v27_state (name,value,updated_at) VALUES (?,?,?) ON CONFLICT(name) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,[name,String(value),nowIso()]); }

async function search(request, env){
  await ensureSchema(env);
  const body=await readJson(request);
  const mode=String(body.mode||'auto');
  if(mode==='manual') return manualSearch(env, body);
  if(mode==='auto') return autoScan(env, body);
  if(mode==='extract-url') return scanPageUrl(env, body.url, {depth:0, sourceType:'manual_url'});
  if(mode==='process-queue') return processQueue(env, body);
  if(mode==='check') return checkLinks(env, body);
  return {ok:false,version:VERSION,error:'unknown_mode',mode};
}
function normalizeQueryText(q){ return String(q||'').trim().replace(/\s+/g,' ').slice(0,120); }
function buildQueries(query){ const q=normalizeQueryText(query); if(!q) return {ok:true,queries:DISCOVERY_PATTERNS}; return {ok:true,queries:[`"${q}" "mega.nz/folder/"`,`"${q}" "mega.nz/file/"`,`site:rentry.co "${q}" "mega.nz"`,`site:pastebin.com "${q}" "mega.nz"`,`site:github.com "${q}" "mega.nz"`,`site:reddit.com "${q}" "mega.nz"`,`site:archive.org "${q}" "mega.nz"`,`site:linktree.com "${q}" "mega.nz"`,`site:meawfy.com "${q}" "mega.nz"`]}; }
async function manualSearch(env, body){ const built=buildQueries(body.query); if(!built.ok) return {ok:false,version:VERSION,...built}; return runDiscovery(env, built.queries, {mode:'manual', limit:clamp(Number(body.limit||DEFAULT_SCAN_LIMIT),1,30)}); }
async function autoScan(env, body={}){ let cursor=Number(await getState(env,'auto_cursor')||0); if(body.reset) cursor=0; const limit=clamp(Number(body.limit||DEFAULT_SCAN_LIMIT),1,30); const queries=[]; for(let i=0;i<limit;i++) queries.push(DISCOVERY_PATTERNS[(cursor+i)%DISCOVERY_PATTERNS.length]); await setState(env,'auto_cursor',String((cursor+limit)%DISCOVERY_PATTERNS.length)); return runDiscovery(env, queries, {mode:body.scheduled?'scheduled_auto':'auto', limit}); }
async function runDiscovery(env, queries, options){
  const started=nowIso(); const errors=[]; const engineNames=[]; let pagesFound=0, pagesFetched=0, queueAdded=0, linksFound=0, newLinks=0, manualSources=0;
  for(const query of queries){
    const engines = getEnabledEngines(env);
    for(const engine of engines){
      engineNames.push(engine.id);
      try{
        const urls=await searchEngine(env, engine, query);
        pagesFound += urls.length;
        for(const u of urls){
          const d=hostname(u); if(!d) continue;
          if(isManualDomain(d)){ const sm=await saveManual(env,u,`manual_review:${engine.id}`,query); if(sm.new) manualSources++; continue; }
          const enq=await enqueue(env,u, engine.id, scoreSourcePriority(u,query), 0); if(enq.new) queueAdded++;
        }
      }catch(e){errors.push(`${engine.id}:${String(e.message||e).slice(0,180)}`)}
    }
  }
  const processed=await processQueue(env,{limit:options.limit||DEFAULT_QUEUE_LIMIT});
  pagesFetched += processed.summary?.pages_fetched||0; linksFound += processed.summary?.links_found||0; newLinks += processed.summary?.new_links||0; manualSources += processed.summary?.manual_sources||0;
  const summary={queries_checked:queries.length,pages_found:pagesFound,pages_fetched:pagesFetched,queue_added:queueAdded,links_found:linksFound,new_links:newLinks,manual_sources:manualSources,errors};
  await run(env,`INSERT INTO nimbus_v27_logs (mode,started_at,finished_at,engines,queries_checked,pages_found,pages_fetched,queue_added,links_found,new_links,manual_sources,health_checked,errors) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,[options.mode,started,nowIso(),dedupe(engineNames).join(','),summary.queries_checked,pagesFound,pagesFetched,queueAdded,linksFound,newLinks,manualSources,0,JSON.stringify(errors)]);
  await setState(env,'last_batch',JSON.stringify(summary));
  return {ok:true,version:VERSION,summary,processed};
}
function getEnabledEngines(env){ return SEARCH_ENGINES.filter(e=>e.id==='brave'?!!env.BRAVE_API_KEY:e.enabled); }
async function searchEngine(env, engine, query){
  if(engine.id==='bing_rss') return bingRss(query);
  if(engine.id==='duckduckgo_lite') return duckDuckGo(query);
  if(engine.id==='ahmia') return ahmia(query);
  if(engine.id==='brave') return braveSearch(env, query);
  return [];
}
async function bingRss(query){ const url='https://www.bing.com/search?format=rss&q='+encodeURIComponent(query); const text=await fetchText(url); const urls=[...text.matchAll(/<link>(https?:\/\/[^<]+)<\/link>/gi)].map(m=>decodeHtml(m[1])); return filterSearchUrls(urls); }
async function duckDuckGo(query){ const url='https://lite.duckduckgo.com/lite/?q='+encodeURIComponent(query); const text=await fetchText(url); const urls=[...text.matchAll(/href="([^"]+)"/gi)].map(m=>decodeHtml(m[1])).map(resolveDdgUrl); return filterSearchUrls(urls); }
async function ahmia(query){ const url='https://ahmia.fi/search/?q='+encodeURIComponent(query); const text=await fetchText(url); const urls=[...text.matchAll(/href="(https?:\/\/[^"]+)"/gi)].map(m=>decodeHtml(m[1])); return filterSearchUrls(urls); }
async function braveSearch(env, query){ const res=await fetch('https://api.search.brave.com/res/v1/web/search?q='+encodeURIComponent(query),{headers:{'accept':'application/json','x-subscription-token':env.BRAVE_API_KEY,'user-agent':ua()}}); if(!res.ok) return []; const data=await res.json(); const urls=(data.web?.results||[]).map(x=>x.url).filter(Boolean); return filterSearchUrls(urls); }
function resolveDdgUrl(u){ try{ if(u.startsWith('//')) u='https:'+u; if(u.startsWith('/l/?')){ const p=new URL('https://duckduckgo.com'+u); return p.searchParams.get('uddg')||u; } return u; }catch{return u} }
function filterSearchUrls(urls){ return dedupe(urls.map(cleanUrl).filter(u=>/^https?:\/\//i.test(u)).filter(u=>!hostname(u).includes('bing.com')).filter(u=>!hostname(u).includes('duckduckgo.com')).slice(0,30)); }
async function fetchText(url, timeoutMs=12000){ const controller=new AbortController(); const t=setTimeout(()=>controller.abort('timeout'),timeoutMs); try{ const res=await fetch(url,{headers:{'user-agent':ua(),'accept':'text/html,application/xhtml+xml,application/xml,application/rss+xml,application/json;q=0.9,*/*;q=0.8'},signal:controller.signal}); if(!res.ok) throw new Error('HTTP '+res.status); return await res.text(); } finally { clearTimeout(t); } }
function ua(){ return 'Mozilla/5.0 NimbusCoreV27 PublicIndexedResearch/27.0'; }
async function enqueue(env,url,reason,priority=50,depth=0){ const clean=cleanUrl(url); const now=nowIso(); await run(env,`INSERT OR IGNORE INTO nimbus_v27_queue (url,domain,priority,depth,status,attempts,last_error,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`,[clean,hostname(clean),priority,depth,'pending',0,reason||'',now,now]); const changed=await first(env,`SELECT changes() c`); return {new:Number(changed?.c||0)>0,url:clean}; }
function scoreSourcePriority(u,q){ let p=50; const d=hostname(u); if(TRUSTED_TEXT_DOMAINS.some(x=>d===x||d.endsWith('.'+x))) p+=25; if(/mega\.nz/i.test(u)) p+=30; if(/rentry|pastebin|gist|github|reddit/i.test(d)) p+=10; return Math.min(100,p); }
async function processQueue(env, body={}){
  await ensureSchema(env); const limit=clamp(Number(body.limit||DEFAULT_QUEUE_LIMIT),1,50); const qs=await all(env,`SELECT * FROM nimbus_v27_queue WHERE status='pending' ORDER BY priority DESC,id ASC LIMIT ?`,[limit]);
  let pagesFetched=0, linksFound=0, newLinks=0, manualSources=0, errors=[];
  for(const item of rows(qs)){
    await run(env,`UPDATE nimbus_v27_queue SET status='running', attempts=attempts+1, updated_at=? WHERE id=?`,[nowIso(),item.id]);
    try{
      const res=await scanPageUrl(env,item.url,{depth:item.depth||0,sourceType:'queue'});
      pagesFetched += res.summary?.pages_fetched||0; linksFound += res.summary?.links_found||0; newLinks += res.summary?.new_links||0; manualSources += res.summary?.manual_sources||0;
      await run(env,`UPDATE nimbus_v27_queue SET status='done', updated_at=? WHERE id=?`,[nowIso(),item.id]);
    }catch(e){ errors.push(`${item.url}:${String(e.message||e).slice(0,160)}`); const status=Number(item.attempts||0)>=2?'failed':'pending'; await run(env,`UPDATE nimbus_v27_queue SET status=?, last_error=?, updated_at=? WHERE id=?`,[status,String(e.message||e).slice(0,250),nowIso(),item.id]); }
  }
  return {ok:true,version:VERSION,summary:{processed:rows(qs).length,pages_fetched:pagesFetched,links_found:linksFound,new_links:newLinks,manual_sources:manualSources,errors}};
}
async function scanPageUrl(env,url,opts={}){
  await ensureSchema(env); const clean=cleanUrl(url); const d=hostname(clean); if(!clean || !d) return {ok:false,version:VERSION,error:'bad_url'};
  if(isManualDomain(d)){ const sm=await saveManual(env,clean,'manual_review_domain',clean); return {ok:true,version:VERSION,summary:{pages_fetched:0,links_found:0,new_links:0,manual_sources:sm.new?1:0},manual:sm}; }
  const text=await cachedFetchPage(env, clean); const title=extractTitle(text)||clean; const links=extractMegaLinks(text); let newCount=0;
  for(const link of links){ const saved=await saveMega(env,link,clean,title,'page_scan'); if(saved.new) newCount++; }
  const childUrls=extractCandidateChildUrls(text, clean).slice(0,20);
  let queued=0, manual=0;
  if((opts.depth||0)<1){ for(const child of childUrls){ const cd=hostname(child); if(isManualDomain(cd)){ const sm=await saveManual(env,child,'child_manual_review',title); if(sm.new) manual++; } else { const en=await enqueue(env,child,'child_page',35,(opts.depth||0)+1); if(en.new) queued++; } } }
  return {ok:true,version:VERSION,summary:{pages_fetched:1,links_found:links.length,new_links:newCount,manual_sources:manual,queue_added:queued},links};
}
async function cachedFetchPage(env,url){ const key='page:'+url; const cached=await cacheGet(env,key); if(cached) return cached; const text=await fetchText(url); await cacheSet(env,key,'page',text.slice(0,700000),PAGE_CACHE_SECONDS); return text; }
async function cacheGet(env,key){ const r=await first(env,`SELECT value,expires_at FROM nimbus_v27_cache WHERE cache_key=?`,[key]); if(!r) return null; if(Number(r.expires_at||0)<nowSec()){ await run(env,`DELETE FROM nimbus_v27_cache WHERE cache_key=?`,[key]); return null; } return r.value; }
async function cacheSet(env,key,type,value,ttl){ await run(env,`INSERT INTO nimbus_v27_cache (cache_key,cache_type,value,expires_at,updated_at) VALUES (?,?,?,?,?) ON CONFLICT(cache_key) DO UPDATE SET cache_type=excluded.cache_type,value=excluded.value,expires_at=excluded.expires_at,updated_at=excluded.updated_at`,[key,type,value,nowSec()+ttl,nowIso()]); }
function extractMegaLinks(text){ const raw=String(text||''); const decoded=decodeHtml(raw); const patterns=[/https?:\/\/(?:www\.)?mega\.(?:nz|io)\/(?:file|folder)\/[A-Za-z0-9_-]+#[A-Za-z0-9_-]+/gi,/https?:\/\/(?:www\.)?mega\.nz\/#(?:F!)?[A-Za-z0-9_-]+![A-Za-z0-9_-]+/gi]; const found=[]; for(const p of patterns){ let m; while((m=p.exec(decoded))) found.push(normalizeMega(m[0])); } return dedupe(found).filter(Boolean); }
function extractCandidateChildUrls(text,base){ const raw=decodeHtml(String(text||'')); const urls=[...raw.matchAll(/href=["']([^"']+)["']/gi)].map(m=>m[1]).map(h=>absUrl(h,base)).filter(Boolean); return filterSearchUrls(urls).filter(u=>TRUSTED_TEXT_DOMAINS.some(x=>hostname(u)===x||hostname(u).endsWith('.'+x)) || /mega\.nz/i.test(u)); }
function absUrl(h,base){ try{ if(!h || h.startsWith('javascript:') || h.startsWith('mailto:')) return ''; return new URL(h,base).href; }catch{return ''} }
function parseMega(url){ const u=normalizeMega(url); let m=/mega\.(?:nz|io)\/(file|folder)\/([A-Za-z0-9_-]+)#([A-Za-z0-9_-]+)/i.exec(u); if(m) return {url:u,type:m[1].toLowerCase(),id:m[2],hasKey:true}; m=/mega\.nz\/#(F!)?([A-Za-z0-9_-]+)!([A-Za-z0-9_-]+)/i.exec(u); if(m) return {url:u,type:m[1]?'folder':'file',id:m[2],hasKey:true}; return {url:u,type:'unknown',id:'',hasKey:false}; }
function normalizeMega(u){ return cleanUrl(String(u||'').replace(/^http:\/\//i,'https://').replace(/https:\/\/www\.mega\./i,'https://mega.')).replace(/[.,;]+$/,''); }
async function saveMega(env,megaUrl,sourceUrl,title,sourceType){ const p=parseMega(megaUrl); if(!p.hasKey) return {new:false,skipped:'invalid_structure'}; const now=nowIso(); const d=hostname(sourceUrl); const score=confidence(p.url,sourceUrl,title); await run(env,`INSERT OR IGNORE INTO nimbus_v27_links (mega_url,normalized_url,link_type,public_id,source_url,source_domain,title,source_type,confidence,confidence_reason,health_status,discovered_at,last_seen_at,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[p.url,p.url,p.type,p.id,sourceUrl,d,title||'',sourceType||'scan',score.score,score.reason,'unchecked',now,now,'']); const changed=await first(env,`SELECT changes() c`); await run(env,`UPDATE nimbus_v27_links SET last_seen_at=?, source_url=COALESCE(source_url,?), source_domain=COALESCE(source_domain,?), title=COALESCE(title,?) WHERE mega_url=?`,[now,sourceUrl,d,title||'',p.url]); return {new:Number(changed?.c||0)>0,item:{mega_url:p.url,link_type:p.type,source_url:sourceUrl,confidence:score.score}}; }
async function saveManual(env,url,reason,title){ const clean=cleanUrl(url); const now=nowIso(); const domain=hostname(clean); await run(env,`INSERT OR IGNORE INTO nimbus_v27_sources (url,domain,reason,title,depth,discovered_at,last_seen_at,status) VALUES (?,?,?,?,?,?,?,?)`,[clean,domain,reason||'manual_review',title||clean,0,now,now,'open']); const changed=await first(env,`SELECT changes() c`); await run(env,`UPDATE nimbus_v27_sources SET last_seen_at=?, reason=COALESCE(reason,?), title=COALESCE(title,?) WHERE url=?`,[now,reason||'manual_review',title||clean,clean]); return {new:Number(changed?.c||0)>0,item:{url:clean,domain,reason,title:title||clean}}; }
function confidence(parsedUrl,sourceUrl,title){ let score=45; const reasons=[]; const p=parseMega(parsedUrl); if(p.type==='folder'){score+=12;reasons.push('folder-link')} if(p.hasKey){score+=15;reasons.push('has-key-fragment')} const d=hostname(sourceUrl); if(TRUSTED_TEXT_DOMAINS.some(x=>d===x||d.endsWith('.'+x))){score+=20;reasons.push('trusted-text-source')} if(/mega/i.test(title||'')){score+=5;reasons.push('title-mentions-mega')} return {score:Math.min(100,score),reason:reasons.join(', ')||'public-indexed-result'}; }
async function checkLinks(env, body={}){ await ensureSchema(env); let items=[]; if(Array.isArray(body.urls) && body.urls.length) items=body.urls.map(normalizeMega); else { const rs=await all(env,`SELECT mega_url FROM nimbus_v27_links WHERE health_status='unchecked' OR health_checked_at IS NULL ORDER BY id DESC LIMIT ?`,[clamp(Number(body.limit||25),1,100)]); items=rows(rs).map(r=>r.mega_url); } let checked=0; const results=[]; for(const u of dedupe(items)){ const res=await healthCheck(env,u); results.push(res); checked++; await run(env,`UPDATE nimbus_v27_links SET health_status=?, health_reason=?, health_checked_at=? WHERE mega_url=?`,[res.status,res.reason,nowIso(),res.url]); } await run(env,`INSERT INTO nimbus_v27_logs (mode,started_at,finished_at,engines,queries_checked,pages_found,pages_fetched,queue_added,links_found,new_links,manual_sources,health_checked,errors) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,['health_check',nowIso(),nowIso(),'health',0,0,0,0,0,0,0,checked,'[]']); return {ok:true,version:VERSION,checked,results}; }
async function healthCheck(env,url){ const p=parseMega(url); if(!p.hasKey) return {url:p.url,status:'invalid_format',reason:'Missing public id or decryption key fragment.'}; const cached=await cacheGet(env,'health:'+p.url); if(cached) return JSON.parse(cached); let status='format_valid', reason='Structure is valid. MEGA availability cannot be fully proven without using MEGA account/API metadata.'; try{ const controller=new AbortController(); const t=setTimeout(()=>controller.abort('timeout'),8000); const res=await fetch(p.url.split('#')[0],{method:'GET',headers:{'user-agent':ua(),'accept':'text/html,*/*'},signal:controller.signal}); clearTimeout(t); if(res.ok){ status='reachable_unknown'; reason='MEGA page endpoint is reachable; file/folder existence still requires MEGA-side metadata.'; } else { status='format_valid'; reason='Structure is valid but HTTP endpoint returned '+res.status; } }catch(e){ reason='Structure is valid; network check failed: '+String(e.message||e).slice(0,100); }
  const result={url:p.url,status,reason,type:p.type,checked_at:nowIso()}; await cacheSet(env,'health:'+p.url,'health',JSON.stringify(result),HEALTH_CACHE_SECONDS); return result; }
async function latest(env,url){ await ensureSchema(env); const limit=clamp(Number(url.searchParams.get('limit')||50),1,200); const rs=await all(env,`SELECT id,mega_url,link_type,source_url,source_domain,title,confidence,confidence_reason,health_status,health_reason,health_checked_at,discovered_at,last_seen_at FROM nimbus_v27_links ORDER BY COALESCE(discovered_at,last_seen_at) DESC,id DESC LIMIT ?`,[limit]); return {ok:true,version:VERSION,items:rows(rs),counts:await getCounts(env)}; }
async function archive(env,url){ await ensureSchema(env); const limit=clamp(Number(url.searchParams.get('limit')||50),1,200); const offset=Math.max(0,Number(url.searchParams.get('offset')||0)); const q=String(url.searchParams.get('q')||'').trim(); let rs; if(q) rs=await all(env,`SELECT * FROM nimbus_v27_links WHERE mega_url LIKE ? OR source_url LIKE ? OR title LIKE ? OR health_status LIKE ? ORDER BY id DESC LIMIT ? OFFSET ?`,[`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`,limit,offset]); else rs=await all(env,`SELECT * FROM nimbus_v27_links ORDER BY id DESC LIMIT ? OFFSET ?`,[limit,offset]); return {ok:true,version:VERSION,offset,limit,next_offset:offset+limit,items:rows(rs)}; }
async function manualSources(env,url){ await ensureSchema(env); const limit=clamp(Number(url.searchParams.get('limit')||100),1,200); const rs=await all(env,`SELECT * FROM nimbus_v27_sources ORDER BY COALESCE(discovered_at,last_seen_at) DESC,id DESC LIMIT ?`,[limit]); return {ok:true,version:VERSION,items:rows(rs)}; }
async function queueStatus(env,url){ await ensureSchema(env); const limit=clamp(Number(url.searchParams.get('limit')||100),1,200); const rs=await all(env,`SELECT * FROM nimbus_v27_queue ORDER BY CASE status WHEN 'pending' THEN 1 WHEN 'running' THEN 2 WHEN 'failed' THEN 3 ELSE 4 END, priority DESC,id DESC LIMIT ?`,[limit]); return {ok:true,version:VERSION,items:rows(rs),counts:await getCounts(env)}; }
async function dashboard(env){ await ensureSchema(env); const counts=await getCounts(env); const byDomain=rows(await all(env,`SELECT source_domain domain,COUNT(*) c FROM nimbus_v27_links GROUP BY source_domain ORDER BY c DESC LIMIT 10`)); const byHealth=rows(await all(env,`SELECT health_status status,COUNT(*) c FROM nimbus_v27_links GROUP BY health_status ORDER BY c DESC`)); const recentLogs=rows(await all(env,`SELECT * FROM nimbus_v27_logs ORDER BY id DESC LIMIT 10`)); return {ok:true,version:VERSION,counts,by_domain:byDomain,by_health:byHealth,recent_logs:recentLogs,last_batch:safeJson(await getState(env,'last_batch'))}; }
async function deleteLink(request,env){ await ensureSchema(env); const body=await readJson(request); const id=Number(body.id||0); const mega=body.mega_url?normalizeMega(body.mega_url):''; if(id) await run(env,'DELETE FROM nimbus_v27_links WHERE id=?',[id]); else if(mega) await run(env,'DELETE FROM nimbus_v27_links WHERE mega_url=?',[mega]); else return {ok:false,version:VERSION,error:'missing_id_or_url'}; return {ok:true,version:VERSION}; }
async function cleanup(env){ await ensureSchema(env); await run(env,`DELETE FROM nimbus_v27_links WHERE mega_url IS NULL OR mega_url='' OR mega_url NOT LIKE 'https://mega.%'`); await run(env,`DELETE FROM nimbus_v27_queue WHERE status IN ('done','failed')`); await run(env,`DELETE FROM nimbus_v27_cache WHERE expires_at < ?`,[nowSec()]); return {ok:true,version:VERSION,message:'V27 cleanup completed. Legacy V25/V26 tables are ignored.',counts:await getCounts(env)}; }
async function resetCursor(env){ await ensureSchema(env); await setState(env,'auto_cursor','0'); return {ok:true,version:VERSION,message:'V27 auto cursor reset'}; }
async function diagnostics(env){ await ensureSchema(env); return {ok:true,version:VERSION,status:await publicStatus(env),dashboard:await dashboard(env)}; }
async function exportLinks(env,url,headers){ await ensureSchema(env); const format=String(url.searchParams.get('format')||'json').toLowerCase(); const rs=await all(env,'SELECT mega_url,link_type,source_url,source_domain,title,confidence,health_status,health_reason,discovered_at,last_seen_at FROM nimbus_v27_links ORDER BY id DESC LIMIT 10000'); const data=rows(rs); if(format==='csv'){ const csv=['mega_url,link_type,source_url,source_domain,title,confidence,health_status,health_reason,discovered_at,last_seen_at'].concat(data.map(r=>[r.mega_url,r.link_type,r.source_url,r.source_domain,r.title,r.confidence,r.health_status,r.health_reason,r.discovered_at,r.last_seen_at].map(csvCell).join(','))).join('\n'); return new Response(csv,{status:200,headers:{...headers,'content-type':'text/csv;charset=utf-8','content-disposition':'attachment; filename="nimbus-core-v27-export.csv"'}}); } return json({ok:true,version:VERSION,items:data},200,headers); }
function rows(result){return Array.isArray(result?.results)?result.results:[]} function clamp(n,min,max){return Math.min(max,Math.max(min,Number.isFinite(n)?n:min))} function dedupe(arr){return Array.from(new Set((arr||[]).filter(Boolean)))} function hostname(u){try{return new URL(u).hostname.replace(/^www\./,'').toLowerCase()}catch{return''}} function isManualDomain(d){return MANUAL_REVIEW_DOMAINS.some(x=>d===x||d.endsWith('.'+x))} function cleanUrl(u){return String(u||'').trim().replace(/&amp;/g,'&').replace(/[)\]}>'"\s]+$/g,'')} function decodeHtml(s){return String(s||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>')} function extractTitle(text){const m=/<title[^>]*>(.*?)<\/title>/is.exec(String(text||'')); return m?decodeHtml(m[1]).replace(/\s+/g,' ').trim().slice(0,180):''} function csvCell(v){return `"${String(v??'').replace(/"/g,'""')}"`} function safeJson(s){try{return JSON.parse(s||'{}')}catch{return{}}}
function resetPage(){ const html=`<!doctype html><meta charset="utf-8"><title>Nimbus Reset</title><h1>Nimbus Core V27 Core</h1><p>Local storage cleared. Redirecting...</p><script>localStorage.clear();location.href='/?v=27&fresh=1'</script>`; return new Response(html,{headers:{'content-type':'text/html;charset=utf-8','cache-control':'no-store'}}); }
