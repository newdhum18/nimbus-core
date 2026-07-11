const VERSION = '35.2.2-npm-install-fixed';
const T = {
  migrations: 'nimbus_v352_migrations',
  runs: 'nimbus_v352_runs',
  tasks: 'nimbus_v352_tasks',
  links: 'nimbus_v352_links',
  sources: 'nimbus_v352_sources',
  events: 'nimbus_v352_events',
  metrics: 'nimbus_v352_source_metrics',
  visited: 'nimbus_v352_visited_urls'
};
const TOTAL_SOURCES = 300;
const DEFAULT_ENABLED = 80;
const INITIAL_DISPATCH = 2;
const CONTINUATION_DISPATCH = 1;
const REQUEST_TIMEOUT_MS = 6000;
const MAX_BODY = 240000;
const MAX_TARGETS_PER_SEARCH = 4;
const MAX_LINKS_PER_PAGE = 25;
const MAX_TASK_ATTEMPTS = 4;
const VISIT_TTL_DAYS = 30;
const USER_AGENT = 'Mozilla/5.0 (compatible; NimbusCore/35.2; +https://workers.dev)';

const now = () => new Date().toISOString();
const uid = (p='id') => `${p}_${Date.now().toString(36)}_${crypto.randomUUID().replaceAll('-','').slice(0,12)}`;
const json = (data, status=200) => new Response(JSON.stringify(data, null, 2), {
  status,
  headers: {
    'content-type':'application/json; charset=utf-8',
    'cache-control':'no-store',
    'access-control-allow-origin':'*',
    'access-control-allow-methods':'GET,POST,OPTIONS',
    'access-control-allow-headers':'content-type,authorization,x-nimbus-token'
  }
});
const q = (env, sql, params=[]) => env.DB.prepare(sql).bind(...params).run();
const first = (env, sql, params=[]) => env.DB.prepare(sql).bind(...params).first();
const all = (env, sql, params=[]) => env.DB.prepare(sql).bind(...params).all();
const chunk = (arr, size) => Array.from({length:Math.ceil(arr.length/size)},(_,i)=>arr.slice(i*size,(i+1)*size));

function requireAdmin(req, env) {
  const expected = String(env.ADMIN_TOKEN || '').trim();
  if (!expected) return true;
  const auth = req.headers.get('authorization') || '';
  const token = req.headers.get('x-nimbus-token') || (auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : '');
  return token === expected;
}

async function logEvent(env, level, message, meta={}) {
  try { await q(env, `INSERT INTO ${T.events}(id,level,message,meta,created_at) VALUES(?,?,?,?,?)`, [uid('evt'),level,message,JSON.stringify(meta),now()]); } catch {}
}

async function ensureDb(env) {
  if (!env.DB) throw new Error('Missing D1 binding DB');
  try {
    const m = await first(env, `SELECT version FROM ${T.migrations} WHERE version=?`, [VERSION]);
    if (m) return;
  } catch {}
  const ddl = [
    `CREATE TABLE IF NOT EXISTS ${T.migrations}(version TEXT PRIMARY KEY,applied_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS ${T.runs}(id TEXT PRIMARY KEY,mode TEXT NOT NULL,keyword TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'running',total_tasks INTEGER NOT NULL DEFAULT 0,completed_tasks INTEGER NOT NULL DEFAULT 0,failed_tasks INTEGER NOT NULL DEFAULT 0,links_found INTEGER NOT NULL DEFAULT 0,progress_percent REAL NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,finished_at TEXT,stop_reason TEXT)`,
    `CREATE TABLE IF NOT EXISTS ${T.tasks}(id TEXT PRIMARY KEY,run_id TEXT NOT NULL,source_id TEXT NOT NULL,task_type TEXT NOT NULL DEFAULT 'search',query TEXT NOT NULL DEFAULT '',target_url TEXT NOT NULL DEFAULT '',parent_task_id TEXT,depth INTEGER NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'pending',attempts INTEGER NOT NULL DEFAULT 0,lease_until TEXT,last_error TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,UNIQUE(run_id,source_id,task_type,query,target_url))`,
    `CREATE TABLE IF NOT EXISTS ${T.links}(id TEXT PRIMARY KEY,run_id TEXT NOT NULL,link TEXT NOT NULL,normalized TEXT NOT NULL,source_id TEXT NOT NULL,page_url TEXT,health TEXT NOT NULL DEFAULT 'unverified',score INTEGER NOT NULL DEFAULT 0,first_seen_at TEXT NOT NULL,last_seen_at TEXT NOT NULL,UNIQUE(run_id,normalized))`,
    `CREATE TABLE IF NOT EXISTS ${T.sources}(id TEXT PRIMARY KEY,name TEXT NOT NULL,category TEXT NOT NULL,type TEXT NOT NULL,priority INTEGER NOT NULL DEFAULT 50,enabled INTEGER NOT NULL DEFAULT 0,template TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS ${T.events}(id TEXT PRIMARY KEY,level TEXT NOT NULL,message TEXT NOT NULL,meta TEXT,created_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS ${T.metrics}(source_id TEXT PRIMARY KEY,requests INTEGER NOT NULL DEFAULT 0,successes INTEGER NOT NULL DEFAULT 0,failures INTEGER NOT NULL DEFAULT 0,blocked INTEGER NOT NULL DEFAULT 0,links_found INTEGER NOT NULL DEFAULT 0,total_ms INTEGER NOT NULL DEFAULT 0,consecutive_failures INTEGER NOT NULL DEFAULT 0,cooldown_until TEXT,last_status INTEGER,last_error TEXT,last_success_at TEXT,updated_at TEXT NOT NULL)`,
    `CREATE TABLE IF NOT EXISTS ${T.visited}(url TEXT PRIMARY KEY,last_run_id TEXT,last_status INTEGER,links_found INTEGER NOT NULL DEFAULT 0,last_scanned_at TEXT NOT NULL)`,
    `CREATE INDEX IF NOT EXISTS idx_v352_tasks_status ON ${T.tasks}(status,updated_at)`,
    `CREATE INDEX IF NOT EXISTS idx_v352_tasks_run ON ${T.tasks}(run_id,status)`,
    `CREATE INDEX IF NOT EXISTS idx_v352_links_run ON ${T.links}(run_id,score DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_v352_sources_enabled ON ${T.sources}(enabled,priority DESC)`
  ];
  await env.DB.exec(ddl.join(';\n'));
  await q(env, `INSERT OR IGNORE INTO ${T.migrations}(version,applied_at) VALUES(?,?)`, [VERSION,now()]);
}

function sourceCatalog() {
  const highDomains = [
    'rentry.co','pastebin.com','paste.ee','justpaste.it','controlc.com','dpaste.org','pastes.io','paste.rs',
    'pastelink.net','telegra.ph','reddit.com','old.reddit.com','archive.org','github.com','gist.github.com','raw.githubusercontent.com',
    'gitlab.com','notion.site','linktr.ee','blogspot.com'
  ];
  const engines = [
    ['bing-rss','rss','https://www.bing.com/search?format=rss&q=site%3A{domain}%20{q}%20%22mega.nz%2Ffolder%22'],
    ['ddg-lite','html','https://lite.duckduckgo.com/lite/?q=site%3A{domain}%20{q}%20%22mega.nz%2Ffolder%22'],
    ['ddg-html','html','https://duckduckgo.com/html/?q=site%3A{domain}%20{q}%20%22mega.nz%2Ffolder%22'],
    ['bing-web','html','https://www.bing.com/search?q=site%3A{domain}%20{q}%20%22mega.nz%2Ffolder%22&count=20']
  ];
  const rows=[];
  let n=0;
  for (const domain of highDomains) for (const [engine,type,tpl] of engines) {
    n++;
    rows.push({id:`high_${String(n).padStart(3,'0')}`,name:`${engine} ${domain}`,category:/paste|rentry|controlc|dpaste/.test(domain)?'paste':/git/.test(domain)?'code':/reddit/.test(domain)?'community':/archive/.test(domain)?'archive':'web',type,priority:1000-n,enabled:1,template:tpl.replace('{domain}',domain)});
  }
  const reserveDomains = [
    'hastebin.com','ghostbin.co','privatebin.net','github.io','bitbucket.org','sourceforge.net','scribd.com','slideshare.net','issuu.com','beacons.ai',
    'bio.link','solo.to','msha.ke','taplink.cc','allmylinks.com','instabio.cc','heylink.me','lnk.bio','flow.page','about.me','carrd.co','campsite.bio',
    'linkin.bio','bio.fm','hypage.com','koji.to','linkpop.com','snipfeed.co','milkshake.app','shor.by','tap.bio','medium.com','substack.com','notion.so',
    'docs.google.com','sites.google.com','wordpress.com','tumblr.com','wixsite.com','weebly.com','gitbook.io','readthedocs.io','readme.io','calameo.com'
  ];
  const facets=['folder','index','archive','collection','public'];
  let i=0;
  while(rows.length<TOTAL_SOURCES){
    const domain=reserveDomains[i%reserveDomains.length], facet=facets[i%facets.length], engine=i%3;
    let type='html',template;
    if(engine===0)template=`https://www.bing.com/search?q=site%3A${domain}%20{q}%20%22mega.nz%2Ffolder%22%20${facet}&count=20`;
    else if(engine===1){type='rss';template=`https://www.bing.com/search?format=rss&q=site%3A${domain}%20{q}%20%22mega.nz%2Ffolder%22%20${facet}`;}
    else template=`https://lite.duckduckgo.com/lite/?q=site%3A${domain}%20{q}%20%22mega.nz%2Ffolder%22%20${facet}`;
    rows.push({id:`reserve_${String(i+1).padStart(3,'0')}`,name:`${domain} ${facet}`,category:'reserve',type,priority:300-(i%100),enabled:0,template}); i++;
  }
  return rows.slice(0,TOTAL_SOURCES);
}

function buildMultiInsert(table, columns, rows, conflictSql='') {
  const placeholders = rows.map(()=>`(${columns.map(()=>'?').join(',')})`).join(',');
  return {sql:`INSERT INTO ${table}(${columns.join(',')}) VALUES ${placeholders} ${conflictSql}`,params:rows.flat()};
}

async function seedSources(env, {preserveEnabled=true, allowDuringRun=false}={}) {
  await ensureDb(env);
  if(!allowDuringRun){
    const active=await first(env,`SELECT id FROM ${T.runs} WHERE status IN ('running','paused') LIMIT 1`);
    if(active)throw new Error('Cannot reset sources while a run is active');
  }
  const catalog=sourceCatalog(), existing=new Map();
  if(preserveEnabled){const r=await all(env,`SELECT id,enabled FROM ${T.sources}`);for(const x of r.results||[])existing.set(x.id,Number(x.enabled));}
  await q(env,`DELETE FROM ${T.sources}`);
  const ts=now();
  for(const part of chunk(catalog,10)){
    const rows=part.map(s=>[s.id,s.name,s.category,s.type,s.priority,existing.has(s.id)?existing.get(s.id):s.enabled,s.template,ts,ts]);
    const ins=buildMultiInsert(T.sources,['id','name','category','type','priority','enabled','template','created_at','updated_at'],rows);
    await q(env,ins.sql,ins.params);
  }
  return {total:catalog.length,enabled:catalog.filter(s=>(existing.has(s.id)?existing.get(s.id):s.enabled)).length};
}

function queryFor(keyword,mode){const clean=String(keyword||'').replace(/[\r\n\t]+/g,' ').replace(/\s+/g,' ').trim();return clean?`${clean} "mega.nz/folder"`:'"mega.nz/folder"';}
function normalizeUrl(raw){try{const u=new URL(String(raw||'').replaceAll('&amp;','&'));if(!/^https?:$/.test(u.protocol)||/mega\.(nz|co\.nz)$/i.test(u.hostname))return null;u.hash='';return u.toString();}catch{return null;}}
function discoverTargets(text,baseUrl){const found=[];const push=v=>{const u=normalizeUrl(v);if(u&&!found.includes(u))found.push(u)};const d=String(text||'').replaceAll('&amp;','&').replaceAll('\\/','/');for(const m of d.matchAll(/https?:\/\/[^\s"'<>]+/gi))push(m[0].replace(/[),.;]+$/,''));for(const m of d.matchAll(/(?:href|url|uddg|target|q)=["']?([^"'&<>\s]+)/gi)){try{push(decodeURIComponent(m[1]))}catch{push(m[1])}}try{const b=new URL(baseUrl);for(const m of d.matchAll(/href=["'](\/[^"']+)["']/gi))push(new URL(m[1],b).toString())}catch{}return found.filter(u=>!/google\.|bing\.com\/search|duckduckgo\.com\/(html|lite)/i.test(u)).slice(0,MAX_TARGETS_PER_SEARCH);}
function extractMega(text){const d=String(text||'').replaceAll('&amp;','&').replaceAll('\\/','/').replace(/%3A/gi,':').replace(/%2F/gi,'/').replace(/%23/gi,'#');const re=/https?:\/\/(?:www\.)?mega\.(?:nz|co\.nz)\/(?:folder\/[A-Za-z0-9_-]{4,}#[A-Za-z0-9_!-]{8,}|#F![A-Za-z0-9_-]{4,}![A-Za-z0-9_!-]{8,})/gi;return [...new Set(d.match(re)||[])].map(x=>x.replace(/[),.;]+$/,'')).slice(0,MAX_LINKS_PER_PAGE);}
function classifyResponse(result){const t=String(result?.text||'').toLowerCase();const blocked=/(captcha|verify you are human|access denied|cloudflare ray id|unusual traffic|rate limit)/i.test(t);const retryable=[408,425,429,500,502,503,504].includes(Number(result?.status));return {ok:!!result?.ok&&!blocked,blocked,retryable};}

async function fetchText(url){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),REQUEST_TIMEOUT_MS),started=Date.now();try{const res=await fetch(url,{redirect:'follow',signal:controller.signal,headers:{'user-agent':USER_AGENT,'accept':'text/html,application/json,application/rss+xml,text/plain;q=0.9,*/*;q=0.5'}});const text=(await res.text()).slice(0,MAX_BODY);return{ok:res.ok,status:res.status,url:res.url,text,elapsed:Date.now()-started};}finally{clearTimeout(timer);}}
function scoreLink(link,source){let score=70;if(/\/folder\//.test(link))score+=10;if(/rentry|paste|github|reddit|archive/i.test(source))score+=10;return Math.min(100,score);}

async function startRun(env,mode,keyword=''){
  await ensureDb(env);
  const existing=await first(env,`SELECT id,status FROM ${T.runs} WHERE status IN ('running','paused') LIMIT 1`);
  if(existing)throw new Error(`An active run already exists: ${existing.id}`);
  let src=await all(env,`SELECT s.* FROM ${T.sources} s LEFT JOIN ${T.metrics} m ON m.source_id=s.id WHERE s.enabled=1 AND (m.cooldown_until IS NULL OR m.cooldown_until<?) ORDER BY s.priority DESC LIMIT ?`,[now(),DEFAULT_ENABLED]);
  if(!(src.results||[]).length) throw new Error('Sources are not initialized. Run Repair DB once.');
  const sources=src.results||[],runId=uid('run'),ts=now(),query=queryFor(keyword,mode);
  await q(env,`INSERT INTO ${T.runs}(id,mode,keyword,status,total_tasks,created_at,updated_at) VALUES(?,?,?,?,?,?,?)`,[runId,mode,keyword,'running',sources.length,ts,ts]);
  for(const part of chunk(sources,8)){
    const rows=part.map(s=>[uid('task'),runId,s.id,'search',query,'',null,0,'pending',0,null,null,ts,ts]);
    const ins=buildMultiInsert(T.tasks,['id','run_id','source_id','task_type','query','target_url','parent_task_id','depth','status','attempts','lease_until','last_error','created_at','updated_at'],rows);
    await q(env,ins.sql,ins.params);
  }
  await dispatchPending(env,runId,INITIAL_DISPATCH);
  await logEvent(env,'info','run_started',{runId,mode,sources:sources.length});
  return runStatus(env,runId);
}

async function dispatchPending(env,runId,limit=1){
  if(!env.QUEUE)return{sent:0,reason:'missing_queue'};
  const run=await first(env,`SELECT status FROM ${T.runs} WHERE id=?`,[runId]);if(!run||run.status!=='running')return{sent:0,reason:'run_not_running'};
  const rows=await all(env,`SELECT id FROM ${T.tasks} WHERE run_id=? AND status IN ('pending','retry') ORDER BY created_at LIMIT ?`,[runId,limit]);let sent=0;
  for(const row of rows.results||[]){
    const claimed=await q(env,`UPDATE ${T.tasks} SET status='dispatching',updated_at=? WHERE id=? AND status IN ('pending','retry')`,[now(),row.id]);if(!(claimed.meta?.changes||0))continue;
    try{await env.QUEUE.send({task_id:row.id});await q(env,`UPDATE ${T.tasks} SET status='queued',updated_at=? WHERE id=?`,[now(),row.id]);sent++;}
    catch(e){await q(env,`UPDATE ${T.tasks} SET status='pending',last_error=?,updated_at=? WHERE id=?`,[String(e?.message||e).slice(0,300),now(),row.id]);}
  }
  return{sent};
}

async function recentlyVisited(env,url){const cutoff=new Date(Date.now()-VISIT_TTL_DAYS*86400000).toISOString();return !!(await first(env,`SELECT url FROM ${T.visited} WHERE url=? AND last_scanned_at>=?`,[url,cutoff]));}
async function markVisited(env,url,runId,status,links){await q(env,`INSERT INTO ${T.visited}(url,last_run_id,last_status,links_found,last_scanned_at) VALUES(?,?,?,?,?) ON CONFLICT(url) DO UPDATE SET last_run_id=excluded.last_run_id,last_status=excluded.last_status,links_found=excluded.links_found,last_scanned_at=excluded.last_scanned_at`,[url,runId,status,links,now()]);}

async function updateMetric(env,sourceId,result,linkCount,error=null,blocked=false){const ts=now(),fail=!!error||!result?.ok||blocked,consecutive=fail?1:0,cooldown=fail?new Date(Date.now()+30*60*1000).toISOString():null;await q(env,`INSERT INTO ${T.metrics}(source_id,requests,successes,failures,blocked,links_found,total_ms,consecutive_failures,cooldown_until,last_status,last_error,last_success_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(source_id) DO UPDATE SET requests=requests+1,successes=successes+excluded.successes,failures=failures+excluded.failures,blocked=blocked+excluded.blocked,links_found=links_found+excluded.links_found,total_ms=total_ms+excluded.total_ms,consecutive_failures=CASE WHEN excluded.failures=1 THEN consecutive_failures+1 ELSE 0 END,cooldown_until=CASE WHEN excluded.failures=1 AND consecutive_failures+1>=5 THEN excluded.cooldown_until ELSE NULL END,last_status=excluded.last_status,last_error=excluded.last_error,last_success_at=COALESCE(excluded.last_success_at,last_success_at),updated_at=excluded.updated_at`,[sourceId,1,fail?0:1,fail?1:0,blocked?1:0,linkCount,Number(result?.elapsed||0),consecutive,cooldown,result?.status||null,fail?String(error||`http_${result?.status}`).slice(0,500):null,fail?null:ts,ts]);}

async function addCrawlTasks(env,task,targets){if(!targets.length)return 0;const ts=now(),rows=[];for(const target of targets){if(await recentlyVisited(env,target))continue;rows.push([uid('task'),task.run_id,task.source_id,'crawl','',target,task.id,1,'pending',0,null,null,ts,ts]);}
  if(!rows.length)return 0;const ins=buildMultiInsert(T.tasks,['id','run_id','source_id','task_type','query','target_url','parent_task_id','depth','status','attempts','lease_until','last_error','created_at','updated_at'],rows,'ON CONFLICT(run_id,source_id,task_type,query,target_url) DO NOTHING');const r=await q(env,ins.sql,ins.params);return Number(r.meta?.changes||0);}
async function saveLinks(env,current,result,links){if(!links.length)return 0;const ts=now();for(const part of chunk(links,5)){const rows=part.map(link=>[uid('link'),current.run_id,link,link,current.source_id,result.url,'unverified',scoreLink(link,current.name),ts,ts]);const ins=buildMultiInsert(T.links,['id','run_id','link','normalized','source_id','page_url','health','score','first_seen_at','last_seen_at'],rows,'ON CONFLICT(run_id,normalized) DO UPDATE SET last_seen_at=excluded.last_seen_at,score=MAX(score,excluded.score)');await q(env,ins.sql,ins.params);}return links.length;}

async function processTask(env,taskId){
  await ensureDb(env);
  const task=await first(env,`SELECT t.*,s.template,s.name FROM ${T.tasks} t JOIN ${T.sources} s ON s.id=t.source_id WHERE t.id=?`,[taskId]);if(!task)return{action:'ack',reason:'missing_task'};
  let run=await first(env,`SELECT status FROM ${T.runs} WHERE id=?`,[task.run_id]);if(!run||['completed','cancelled','failed'].includes(run.status))return{action:'ack',reason:'run_inactive'};
  if(run.status==='paused'){await q(env,`UPDATE ${T.tasks} SET status='pending',lease_until=NULL,updated_at=? WHERE id=?`,[now(),taskId]);return{action:'ack',reason:'paused'};}
  const lease=new Date(Date.now()+120000).toISOString();const claimed=await q(env,`UPDATE ${T.tasks} SET status='running',attempts=attempts+1,lease_until=?,updated_at=? WHERE id=? AND status IN ('queued','pending','retry','dispatching')`,[lease,now(),taskId]);if(!(claimed.meta?.changes||0))return{action:'ack',reason:'already_claimed'};
  const current=await first(env,`SELECT t.*,s.template,s.name FROM ${T.tasks} t JOIN ${T.sources} s ON s.id=t.source_id WHERE t.id=?`,[taskId]);let result;
  try{
    const target=current.task_type==='crawl'?current.target_url:current.template.replace('{q}',encodeURIComponent(current.query));
    if(await recentlyVisited(env,target)){await q(env,`UPDATE ${T.tasks} SET status='done',lease_until=NULL,last_error='recently_visited',updated_at=? WHERE id=?`,[now(),taskId]);await recalcRun(env,current.run_id);await dispatchPending(env,current.run_id,CONTINUATION_DISPATCH);return{action:'ack',reason:'recently_visited'};}
    result=await fetchText(target);const cls=classifyResponse(result);if(!cls.ok){const err=new Error(cls.blocked?'blocked_or_captcha':`http_${result.status}`);err.retryable=cls.retryable;err.blocked=cls.blocked;throw err;}
    run=await first(env,`SELECT status FROM ${T.runs} WHERE id=?`,[current.run_id]);if(!run||run.status==='paused'){await q(env,`UPDATE ${T.tasks} SET status='pending',lease_until=NULL,last_error='paused_after_fetch',updated_at=? WHERE id=?`,[now(),taskId]);return{action:'ack',reason:'paused_after_fetch'};}
    const links=extractMega(result.text);await saveLinks(env,current,result,links);if(current.task_type==='search')await addCrawlTasks(env,current,discoverTargets(result.text,result.url));await markVisited(env,target,current.run_id,result.status,links.length);
    await q(env,`UPDATE ${T.tasks} SET status='done',lease_until=NULL,last_error=NULL,updated_at=? WHERE id=?`,[now(),taskId]);await updateMetric(env,current.source_id,result,links.length,null,false);await recalcRun(env,current.run_id);await dispatchPending(env,current.run_id,CONTINUATION_DISPATCH);return{action:'ack',reason:'done'};
  }catch(e){const attempts=Number((await first(env,`SELECT attempts FROM ${T.tasks} WHERE id=?`,[taskId]))?.attempts||1),terminal=attempts>=MAX_TASK_ATTEMPTS||e.retryable===false,status=terminal?'failed':'retry';await q(env,`UPDATE ${T.tasks} SET status=?,lease_until=NULL,last_error=?,updated_at=? WHERE id=?`,[status,String(e?.message||e).slice(0,500),now(),taskId]);await updateMetric(env,current.source_id,result,0,e,!!e.blocked);await recalcRun(env,current.run_id);if(terminal){await dispatchPending(env,current.run_id,CONTINUATION_DISPATCH);return{action:'ack',reason:'failed_terminal'}}return{action:'retry',reason:String(e?.message||e)};}
}

async function recalcRun(env,runId){const counts=await first(env,`SELECT COUNT(*) total,SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) done,SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) failed,SUM(CASE WHEN status IN ('pending','dispatching','queued','running','retry') THEN 1 ELSE 0 END) open FROM ${T.tasks} WHERE run_id=?`,[runId]);const links=await first(env,`SELECT COUNT(*) c FROM ${T.links} WHERE run_id=?`,[runId]);const run=await first(env,`SELECT status,progress_percent FROM ${T.runs} WHERE id=?`,[runId]);if(!run)return;const total=Number(counts?.total||0),done=Number(counts?.done||0),failed=Number(counts?.failed||0),open=Number(counts?.open||0),raw=total?((done+failed)/total)*100:0,progress=Math.max(Number(run.progress_percent||0),Math.min(100,raw)),finished=total>0&&open===0&&done+failed>=total,next=run.status==='paused'?'paused':finished?'completed':'running';await q(env,`UPDATE ${T.runs} SET total_tasks=?,completed_tasks=?,failed_tasks=?,links_found=?,progress_percent=?,status=?,updated_at=?,finished_at=? WHERE id=?`,[total,done,failed,Number(links?.c||0),finished?100:progress,next,now(),finished?now():null,runId]);}
async function runStatus(env,runId){const run=await first(env,`SELECT * FROM ${T.runs} WHERE id=?`,[runId]);if(!run)return null;const counts=await first(env,`SELECT SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) pending,SUM(CASE WHEN status='dispatching' THEN 1 ELSE 0 END) dispatching,SUM(CASE WHEN status='queued' THEN 1 ELSE 0 END) queued,SUM(CASE WHEN status='running' THEN 1 ELSE 0 END) running,SUM(CASE WHEN status='retry' THEN 1 ELSE 0 END) retry FROM ${T.tasks} WHERE run_id=?`,[runId]);return{...run,progress:Number(run.progress_percent||0),queue:counts};}
async function latestStatus(env){const r=await first(env,`SELECT id FROM ${T.runs} ORDER BY created_at DESC LIMIT 1`);return{version:VERSION,active:r?await runStatus(env,r.id):null};}
async function recover(env,{resumePaused=false}={}){await ensureDb(env);const ts=now();await q(env,`UPDATE ${T.tasks} SET status='pending',lease_until=NULL,updated_at=? WHERE status IN ('running','dispatching') AND (lease_until IS NULL OR lease_until<?)`,[ts,ts]);await q(env,`UPDATE ${T.tasks} SET status='pending',updated_at=? WHERE status='queued' AND updated_at<?`,[ts,new Date(Date.now()-10*60*1000).toISOString()]);let active=await first(env,`SELECT id,status FROM ${T.runs} WHERE status='running' ORDER BY created_at DESC LIMIT 1`);if(!active&&resumePaused){active=await first(env,`SELECT id,status FROM ${T.runs} WHERE status='paused' ORDER BY created_at DESC LIMIT 1`);if(active)await q(env,`UPDATE ${T.runs} SET status='running',updated_at=?,stop_reason=NULL WHERE id=?`,[ts,active.id]);}if(active){await recalcRun(env,active.id);const r=await first(env,`SELECT status FROM ${T.runs} WHERE id=?`,[active.id]);if(r?.status==='running')await dispatchPending(env,active.id,INITIAL_DISPATCH);}return latestStatus(env);}
async function stats(env){await ensureDb(env);const [s,r,l,t]=await Promise.all([first(env,`SELECT COUNT(*) total,SUM(enabled) enabled FROM ${T.sources}`),first(env,`SELECT COUNT(*) total FROM ${T.runs}`),first(env,`SELECT COUNT(*) total FROM ${T.links}`),first(env,`SELECT SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) pending,SUM(CASE WHEN status='queued' THEN 1 ELSE 0 END) queued,SUM(CASE WHEN status='done' THEN 1 ELSE 0 END) done,SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) failed FROM ${T.tasks}`)]);return{version:VERSION,sources:{total:Number(s?.total||0),enabled:Number(s?.enabled||0),disabled:Number(s?.total||0)-Number(s?.enabled||0)},runs:Number(r?.total||0),links:Number(l?.total||0),tasks:t};}

async function api(req,env){const url=new URL(req.url);if(req.method==='OPTIONS')return json({ok:true});if(url.pathname==='/api/ping')return json({ok:true,version:VERSION});const mutating=req.method!=='GET'||['/api/diagnostics'].includes(url.pathname);if(mutating&&!requireAdmin(req,env))return json({ok:false,error:'unauthorized'},401);
  if(url.pathname==='/api/db/repair'&&req.method==='POST'){await ensureDb(env);const c=await first(env,`SELECT COUNT(*) c FROM ${T.sources}`);if(Number(c?.c||0)!==TOTAL_SOURCES)await seedSources(env,{preserveEnabled:true,allowDuringRun:false});return json({ok:true,...await recover(env),stats:await stats(env)});}
  if(url.pathname==='/api/stats')return json({ok:true,...await stats(env),...await latestStatus(env)});
  if(url.pathname==='/api/run/start'&&req.method==='POST'){const b=await req.json().catch(()=>({}));return json({ok:true,run:await startRun(env,b.mode==='search'?'search':'autoscan',String(b.keyword||''))});}
  if(url.pathname==='/api/run/resume'&&req.method==='POST')return json({ok:true,...await recover(env,{resumePaused:true})});
  if(url.pathname==='/api/run/pause'&&req.method==='POST'){const a=await first(env,`SELECT id FROM ${T.runs} WHERE status='running' ORDER BY created_at DESC LIMIT 1`);if(a)await q(env,`UPDATE ${T.runs} SET status='paused',stop_reason='user_pause',updated_at=? WHERE id=?`,[now(),a.id]);return json({ok:true,...await latestStatus(env)});}
  if(url.pathname==='/api/run/cancel'&&req.method==='POST'){const a=await first(env,`SELECT id FROM ${T.runs} WHERE status IN ('running','paused') ORDER BY created_at DESC LIMIT 1`);if(a){await q(env,`UPDATE ${T.runs} SET status='cancelled',stop_reason='user_cancel',finished_at=?,updated_at=? WHERE id=?`,[now(),now(),a.id]);await q(env,`UPDATE ${T.tasks} SET status='failed',last_error='cancelled',lease_until=NULL,updated_at=? WHERE run_id=? AND status NOT IN ('done','failed')`,[now(),a.id]);}return json({ok:true,...await latestStatus(env)});}
  if(url.pathname==='/api/sources'){await ensureDb(env);const page=Math.max(1,Number(url.searchParams.get('page')||1)),limit=Math.min(100,Math.max(10,Number(url.searchParams.get('limit')||50))),offset=(page-1)*limit,search=String(url.searchParams.get('search')||'').trim(),where=search?'WHERE s.name LIKE ? OR s.category LIKE ?':'',params=search?[`%${search}%`,`%${search}%`]:[];const count=await first(env,`SELECT COUNT(*) c FROM ${T.sources} s ${where}`,params);const rows=await all(env,`SELECT s.*,COALESCE(m.requests,0) requests,COALESCE(m.successes,0) successes,COALESCE(m.failures,0) failures,COALESCE(m.blocked,0) blocked,COALESCE(m.links_found,0) links_found,m.cooldown_until,CASE WHEN COALESCE(m.requests,0)>0 THEN ROUND((m.links_found*100.0)/m.requests,2) ELSE 0 END yield_per_100 FROM ${T.sources} s LEFT JOIN ${T.metrics} m ON m.source_id=s.id ${where} ORDER BY s.enabled DESC,s.priority DESC LIMIT ? OFFSET ?`,[...params,limit,offset]);return json({ok:true,total:Number(count?.c||0),page,limit,pages:Math.max(1,Math.ceil(Number(count?.c||0)/limit)),sources:rows.results||[]});}
  if(url.pathname==='/api/sources/reset'&&req.method==='POST')return json({ok:true,...await seedSources(env,{preserveEnabled:false,allowDuringRun:false})});
  if(url.pathname==='/api/sources/toggle'&&req.method==='POST'){const b=await req.json().catch(()=>({}));if(!b.id)return json({ok:false,error:'missing_id'},400);await q(env,`UPDATE ${T.sources} SET enabled=?,updated_at=? WHERE id=?`,[b.enabled?1:0,now(),String(b.id)]);return json({ok:true});}
  if(url.pathname==='/api/results'||url.pathname==='/api/archive'){await ensureDb(env);const run=url.searchParams.get('run_id')||(url.pathname==='/api/results'?(await first(env,`SELECT id FROM ${T.runs} ORDER BY created_at DESC LIMIT 1`))?.id:null);const rows=run?await all(env,`SELECT * FROM ${T.links} WHERE run_id=? ORDER BY score DESC,last_seen_at DESC LIMIT 1000`,[run]):await all(env,`SELECT * FROM ${T.links} ORDER BY last_seen_at DESC LIMIT 1000`);return json({ok:true,run_id:run||null,results:rows.results||[]});}
  if(url.pathname==='/api/extract'&&req.method==='POST'){const b=await req.json().catch(()=>({}));return json({ok:true,links:extractMega(String(b.text||''))});}
  if(url.pathname==='/api/export'){await ensureDb(env);const format=url.searchParams.get('format')==='csv'?'csv':'json',rows=(await all(env,`SELECT run_id,link,source_id,page_url,health,score,first_seen_at,last_seen_at FROM ${T.links} ORDER BY last_seen_at DESC LIMIT 5000`)).results||[];if(format==='json')return new Response(JSON.stringify(rows,null,2),{headers:{'content-type':'application/json','content-disposition':'attachment; filename="nimbus-archive.json"'}});const esc=v=>`"${String(v??'').replaceAll('"','""')}"`;const csv=[['run_id','link','source_id','page_url','health','score','first_seen_at','last_seen_at'],...rows.map(r=>[r.run_id,r.link,r.source_id,r.page_url,r.health,r.score,r.first_seen_at,r.last_seen_at])].map(r=>r.map(esc).join(',')).join('\n');return new Response(csv,{headers:{'content-type':'text/csv; charset=utf-8','content-disposition':'attachment; filename="nimbus-archive.csv"'}});}
  if(url.pathname==='/api/diagnostics'){const recent=await all(env,`SELECT level,message,meta,created_at FROM ${T.events} ORDER BY created_at DESC LIMIT 20`);return json({ok:true,version:VERSION,bindings:{db:!!env.DB,queue:!!env.QUEUE,admin_token:!!env.ADMIN_TOKEN},stats:await stats(env),...(await latestStatus(env)),recent_events:recent.results||[]});}
  return json({ok:false,error:'not_found'},404);
}
async function fetchHandler(req,env){const url=new URL(req.url);if(url.pathname.startsWith('/api/')){try{return await api(req,env)}catch(e){await logEvent(env,'error','api_error',{path:url.pathname,error:String(e?.message||e)});return json({ok:false,error:String(e?.message||e),version:VERSION},500)}}if(env.ASSETS)return env.ASSETS.fetch(req);return json({ok:true,version:VERSION,service:'nimbus-core-queue'});}
async function queueHandler(batch,env){for(const message of batch.messages){try{const r=await processTask(env,message.body?.task_id);if(r?.action==='retry')message.retry({delaySeconds:30});else message.ack();}catch(e){await logEvent(env,'error','queue_handler_error',{error:String(e?.message||e),body:message.body});message.retry({delaySeconds:30});}}}
async function scheduledHandler(_controller,env,ctx){ctx.waitUntil(recover(env,{resumePaused:false}));}
export {sourceCatalog,extractMega,discoverTargets,normalizeUrl,queryFor,classifyResponse,buildMultiInsert,requireAdmin};
export default{fetch:fetchHandler,queue:queueHandler,scheduled:scheduledHandler};
