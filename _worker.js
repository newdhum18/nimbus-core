/* Nimbus Core V27 Rewrite - Cloudflare Pages Worker
   Fresh implementation: API + engine + crawler + extractor + queue + cache + dashboard.
   D1 binding required: DB
*/
const VERSION = '27-rewrite.2';
const TABLE_PREFIX = 'nimbus_v27';
const DEFAULT_PIN = '0000';
const MAX_FETCH_BYTES = 900000;
const USER_AGENT = 'NimbusCoreV27/1.0 (+public-source-indexer) Mozilla/5.0';

const T = {
  sessions: `${TABLE_PREFIX}_sessions`,
  sources: `${TABLE_PREFIX}_sources`,
  scans: `${TABLE_PREFIX}_scans`,
  queue: `${TABLE_PREFIX}_queue`,
  pages: `${TABLE_PREFIX}_pages`,
  links: `${TABLE_PREFIX}_links`,
  cache: `${TABLE_PREFIX}_cache`,
  logs: `${TABLE_PREFIX}_logs`,
  stats: `${TABLE_PREFIX}_stats`,
  settings: `${TABLE_PREFIX}_settings`,
  backups: `${TABLE_PREFIX}_backups`
};

const MEGA_RE = /https?:\/\/(?:www\.)?mega\.(?:nz|io)\/(?:file|folder)\/[A-Za-z0-9_-]+#[A-Za-z0-9_-]+/gi;
const URL_RE = /https?:\/\/[^\s"'<>\\)\]]+/gi;

function now(){ return new Date().toISOString(); }
function json(data, status=200, headers={}){ return new Response(JSON.stringify(data, null, 2), {status, headers:{'content-type':'application/json; charset=utf-8', ...headers}}); }
function text(data, status=200){ return new Response(String(data), {status, headers:{'content-type':'text/plain; charset=utf-8'}}); }
function html(data, status=200){ return new Response(data, {status, headers:{'content-type':'text/html; charset=utf-8'}}); }
function csv(data, name='nimbus-export.csv'){ return new Response(data, {headers:{'content-type':'text/csv; charset=utf-8','content-disposition':`attachment; filename="${name}"`}}); }
function uid(prefix='id'){ return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`; }
function sha(input){ return crypto.subtle.digest('SHA-256', new TextEncoder().encode(input)).then(buf=>[...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('')); }
function cleanUrl(u){ try { let x = String(u||'').trim().replace(/&amp;/g,'&'); x = x.replace(/[\s"'<>]+$/g,'').replace(/[.,;:!?]+$/g,''); return x; } catch { return ''; } }
function escapeLike(s){ return String(s||'').replace(/[%_]/g, m=>'\\'+m); }
function normalizeMega(u){ const x=cleanUrl(u); const m=x.match(MEGA_RE); return m ? m[0].replace('mega.io/','mega.nz/') : ''; }
function hostOf(u){ try { return new URL(u).hostname.replace(/^www\./,''); } catch { return ''; } }
function sameHost(a,b){ return hostOf(a) && hostOf(a)===hostOf(b); }
function scoreLink(url, source, ctx=''){
  let s=50;
  if (/\/folder\//i.test(url)) s+=12;
  if (/\/file\//i.test(url)) s+=10;
  if (/#.{8,}/.test(url)) s+=12;
  if (/reddit|github|archive|paste|rentry|gist/i.test(source||'')) s+=8;
  if (/index|key|folder|file/i.test(ctx||'')) s+=5;
  return Math.max(1, Math.min(100, s));
}
function extractMegaLinks(raw){
  const s = String(raw||'');
  const out = new Map();
  const direct = s.match(MEGA_RE) || [];
  for (const v of direct){ const n=normalizeMega(v); if(n) out.set(n, {url:n, context:'regex'}); }
  try {
    const decoded = s.replace(/\\u002F/gi,'/').replace(/\\\//g,'/').replace(/%2F/gi,'/').replace(/%23/gi,'#');
    const d = decoded.match(MEGA_RE) || [];
    for (const v of d){ const n=normalizeMega(v); if(n) out.set(n, {url:n, context:'decoded'}); }
  } catch {}
  return [...out.values()];
}
function extractUrls(raw, base){
  const s=String(raw||''); const set=new Set();
  const matches=s.match(URL_RE)||[];
  for (const m of matches){ const c=cleanUrl(m); if(c) set.add(c); }
  const hrefRe = /href\s*=\s*["']([^"']+)["']/gi; let mm;
  while((mm=hrefRe.exec(s))){
    try{ set.add(new URL(mm[1], base).toString()); }catch{}
  }
  return [...set];
}
function extractNextUrls(raw, base){
  const urls = extractUrls(raw, base);
  const out = new Set();
  for (const u of urls){
    const low=u.toLowerCase();
    if (sameHost(u, base) && (low.includes('page=') || low.includes('/page/') || low.includes('after=') || low.includes('offset=') || low.includes('start='))) out.add(u);
  }
  const rel = String(raw||'').match(/<link[^>]+rel=["']next["'][^>]+href=["']([^"']+)/i);
  if (rel) { try{ out.add(new URL(rel[1], base).toString()); }catch{} }
  return [...out].slice(0,12);
}
async function limitedFetch(url, opts={}){
  const ctrl = new AbortController(); const to=setTimeout(()=>ctrl.abort('timeout'), opts.timeout||12000);
  try{
    const res = await fetch(url, {method:opts.method||'GET', headers:{'user-agent':USER_AGENT, 'accept':opts.accept||'*/*', ...(opts.headers||{})}, redirect:'follow', signal:ctrl.signal});
    if (opts.method==='HEAD') return {ok:res.ok, status:res.status, url:res.url, text:''};
    const reader = res.body?.getReader();
    if(!reader) return {ok:res.ok,status:res.status,url:res.url,text:''};
    let chunks=[], size=0;
    while(true){ const {done,value}=await reader.read(); if(done) break; size+=value.length; if(size>MAX_FETCH_BYTES) break; chunks.push(value); }
    const bytes = new Uint8Array(chunks.reduce((n,c)=>n+c.length,0)); let off=0; for(const c of chunks){bytes.set(c,off); off+=c.length;}
    return {ok:res.ok, status:res.status, url:res.url, text:new TextDecoder('utf-8',{fatal:false}).decode(bytes)};
  } finally { clearTimeout(to); }
}
async function bodyJson(req){ try{return await req.json();}catch{return {};}}
function getCookie(req, name){ const h=req.headers.get('cookie')||''; const p=h.split(';').map(x=>x.trim()).find(x=>x.startsWith(name+'=')); return p?decodeURIComponent(p.slice(name.length+1)):''; }
async function isAuthed(req, env){
  if ((req.headers.get('authorization')||'') === `Bearer ${env.NIMBUS_API_TOKEN}` && env.NIMBUS_API_TOKEN) return true;
  const token = getCookie(req,'nimbus_session') || req.headers.get('x-nimbus-session') || '';
  if(!token || !env.DB) return false;
  await ensureDb(env);
  const row = await env.DB.prepare(`SELECT token FROM ${T.sessions} WHERE token=? AND expires_at>?`).bind(token, now()).first();
  return !!row;
}
async function requireAuth(req, env){ if(await isAuthed(req,env)) return null; return json({ok:false,error:'Not authenticated'},401); }
async function log(env, level, event, data={}){ try{ await env.DB.prepare(`INSERT INTO ${T.logs}(id,created_at,level,event,data) VALUES(?,?,?,?,?)`).bind(uid('log'),now(),level,event,JSON.stringify(data)).run(); }catch{} }

async function ensureDb(env){
  if(!env.DB) throw new Error('D1 binding DB is missing');
  const stmts = [
`CREATE TABLE IF NOT EXISTS ${T.sessions}(token TEXT PRIMARY KEY, created_at TEXT NOT NULL, expires_at TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS ${T.sources}(id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL, url_template TEXT, enabled INTEGER DEFAULT 1, priority INTEGER DEFAULT 50, config TEXT DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS ${T.scans}(id TEXT PRIMARY KEY, query TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, started_at TEXT, finished_at TEXT, elapsed_ms INTEGER DEFAULT 0, pages_found INTEGER DEFAULT 0, pages_scanned INTEGER DEFAULT 0, links_found INTEGER DEFAULT 0, links_alive INTEGER DEFAULT 0, links_dead INTEGER DEFAULT 0, links_unknown INTEGER DEFAULT 0, errors INTEGER DEFAULT 0, message TEXT DEFAULT '')`,
`CREATE TABLE IF NOT EXISTS ${T.queue}(id TEXT PRIMARY KEY, scan_id TEXT, type TEXT NOT NULL, payload TEXT NOT NULL, priority INTEGER DEFAULT 50, status TEXT DEFAULT 'pending', attempts INTEGER DEFAULT 0, max_attempts INTEGER DEFAULT 3, available_at TEXT NOT NULL, locked_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_error TEXT DEFAULT '')`,
`CREATE TABLE IF NOT EXISTS ${T.pages}(id TEXT PRIMARY KEY, scan_id TEXT, source_id TEXT, url TEXT NOT NULL, normalized_url TEXT NOT NULL, depth INTEGER DEFAULT 0, status TEXT DEFAULT 'pending', http_status INTEGER DEFAULT 0, title TEXT DEFAULT '', fetched_at TEXT, created_at TEXT NOT NULL, error TEXT DEFAULT '')`,
`CREATE TABLE IF NOT EXISTS ${T.links}(id TEXT PRIMARY KEY, scan_id TEXT, page_id TEXT, source_id TEXT, url TEXT NOT NULL, normalized_url TEXT NOT NULL UNIQUE, host TEXT DEFAULT '', type TEXT DEFAULT '', health TEXT DEFAULT 'unknown', http_status INTEGER DEFAULT 0, score INTEGER DEFAULT 0, first_seen TEXT NOT NULL, last_seen TEXT NOT NULL, checked_at TEXT, context TEXT DEFAULT '', meta TEXT DEFAULT '{}')`,
`CREATE TABLE IF NOT EXISTS ${T.cache}(key TEXT PRIMARY KEY, type TEXT NOT NULL, value TEXT NOT NULL, expires_at TEXT NOT NULL, created_at TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS ${T.logs}(id TEXT PRIMARY KEY, created_at TEXT NOT NULL, level TEXT NOT NULL, event TEXT NOT NULL, data TEXT DEFAULT '{}')`,
`CREATE TABLE IF NOT EXISTS ${T.stats}(key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS ${T.settings}(key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)`,
`CREATE TABLE IF NOT EXISTS ${T.backups}(id TEXT PRIMARY KEY, created_at TEXT NOT NULL, reason TEXT NOT NULL, snapshot TEXT NOT NULL)`
  ];
  for (const s of stmts) await env.DB.prepare(s).run();
  const required = {
    [T.sessions]: {created_at:'TEXT DEFAULT \"1970-01-01T00:00:00.000Z\"', expires_at:'TEXT DEFAULT \"2999-01-01T00:00:00.000Z\"'},
    [T.sources]: {name:'TEXT DEFAULT \"\"', type:'TEXT DEFAULT \"html\"', url_template:'TEXT DEFAULT \"\"', enabled:'INTEGER DEFAULT 1', priority:'INTEGER DEFAULT 50', config:'TEXT DEFAULT \"{}\"', created_at:'TEXT DEFAULT \"1970-01-01T00:00:00.000Z\"', updated_at:'TEXT DEFAULT \"1970-01-01T00:00:00.000Z\"'},
    [T.scans]: {query:'TEXT DEFAULT \"\"', status:'TEXT DEFAULT \"pending\"', created_at:'TEXT DEFAULT \"1970-01-01T00:00:00.000Z\"', started_at:'TEXT', finished_at:'TEXT', elapsed_ms:'INTEGER DEFAULT 0', pages_found:'INTEGER DEFAULT 0', pages_scanned:'INTEGER DEFAULT 0', links_found:'INTEGER DEFAULT 0', links_alive:'INTEGER DEFAULT 0', links_dead:'INTEGER DEFAULT 0', links_unknown:'INTEGER DEFAULT 0', errors:'INTEGER DEFAULT 0', message:'TEXT DEFAULT \"\"'},
    [T.queue]: {scan_id:'TEXT DEFAULT \"\"', type:'TEXT DEFAULT \"crawl\"', payload:'TEXT DEFAULT \"{}\"', priority:'INTEGER DEFAULT 50', status:'TEXT DEFAULT \"pending\"', attempts:'INTEGER DEFAULT 0', max_attempts:'INTEGER DEFAULT 3', available_at:'TEXT DEFAULT \"1970-01-01T00:00:00.000Z\"', locked_at:'TEXT', created_at:'TEXT DEFAULT \"1970-01-01T00:00:00.000Z\"', updated_at:'TEXT DEFAULT \"1970-01-01T00:00:00.000Z\"', last_error:'TEXT DEFAULT \"\"'},
    [T.pages]: {scan_id:'TEXT DEFAULT \"\"', source_id:'TEXT DEFAULT \"\"', url:'TEXT DEFAULT \"\"', normalized_url:'TEXT DEFAULT \"\"', depth:'INTEGER DEFAULT 0', status:'TEXT DEFAULT \"pending\"', http_status:'INTEGER DEFAULT 0', title:'TEXT DEFAULT \"\"', fetched_at:'TEXT', created_at:'TEXT DEFAULT \"1970-01-01T00:00:00.000Z\"', error:'TEXT DEFAULT \"\"'},
    [T.links]: {scan_id:'TEXT DEFAULT \"\"', page_id:'TEXT DEFAULT \"\"', source_id:'TEXT DEFAULT \"\"', url:'TEXT DEFAULT \"\"', normalized_url:'TEXT DEFAULT \"\"', host:'TEXT DEFAULT \"\"', type:'TEXT DEFAULT \"\"', health:'TEXT DEFAULT \"unknown\"', http_status:'INTEGER DEFAULT 0', score:'INTEGER DEFAULT 0', first_seen:'TEXT DEFAULT \"1970-01-01T00:00:00.000Z\"', last_seen:'TEXT DEFAULT \"1970-01-01T00:00:00.000Z\"', checked_at:'TEXT', context:'TEXT DEFAULT \"\"', meta:'TEXT DEFAULT \"{}\"'}
  };
  for (const [table, cols] of Object.entries(required)){
    const info = await env.DB.prepare(`PRAGMA table_info(${table})`).all();
    const have = new Set((info.results||[]).map(x=>x.name));
    for (const [col, def] of Object.entries(cols)) if(!have.has(col)) await env.DB.prepare(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`).run();
  }
  const idx = [
    `CREATE INDEX IF NOT EXISTS idx_${TABLE_PREFIX}_queue_status ON ${T.queue}(status, available_at, priority)`,
    `CREATE INDEX IF NOT EXISTS idx_${TABLE_PREFIX}_pages_scan ON ${T.pages}(scan_id, status)`,
    `CREATE INDEX IF NOT EXISTS idx_${TABLE_PREFIX}_links_health ON ${T.links}(health, score)`,
    `CREATE INDEX IF NOT EXISTS idx_${TABLE_PREFIX}_links_scan ON ${T.links}(scan_id, source_id)`,
    `CREATE INDEX IF NOT EXISTS idx_${TABLE_PREFIX}_logs_created ON ${T.logs}(created_at)`
  ];
  for(const s of idx) await env.DB.prepare(s).run();
  await seedSources(env);
}
async function seedSources(env){
  const count = await env.DB.prepare(`SELECT COUNT(*) c FROM ${T.sources}`).first();
  if(count && count.c>0) return;
  const sources = defaultSources();
  for(const s of sources){
    await env.DB.prepare(`INSERT INTO ${T.sources}(id,name,type,url_template,enabled,priority,config,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`)
      .bind(s.id,s.name,s.type,s.url_template,1,s.priority,JSON.stringify(s.config||{}),now(),now()).run();
  }
}
function defaultSources(){ return [
  {id:'bing_rss', name:'Bing RSS', type:'rss', priority:95, url_template:'https://www.bing.com/search?format=rss&q={query}'},
  {id:'duck_lite', name:'DuckDuckGo Lite', type:'html', priority:88, url_template:'https://lite.duckduckgo.com/lite/?q={query}'},
  {id:'reddit_json', name:'Reddit Public JSON', type:'json_reddit', priority:86, url_template:'https://www.reddit.com/search.json?q={query}&sort=new&limit=25'},
  {id:'github_html', name:'GitHub Web Search', type:'html', priority:82, url_template:'https://github.com/search?q={query}&type=code'},
  {id:'ahmia_html', name:'Ahmia Web', type:'html', priority:65, url_template:'https://ahmia.fi/search/?q={query}'},
  {id:'rentry_site', name:'Rentry Targeted', type:'html', priority:75, url_template:'https://www.bing.com/search?format=rss&q=site%3Arentry.co+{query}'},
  {id:'pastebin_site', name:'Pastebin Targeted', type:'html', priority:72, url_template:'https://www.bing.com/search?format=rss&q=site%3Apastebin.com+{query}'},
  {id:'archive_site', name:'Archive Targeted', type:'html', priority:70, url_template:'https://www.bing.com/search?format=rss&q=site%3Aarchive.org+{query}'}
]; }
function buildSearchQueries(q){
  const clean = String(q||'').trim(); const enc = encodeURIComponent(clean);
  return [
    `${enc}+%22mega.nz%2Ffolder%22`,
    `${enc}+%22mega.nz%2Ffile%22`,
    `${enc}+%22mega.nz%22`,
    `site%3Amega.nz%2Ffolder%2F+%22${enc}%22`,
    `site%3Amega.nz%2Ffile%2F+%22${enc}%22`,
    `site%3Areddit.com+${enc}+%22mega.nz%22`,
    `site%3Agithub.com+${enc}+%22mega.nz%22`,
    `site%3Arentry.co+${enc}+%22mega.nz%22`,
    `site%3Apastebin.com+${enc}+%22mega.nz%22`
  ];
}
async function cacheGet(env,key){
  const row=await env.DB.prepare(`SELECT value FROM ${T.cache} WHERE key=? AND expires_at>?`).bind(key, now()).first();
  return row ? row.value : null;
}
async function cacheSet(env,key,type,value,ttl=3600){
  const exp = new Date(Date.now()+ttl*1000).toISOString();
  await env.DB.prepare(`INSERT OR REPLACE INTO ${T.cache}(key,type,value,expires_at,created_at) VALUES(?,?,?,?,?)`).bind(key,type,value,exp,now()).run();
}
async function addQueue(env, scanId, type, payload, priority=50, delaySec=0){
  const id=uid('q'); const av=new Date(Date.now()+delaySec*1000).toISOString();
  await env.DB.prepare(`INSERT INTO ${T.queue}(id,scan_id,type,payload,priority,status,attempts,max_attempts,available_at,created_at,updated_at) VALUES(?,?,?,?,?,'pending',0,3,?,?,?)`)
    .bind(id,scanId,type,JSON.stringify(payload),priority,av,now(),now()).run();
  return id;
}
async function upsertPage(env, scanId, sourceId, url, depth=0, status='pending'){
  const normalized = cleanUrl(url); if(!normalized) return null;
  const existing=await env.DB.prepare(`SELECT id FROM ${T.pages} WHERE normalized_url=? AND scan_id=?`).bind(normalized,scanId).first();
  if(existing) return existing.id;
  const id=uid('p');
  await env.DB.prepare(`INSERT INTO ${T.pages}(id,scan_id,source_id,url,normalized_url,depth,status,created_at) VALUES(?,?,?,?,?,?,?,?)`).bind(id,scanId,sourceId||'',url,normalized,depth,status,now()).run();
  return id;
}
async function upsertLink(env, {scanId,pageId,sourceId,url,context}){
  const n=normalizeMega(url); if(!n) return false;
  const type = /\/folder\//i.test(n) ? 'folder' : 'file'; const host=hostOf(n); const s=scoreLink(n, sourceId, context);
  const existing=await env.DB.prepare(`SELECT id,score FROM ${T.links} WHERE normalized_url=?`).bind(n).first();
  if(existing){
    await env.DB.prepare(`UPDATE ${T.links} SET last_seen=?, score=MAX(score,?), scan_id=COALESCE(scan_id,?), page_id=COALESCE(page_id,?), source_id=COALESCE(source_id,?) WHERE normalized_url=?`).bind(now(),s,scanId,pageId,sourceId,n).run();
    return true;
  }
  await env.DB.prepare(`INSERT INTO ${T.links}(id,scan_id,page_id,source_id,url,normalized_url,host,type,health,score,first_seen,last_seen,context) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(uid('l'),scanId||'',pageId||'',sourceId||'',n,n,host,type,'unknown',s,now(),now(),context||'').run();
  return true;
}
async function runSource(env, scanId, source, query){
  const queries=buildSearchQueries(query).slice(0,5); let pages=0, links=0, errors=0;
  for(const q of queries){
    const url = source.url_template.replace('{query}', q);
    const ck = 'fetch:'+await sha(url);
    let body = await cacheGet(env, ck);
    let status=0;
    if(!body){
      try{ const r=await limitedFetch(url,{accept:'text/html,application/json,application/rss+xml'}); body=r.text; status=r.status; await cacheSet(env,ck,'response',body,1800); }
      catch(e){ errors++; await log(env,'error','source_fetch_failed',{source:source.id,url,error:String(e)}); continue; }
    }
    const pageId=await upsertPage(env, scanId, source.id, url, 0, 'done'); pages++;
    const found=extractMegaLinks(body);
    for(const l of found){ if(await upsertLink(env,{scanId,pageId,sourceId:source.id,url:l.url,context:l.context})) links++; }
    const urls=extractUrls(body,url).filter(u=>!u.includes('accounts.google') && !u.includes('javascript:')).slice(0,20);
    for(const u of urls){
      if (/mega\.(nz|io)\/(file|folder)\//i.test(u)){ if(await upsertLink(env,{scanId,pageId,sourceId:source.id,url:u,context:'source-url'})) links++; }
      else if (/reddit\.com|github\.com|rentry\.co|pastebin\.com|archive\.org|gist\.github/i.test(u)) await addQueue(env,scanId,'crawl',{url:u, sourceId:source.id, depth:1},source.priority||50);
    }
    if(source.type==='json_reddit'){
      try{
        const j=JSON.parse(body); const posts=j?.data?.children||[];
        for(const p of posts){
          const d=p.data||{}; const candidates=[d.url,d.selftext,d.title,d.permalink].filter(Boolean).join('\n');
          for(const l of extractMegaLinks(candidates)){ if(await upsertLink(env,{scanId,pageId,sourceId:source.id,url:l.url,context:'reddit-post'})) links++; }
          if(d.permalink) await addQueue(env,scanId,'reddit_comments',{permalink:'https://www.reddit.com'+d.permalink, sourceId:source.id},source.priority||50);
        }
      }catch{}
    }
    await env.DB.prepare(`UPDATE ${T.pages} SET http_status=?, fetched_at=? WHERE id=?`).bind(status,now(),pageId).run();
  }
  await env.DB.prepare(`UPDATE ${T.scans} SET pages_found=pages_found+?, links_found=links_found+?, errors=errors+? WHERE id=?`).bind(pages,links,errors,scanId).run();
  return {pages,links,errors};
}
async function crawlUrl(env, scanId, url, sourceId='', depth=0){
  const normalized=cleanUrl(url); if(!normalized || depth>2) return {pages:0,links:0};
  const pageId=await upsertPage(env,scanId,sourceId,normalized,depth,'running');
  const ck='crawl:'+await sha(normalized); let body=await cacheGet(env,ck); let status=0;
  if(!body){ const r=await limitedFetch(normalized,{accept:'text/html,application/json,text/plain'}); body=r.text; status=r.status; await cacheSet(env,ck,'page',body,3600); }
  let links=0;
  for(const l of extractMegaLinks(body)){ if(await upsertLink(env,{scanId,pageId,sourceId,url:l.url,context:'crawl'})) links++; }
  const nexts = extractNextUrls(body, normalized).slice(0,8);
  for(const n of nexts) await addQueue(env,scanId,'crawl',{url:n, sourceId, depth:depth+1},40);
  const internal = extractUrls(body, normalized).filter(u=>sameHost(u,normalized)).slice(0,10);
  for(const u of internal) if(depth<1) await addQueue(env,scanId,'crawl',{url:u, sourceId, depth:depth+1},25);
  await env.DB.prepare(`UPDATE ${T.pages} SET status='done', http_status=?, fetched_at=? WHERE id=?`).bind(status,now(),pageId).run();
  await env.DB.prepare(`UPDATE ${T.scans} SET pages_scanned=pages_scanned+1, links_found=links_found+? WHERE id=?`).bind(links,scanId).run();
  return {pages:1,links};
}
async function redditComments(env, scanId, permalink, sourceId='reddit_json'){
  const url=permalink.endsWith('.json')?permalink:permalink.replace(/\/?$/,'')+'.json?limit=200';
  const r=await limitedFetch(url,{accept:'application/json'}); let links=0;
  const pageId=await upsertPage(env,scanId,sourceId,url,1,'done');
  try{
    const j=JSON.parse(r.text); const txt=[];
    const walk=(x)=>{ if(!x) return; if(Array.isArray(x)) return x.forEach(walk); if(typeof x==='object'){ if(x.body) txt.push(x.body); if(x.selftext) txt.push(x.selftext); Object.values(x).forEach(walk); } };
    walk(j);
    for(const l of extractMegaLinks(txt.join('\n'))){ if(await upsertLink(env,{scanId,pageId,sourceId,url:l.url,context:'reddit-comment'})) links++; }
  }catch(e){ await log(env,'warn','reddit_comments_parse',{url,error:String(e)}); }
  await env.DB.prepare(`UPDATE ${T.scans} SET pages_scanned=pages_scanned+1, links_found=links_found+? WHERE id=?`).bind(links,scanId).run();
  return {links};
}
function megaId(url){ const m=String(url).match(/mega\.(?:nz|io)\/(?:file|folder)\/([A-Za-z0-9_-]+)/i); return m?m[1]:''; }
async function checkMegaHealth(url){
  const id=megaId(url); let status=0;
  if(id){
    try{
      const r=await limitedFetch('https://g.api.mega.co.nz/cs?id='+(Date.now()%999999), {method:'POST', headers:{'content-type':'application/json'}, timeout:10000});
      // limitedFetch does not send body, so fallback below is primary. Keep structural API-ready placeholder inactive.
    }catch{}
  }
  try{
    const h=await limitedFetch(url,{method:'HEAD',timeout:8000}); status=h.status;
    if([200,301,302,303,307,308,403,405].includes(h.status)) return {health:'alive', http_status:h.status};
    if([404,410,451].includes(h.status)) return {health:'dead', http_status:h.status};
  }catch{}
  try{
    const g=await limitedFetch(url,{timeout:10000,accept:'text/html'}); status=g.status;
    const body=(g.text||'').slice(0,6000).toLowerCase();
    if(g.status>=200 && g.status<400 && !body.includes('not found') && !body.includes('no longer available')) return {health:'alive', http_status:g.status};
    if(body.includes('not found') || body.includes('no longer available') || g.status===404) return {health:'dead', http_status:g.status};
    return {health:'unknown', http_status:g.status};
  }catch(e){ return {health:'unknown', http_status:status}; }
}
async function processQueue(env, limit=20){
  await ensureDb(env); const started=Date.now(); let done=0, failed=0;
  const rows=(await env.DB.prepare(`SELECT * FROM ${T.queue} WHERE status='pending' AND available_at<=? ORDER BY priority DESC, created_at ASC LIMIT ?`).bind(now(),limit).all()).results||[];
  for(const row of rows){
    await env.DB.prepare(`UPDATE ${T.queue} SET status='running', locked_at=?, attempts=attempts+1, updated_at=? WHERE id=?`).bind(now(),now(),row.id).run();
    try{
      const p=JSON.parse(row.payload||'{}');
      if(row.type==='source'){
        const src=await env.DB.prepare(`SELECT * FROM ${T.sources} WHERE id=? AND enabled=1`).bind(p.sourceId).first();
        if(src) await runSource(env,row.scan_id,src,p.query||'');
      } else if(row.type==='crawl') await crawlUrl(env,row.scan_id,p.url,p.sourceId,p.depth||0);
      else if(row.type==='reddit_comments') await redditComments(env,row.scan_id,p.permalink,p.sourceId);
      else if(row.type==='health'){
        const res=await checkMegaHealth(p.url);
        await env.DB.prepare(`UPDATE ${T.links} SET health=?, http_status=?, checked_at=? WHERE normalized_url=?`).bind(res.health,res.http_status,now(),p.url).run();
      }
      await env.DB.prepare(`UPDATE ${T.queue} SET status='done', updated_at=? WHERE id=?`).bind(now(),row.id).run(); done++;
    }catch(e){
      failed++; const retryAt=new Date(Date.now()+60000*Math.min(10,(row.attempts||0)+1)).toISOString();
      const status = (row.attempts+1 >= (row.max_attempts||3)) ? 'failed' : 'pending';
      await env.DB.prepare(`UPDATE ${T.queue} SET status=?, available_at=?, updated_at=?, last_error=? WHERE id=?`).bind(status,retryAt,now(),String(e).slice(0,500),row.id).run();
      await log(env,'error','queue_failed',{id:row.id,type:row.type,error:String(e)});
    }
  }
  await refreshScanStats(env);
  return {ok:true, processed:rows.length, done, failed, elapsed_ms:Date.now()-started};
}
async function refreshScanStats(env){
  const scans=(await env.DB.prepare(`SELECT id FROM ${T.scans} WHERE status IN ('running','queued') ORDER BY created_at DESC LIMIT 10`).all()).results||[];
  for(const s of scans){
    const links=await env.DB.prepare(`SELECT COUNT(*) total, SUM(health='alive') alive, SUM(health='dead') dead, SUM(health='unknown') unknown FROM ${T.links} WHERE scan_id=?`).bind(s.id).first();
    const pend=await env.DB.prepare(`SELECT COUNT(*) c FROM ${T.queue} WHERE scan_id=? AND status IN ('pending','running')`).bind(s.id).first();
    const status = pend.c>0 ? 'running' : 'done';
    await env.DB.prepare(`UPDATE ${T.scans} SET status=?, finished_at=CASE WHEN ?='done' THEN ? ELSE finished_at END, links_found=?, links_alive=?, links_dead=?, links_unknown=? WHERE id=?`)
      .bind(status,status,now(),links.total||0,links.alive||0,links.dead||0,links.unknown||0,s.id).run();
  }
}
async function startScan(env, query, mode='manual'){
  await ensureDb(env); const id=uid('scan');
  await env.DB.prepare(`INSERT INTO ${T.scans}(id,query,status,created_at,started_at,message) VALUES(?,?,?,?,?,?)`).bind(id,query,'running',now(),now(),mode).run();
  const sources=(await env.DB.prepare(`SELECT * FROM ${T.sources} WHERE enabled=1 ORDER BY priority DESC`).all()).results||[];
  for(const src of sources) await addQueue(env,id,'source',{sourceId:src.id,query},src.priority||50);
  return {scan_id:id, queued:sources.length};
}
async function doAutoscan(env){
  const patterns = ['mega.nz/folder index', 'mega.nz/file key', 'public mega.nz folder', 'public mega.nz file', 'site:reddit.com mega.nz', 'site:github.com mega.nz', 'site:rentry.co mega.nz', 'site:pastebin.com mega.nz'];
  const cursorKey='autoscan_cursor';
  const row=await env.DB.prepare(`SELECT value FROM ${T.settings} WHERE key=?`).bind(cursorKey).first();
  const i = row ? (parseInt(row.value,10)||0) : 0;
  const query=patterns[i % patterns.length];
  await env.DB.prepare(`INSERT OR REPLACE INTO ${T.settings}(key,value,updated_at) VALUES(?,?,?)`).bind(cursorKey,String(i+1),now()).run();
  return await startScan(env, query, 'autoscan');
}
async function stats(env){
  await ensureDb(env); await refreshScanStats(env);
  const q=async(sql,...args)=>env.DB.prepare(sql).bind(...args).first();
  const counts={
    scans: await q(`SELECT COUNT(*) c FROM ${T.scans}`),
    pages: await q(`SELECT COUNT(*) c FROM ${T.pages}`),
    links: await q(`SELECT COUNT(*) c FROM ${T.links}`),
    alive: await q(`SELECT COUNT(*) c FROM ${T.links} WHERE health='alive'`),
    dead: await q(`SELECT COUNT(*) c FROM ${T.links} WHERE health='dead'`),
    unknown: await q(`SELECT COUNT(*) c FROM ${T.links} WHERE health='unknown'`),
    queue_pending: await q(`SELECT COUNT(*) c FROM ${T.queue} WHERE status='pending'`),
    queue_running: await q(`SELECT COUNT(*) c FROM ${T.queue} WHERE status='running'`),
    cache: await q(`SELECT COUNT(*) c FROM ${T.cache} WHERE expires_at>?`, now()),
    sources: await q(`SELECT COUNT(*) c FROM ${T.sources} WHERE enabled=1`)
  };
  return Object.fromEntries(Object.entries(counts).map(([k,v])=>[k,v?.c||0]));
}
async function diagnostics(env){
  await ensureDb(env);
  const tables={};
  for(const name of Object.values(T)){
    const info=(await env.DB.prepare(`PRAGMA table_info(${name})`).all()).results||[];
    tables[name]=info.map(c=>c.name);
  }
  return {ok:true, version:VERSION, prefix:TABLE_PREFIX, tables, stats: await stats(env)};
}
async function repair(env){
  await ensureDb(env);
  const snapshot=await stats(env);
  await env.DB.prepare(`INSERT INTO ${T.backups}(id,created_at,reason,snapshot) VALUES(?,?,?,?)`).bind(uid('bak'),now(),'repair-before-upgrade',JSON.stringify(snapshot)).run();
  return {ok:true, repaired:true, snapshot};
}
async function cleanData(env){
  await ensureDb(env);
  await env.DB.prepare(`DELETE FROM ${T.cache} WHERE expires_at<=?`).bind(now()).run();
  await env.DB.prepare(`DELETE FROM ${T.queue} WHERE status IN ('done','failed') AND updated_at < datetime('now','-2 days')`).run();
  return {ok:true, stats: await stats(env)};
}
async function resetAll(env){
  await ensureDb(env);
  for(const t of [T.scans,T.queue,T.pages,T.links,T.cache,T.logs,T.stats,T.settings]) await env.DB.prepare(`DELETE FROM ${t}`).run();
  return {ok:true, reset:true};
}
async function results(env, req){
  const u=new URL(req.url); const health=u.searchParams.get('health')||''; const search=u.searchParams.get('q')||''; const limit=Math.min(200, parseInt(u.searchParams.get('limit')||'100',10));
  let sql=`SELECT * FROM ${T.links} WHERE 1=1`, args=[];
  if(health){ sql+=' AND health=?'; args.push(health); }
  if(search){ sql+=' AND normalized_url LIKE ?'; args.push('%'+escapeLike(search)+'%'); }
  sql+=' ORDER BY score DESC, last_seen DESC LIMIT ?'; args.push(limit);
  const rows=(await env.DB.prepare(sql).bind(...args).all()).results||[];
  return {ok:true, results:rows};
}
function toCSV(rows){
  const cols=['url','type','health','http_status','score','source_id','first_seen','last_seen','checked_at'];
  const esc=v=>'"'+String(v??'').replace(/"/g,'""')+'"';
  return [cols.join(','), ...rows.map(r=>cols.map(c=>esc(r[c])).join(','))].join('\n');
}
async function exportData(env, req){
  const u=new URL(req.url); const format=u.searchParams.get('format')||'csv';
  const rows=(await env.DB.prepare(`SELECT * FROM ${T.links} ORDER BY score DESC,last_seen DESC LIMIT 10000`).all()).results||[];
  if(format==='json') return json({ok:true, exported_at:now(), results:rows});
  return csv(toCSV(rows), 'nimbus-v27-links.csv');
}
async function handleApi(req, env, ctx){
  const url=new URL(req.url); const path=url.pathname;
  if(path==='/api/login' && req.method==='POST'){
    await ensureDb(env); const b=await bodyJson(req); const pin=String(b.pin||''); const expected=String(env.NIMBUS_PIN||env.AUTH_PIN||DEFAULT_PIN);
    if(pin!==expected) return json({ok:false,error:'Invalid PIN'},403);
    const token=uid('sess'); const exp=new Date(Date.now()+7*86400000).toISOString();
    await env.DB.prepare(`INSERT INTO ${T.sessions}(token,created_at,expires_at) VALUES(?,?,?)`).bind(token,now(),exp).run();
    return json({ok:true,token,version:VERSION},200,{'set-cookie':`nimbus_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${7*86400}`});
  }
  if(path==='/api/version') return json({ok:true,version:VERSION});
  const auth = await requireAuth(req,env); if(auth) return auth;
  if(path==='/api/check-db') return json(await diagnostics(env));
  if(path==='/api/repair-db') return json(await repair(env));
  if(path==='/api/diagnostics') return json(await diagnostics(env));
  if(path==='/api/stats') return json({ok:true, stats: await stats(env)});
  if(path==='/api/sources' && req.method==='GET') { await ensureDb(env); return json({ok:true,sources:(await env.DB.prepare(`SELECT * FROM ${T.sources} ORDER BY priority DESC`).all()).results||[]}); }
  if(path==='/api/sources' && req.method==='POST'){
    await ensureDb(env); const b=await bodyJson(req); const id=b.id||uid('src');
    await env.DB.prepare(`INSERT OR REPLACE INTO ${T.sources}(id,name,type,url_template,enabled,priority,config,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`)
      .bind(id,b.name||id,b.type||'html',b.url_template||'',b.enabled?1:0,b.priority||50,JSON.stringify(b.config||{}),now(),now()).run();
    return json({ok:true,id});
  }
  if(path==='/api/scan' && req.method==='POST') { const b=await bodyJson(req); return json({ok:true, ...(await startScan(env,String(b.query||'').trim()||'mega.nz','manual'))}); }
  if(path==='/api/autoscan') return json({ok:true, ...(await doAutoscan(env))});
  if(path==='/api/process-queue') return json(await processQueue(env, Math.min(80, parseInt(url.searchParams.get('limit')||'25',10))));
  if(path==='/api/check-batch'){
    await ensureDb(env); const rows=(await env.DB.prepare(`SELECT normalized_url FROM ${T.links} WHERE checked_at IS NULL OR checked_at < datetime('now','-12 hours') ORDER BY score DESC LIMIT ?`).bind(Math.min(100, parseInt(url.searchParams.get('limit')||'30',10))).all()).results||[];
    for(const r of rows) await addQueue(env,'','health',{url:r.normalized_url},70);
    const res=await processQueue(env, rows.length);
    return json({ok:true, queued:rows.length, processed:res});
  }
  if(path==='/api/extract-url' && req.method==='POST'){
    await ensureDb(env); const b=await bodyJson(req); const scan=await startScan(env,b.url||'direct-url','extract-url'); await addQueue(env,scan.scan_id,'crawl',{url:b.url,sourceId:'manual_url',depth:0},99); const pr=await processQueue(env,5); return json({ok:true,scan,processed:pr});
  }
  if(path==='/api/results') return json(await results(env,req));
  if(path==='/api/export') return await exportData(env,req);
  if(path==='/api/clean-data') return json(await cleanData(env));
  if(path==='/api/reset-queue') { await ensureDb(env); await env.DB.prepare(`DELETE FROM ${T.queue}`).run(); return json({ok:true}); }
  if(path==='/api/reset-cache') { await ensureDb(env); await env.DB.prepare(`DELETE FROM ${T.cache}`).run(); return json({ok:true}); }
  if(path==='/api/reset-cursor') { await ensureDb(env); await env.DB.prepare(`DELETE FROM ${T.settings} WHERE key='autoscan_cursor'`).run(); return json({ok:true}); }
  if(path==='/api/ping') return json({ok:true, time:now(), version:VERSION});
  return json({ok:false,error:'API route not found',path},404);
}
async function serveAsset(req, env){
  if(env.ASSETS) return env.ASSETS.fetch(req);
  return html('<h1>Nimbus Core V27</h1><p>Static assets binding missing.</p>');
}
export default {
  async fetch(req, env, ctx){
    const url=new URL(req.url);
    try{
      if(url.pathname.startsWith('/api/')) return await handleApi(req,env,ctx);
      if(url.pathname==='/reset') { await resetAll(env); return html(`<meta name="viewport" content="width=device-width,initial-scale=1"><body style="font-family:system-ui;background:#07111f;color:white;padding:30px"><h1>Nimbus Core reset done</h1><p>Version ${VERSION}</p><p><a style="color:#80c7ff" href="/">Open app</a></p></body>`); }
      return await serveAsset(req,env);
    }catch(e){
      try{ await log(env,'fatal','request_failed',{path:url.pathname,error:String(e),stack:e.stack}); }catch{}
      return json({ok:false,error:String(e),stack:e.stack,version:VERSION},500);
    }
  },
  async scheduled(event, env, ctx){
    ctx.waitUntil((async()=>{ await ensureDb(env); await doAutoscan(env); await processQueue(env,50); })());
  }
};
