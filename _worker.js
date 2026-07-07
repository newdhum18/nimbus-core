const VERSION = '30.0.0-report-ready-wide-scan';
const POLICY = 'public-indexed-link-first-only';
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7;

// V30 is LINK-FIRST: URL shapes first, no country filters, no time labels, no fixed file-name keywords.
// V30 removes content-category modes from the root. All structurally valid public MEGA links are shown with health status; no content-name/category filter is used.
// Public indexed discovery only. No login/captcha/paywall/unlock bypass and no private accounts.
const BASE_LINK_SHAPES = [
  '"https://mega.nz/folder/"',
  '"https://mega.nz/file/"',
  '"mega.nz/folder/"',
  '"mega.nz/file/"',
  '"mega.nz/#F!"',
  '"mega.nz/#!"',
  '"mega.nz" "/folder/"',
  '"mega.nz" "/file/"'
];
const CORE_SOURCE_DOMAINS = [
  // Paste / note / text hosting
  'rentry.co','pastebin.com','paste.ee','pastelink.net','justpaste.it','telegra.ph','controlc.com','pastes.io','hastebin.com','dpaste.com','notes.io','paste.rs','paste2.org','privatebin.net','paste.c-net.org','snippet.host','anotepad.com','yamcode.com','sebsauvage.net','ghostbin.site','0bin.net','throwbin.io','nekobin.com','paste.sh','pastebin.pl','paste.mozilla.org','gist.githubusercontent.com',
  // Code / repos / snippets
  'gist.github.com','github.com','gitlab.com','bitbucket.org','sourceforge.net','npmjs.com','greasyfork.org','stackblitz.com','replit.com',
  // Forums / social / indexed discussions
  'reddit.com','old.reddit.com','quora.com','medium.com','tumblr.com','wordpress.com','blogspot.com','livejournal.com','vk.com','x.com','twitter.com','telegram.me','t.me',
  // Searchable archives / public intelligence pages
  'archive.org','webcache.googleusercontent.com','urlscan.io','any.run','virustotal.com','hybrid-analysis.com','otx.alienvault.com','malshare.com','malwarebazaar.abuse.ch',
  // File/link sharing discussion surfaces that are public indexed
  'bunkr.site','bunkr.fi','bunkr.si','bunkr.la','cyberdrop.me','cyberfile.me','pixeldrain.com','gofile.io','mediafire.com','anonfiles.com','zippyshare.com','mega.nz','mega.io',
  // Broad public link directories, mirrors, forums, document/search surfaces
  'pastebin.fr','pastebin.ai','paste.org.ru','cl1p.net','ideone.com','jsfiddle.net','codepen.io','notabug.org','gitee.com','codeberg.org','hub.docker.com','raw.githubusercontent.com','huggingface.co','scribd.com','slideshare.net','docdroid.net','issuu.com','4shared.com','uloz.to','katfile.com','rapidgator.net','nitroflare.com','ddownload.com','send.cm','drop.download','files.fm','workupload.com','dropbox.com','drive.google.com','yandex.com','mail.ru','ok.ru','dzen.ru','rutube.ru','forumotion.com','proboards.com','boards.net','disqus.com','fandom.com','steamcommunity.com','substack.com','notion.site','notion.so',
  // V30 additional broad public indexed surfaces
  'groups.google.com','sites.google.com','wixsite.com','weebly.com','neocities.org','github.io','gitbook.io','readthedocs.io','dev.to','hashnode.dev','patreon.com','boosty.to','kemono.su','coomer.su','simpcity.su','socialgrep.com','rareddit.com','unddit.com','githubusercontent.com','gitlab.io','paste.centos.org','paste.opensuse.org','paste.debian.net','paste.ubuntu.com','paste.kde.org','paste.gnome.org','paste.rs','termbin.com','ix.io','sprunge.us','dpaste.org','friendpaste.com','paste.xinu.at','p.ip.fi','ctxt.io','txti.es','txt.fyi','wtools.io','textbin.net','pastebin.mozilla.org','paste.md-5.net','paste.fedoraproject.org','paste.netcraft.com','privatebin.net','write.as','bearblog.dev','mataroa.blog','plurk.com','mastodon.social','bsky.app','threads.net','facebook.com','pinterest.com','imgur.com','imgbb.com','pixiv.net','deviantart.com','behance.net','artstation.com','soundcloud.com','bandcamp.com','spotify.com','goodreads.com','academia.edu','researchgate.net','pdfhost.io','calameo.com','yumpu.com','docplayer.net','slideserve.com','speakerdeck.com','prezi.com','mega-search.me','filecrypt.cc','nippyfile.com','mixdrop.co','doodstream.com','streamtape.com','terabox.com','fembed.com','solidfiles.com','userscloud.com','uppit.com','bayfiles.com','racaty.net','krakenfiles.com','clicknupload.click','usersdrive.com','uploadhaven.com','multiup.io','mirrorace.org','mirrored.to','letsupload.io','hexupload.net','1fichier.com',
  // V30 web-accessible deep/open-web discovery surfaces only; no Tor bypass
  'ahmia.fi','onionland.io','onionengine.com','dark.fail','tor.taxi','onion.live','darknetlive.com','darkowl.com','intelx.io'
];
const PRIORITY_PATTERNS = [
  'site:rentry.co "mega.nz/folder/"',
  'site:rentry.co "mega.nz/file/"',
  'site:pastebin.com "mega.nz/folder/"',
  'site:pastebin.com "mega.nz/file/"',
  'site:reddit.com "mega.nz/folder/"',
  'site:reddit.com "mega.nz/file/"',
  'site:gist.github.com "mega.nz/folder/"',
  'site:github.com "mega.nz/folder/"',
  'site:telegra.ph "mega.nz/folder/"',
  'site:notes.io "mega.nz/folder/"',
  'site:controlc.com "mega.nz/folder/"',
  'site:archive.org "mega.nz/folder/"',
  'site:telegra.ph "mega.nz/file/"',
  'site:controlc.com "mega.nz/file/"',
  'site:pastes.io "mega.nz/folder/"',
  'site:justpaste.it "mega.nz/folder/"',
  'site:blogspot.com "mega.nz/folder/"',
  'site:wordpress.com "mega.nz/folder/"',
  'site:vk.com "mega.nz/folder/"',
  'site:t.me "mega.nz/folder/" -"mega_drive_links_courses_new"',
  'site:t.me "mega.nz/file/" -"mega_drive_links_courses_new"',
  'site:groups.google.com "mega.nz/folder/"','site:groups.google.com "mega.nz/file/"',
  'site:github.io "mega.nz/folder/"','site:github.io "mega.nz/file/"',
  'site:gitlab.com "mega.nz/folder/"','site:gitlab.com "mega.nz/file/"',
  'site:archive.org "mega.nz/file/"','site:socialgrep.com "mega.nz/folder/"',
  'site:ahmia.fi "mega.nz/folder/"','site:onionland.io "mega.nz/folder/"','site:onionengine.com "mega.nz/folder/"',
  'site:paste.rs "mega.nz/folder/"','site:paste.rs "mega.nz/file/"',
  'site:paste.ubuntu.com "mega.nz/folder/"','site:paste.debian.net "mega.nz/file/"',
  'site:telegra.ph "mega.nz"','site:rentry.co "mega.nz"','site:pastebin.com "mega.nz"'
];
const CONTEXT_PATTERNS = [
  '"mega.nz/folder/" "download"','"mega.nz/file/" "download"','"mega.nz/folder/" "shared"','"mega.nz/file/" "shared"',
  '"mega.nz/folder/" "collection"','"mega.nz/file/" "collection"','"mega.nz/folder/" "pack"','"mega.nz/file/" "pack"',
  '"mega.nz/folder/" "links"','"mega.nz/file/" "links"','"mega.nz/folder/" "mega folder"','"mega.nz/file/" "mega file"',
  '"mega.nz/folder/" "archive"','"mega.nz/file/" "archive"','"mega.nz/folder/" "backup"','"mega.nz/file/" "backup"',
  '"mega.nz/folder/" "mirror"','"mega.nz/file/" "mirror"','"mega.nz/folder/" "index"','"mega.nz/file/" "index"','"mega.nz/folder/" "dump"','"mega.nz/file/" "dump"','"mega.nz/folder/" "list"','"mega.nz/file/" "list"','"mega.nz/folder/" "txt"','"mega.nz/file/" "txt"','"mega.nz/folder/" "rentry"','"mega.nz/file/" "rentry"','"mega.nz/folder/" "pastebin"','"mega.nz/file/" "pastebin"'
];
const MANUAL_DOMAINS = ['meawfy.com','linkvertise.com','loot-link.com','work.ink','rekonise.com','boost.ink','sub2unlock.com','ouo.io','adf.ly','shrinkme.io'];
const EXCLUDED_SOURCE_PREFIXES = ['https://t.me/s/mega_drive_links_courses_new'];
function buildPatterns(){
  const out=[...PRIORITY_PATTERNS,...BASE_LINK_SHAPES,...CONTEXT_PATTERNS];
  for (const d of CORE_SOURCE_DOMAINS) {
    out.push(`site:${d} "mega.nz/folder/"`);
    out.push(`site:${d} "mega.nz/file/"`);
    out.push(`site:${d} "mega.nz/#!"`);
    out.push(`site:${d} "mega.nz/#F!"`);
  }
  return dedupe(out);
}
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === '/reset') return resetPage();
    if (!url.pathname.startsWith('/api/')) return serveAsset(request, env);
    return handleApiSafe(request, env, ctx);
  },
  async scheduled(event, env, ctx) { ctx.waitUntil(autoScan(env, { continueScan:true, scheduled:true })); }
};

async function serveAsset(request, env) {
  if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') return env.ASSETS.fetch(request);
  return new Response('Nimbus Core asset binding is not available.', { status:500, headers:{'content-type':'text/plain;charset=utf-8'} });
}
async function handleApiSafe(request, env, ctx) {
  const headers = corsHeaders();
  try {
    if (request.method === 'OPTIONS') return new Response(null, { status:204, headers });
    const url = new URL(request.url); const path = url.pathname;
    if (path === '/api/ping') return json(await publicStatus(env), 200, headers);
    if (path === '/api/login') return json(await login(request, env), 200, headers);
    if (path === '/api/session') return json(await session(request, env), 200, headers);
    const auth = await requireAuth(request, env); if (!auth.ok) return json(auth, 401, headers);
    if (path === '/api/schema') return json(await schema(env), 200, headers);
    if (path === '/api/search') return json(await search(request, env), 200, headers);
    if (path === '/api/latest') return json(await latest(env, url), 200, headers);
    if (path === '/api/archive') return json(await archive(env, url), 200, headers);
    if (path === '/api/manual-sources') return json(await manualSources(env, url), 200, headers);
    if (path === '/api/delete-link') return json(await deleteLink(request, env), 200, headers);
    if (path === '/api/cleanup') return json(await cleanup(env), 200, headers);
    if (path === '/api/export') return exportLinks(env, url, headers);
    if (path === '/api/reset-cursor') return json(await resetCursor(env), 200, headers);
    if (path === '/api/verify-links') return json(await verifyLinks(request, env), 200, headers);
    if (path === '/api/diagnostics') return json(await diagnostics(env), 200, headers);
    if (path === '/api/audit') return json(await audit(env), 200, headers);
    if (path === '/api/report-package') return reportPackage(env, url, headers);
    return json({ ok:false, version:VERSION, error:'not_found', path }, 404, headers);
  } catch (error) {
    return json({ ok:false, version:VERSION, error:'api_exception', message:String(error && error.message ? error.message : error), stack:shortStack(error) }, 200, headers);
  }
}
function corsHeaders(){ return {'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,DELETE,OPTIONS','access-control-allow-headers':'content-type,authorization','cache-control':'no-store, no-cache, must-revalidate, max-age=0','pragma':'no-cache','x-nimbus-version':VERSION}; }
function json(data,status=200,extra={}){ return new Response(JSON.stringify(data,null,2),{status,headers:{...extra,'content-type':'application/json;charset=utf-8'}}); }
async function readJson(request){ try{return await request.json()}catch{return {}} }
async function publicStatus(env){ return {ok:true,version:VERSION,db_bound:!!env.DB,auth_pin_configured:!!env.AUTH_PIN,brave_enabled:!!env.BRAVE_API_KEY,policy:POLICY,storage:'stable_v25_tables_v30_engine',note:'V30 all-results mode with Health Status Bot. No content-category modes. Public indexed discovery only. No bypass, no captcha/login/paywall unlocking.'}; }

async function login(request, env){ const body=await readJson(request); if(!env.AUTH_PIN) return {ok:false,version:VERSION,error:'AUTH_PIN_missing'}; if(String(body.pin||'')!==String(env.AUTH_PIN)) return {ok:false,version:VERSION,error:'invalid_pin'}; return {ok:true,version:VERSION,token:await signToken({iat:nowSec(),exp:nowSec()+TOKEN_TTL_SECONDS},env)}; }
async function session(request, env){ return {...await requireAuth(request,env),version:VERSION}; }
async function requireAuth(request, env){ if(!env.AUTH_PIN) return {ok:false,error:'AUTH_PIN_missing'}; const token=(request.headers.get('authorization')||'').replace(/^Bearer\s+/i,'').trim(); if(!token) return {ok:false,error:'missing_token'}; const payload=await verifyToken(token,env); if(!payload) return {ok:false,error:'invalid_token'}; if(payload.exp && payload.exp<nowSec()) return {ok:false,error:'expired_token'}; return {ok:true}; }
async function signToken(payload, env){ const p=base64Url(JSON.stringify(payload)); return `${p}.${await hmac(p, secret(env))}`; }
async function verifyToken(token, env){ const parts=token.split('.'); if(parts.length!==2)return null; const expected=await hmac(parts[0],secret(env)); if(expected!==parts[1])return null; try{return JSON.parse(fromBase64Url(parts[0]))}catch{return null} }
function secret(env){return String(env.AUTH_SECRET||env.AUTH_PIN||'nimbus-core-local-secret')} function nowSec(){return Math.floor(Date.now()/1000)} function nowIso(){return new Date().toISOString()}
function base64Url(text){return btoa(unescape(encodeURIComponent(text))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'')} function fromBase64Url(text){return decodeURIComponent(escape(atob(text.replace(/-/g,'+').replace(/_/g,'/'))))}
async function hmac(message,key){ const enc=new TextEncoder(); const k=await crypto.subtle.importKey('raw',enc.encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']); const sig=await crypto.subtle.sign('HMAC',k,enc.encode(message)); return Array.from(new Uint8Array(sig)).map(b=>b.toString(16).padStart(2,'0')).join(''); }
function shortStack(error){return String(error&&error.stack?error.stack:'').split('\n').slice(0,6).join('\n')}
function db(env){ if(!env.DB) throw new Error('DB binding missing. Add Cloudflare D1 binding named DB.'); return env.DB; }
async function run(env,sql,bind=[]){ return db(env).prepare(sql).bind(...bind).run(); } async function all(env,sql,bind=[]){ return db(env).prepare(sql).bind(...bind).all(); } async function first(env,sql,bind=[]){ return db(env).prepare(sql).bind(...bind).first(); }
async function runIgnore(env,sql,bind=[]){ try{return await run(env,sql,bind)}catch(e){ if(/already exists|duplicate column/i.test(String(e.message||e))) return {success:true,skipped:true}; throw e; } }

async function ensureSchema(env){
  const steps=[]; const add=async(name,sql,bind=[])=>{ await runIgnore(env,sql,bind); steps.push(name); };
  await add('v25_links', `CREATE TABLE IF NOT EXISTS nimbus_v25_links (id INTEGER PRIMARY KEY AUTOINCREMENT, mega_url TEXT NOT NULL UNIQUE, normalized_url TEXT, source_url TEXT, source_domain TEXT, title TEXT, source_type TEXT, confidence INTEGER, confidence_reason TEXT, discovered_at TEXT, last_seen_at TEXT, status TEXT, notes TEXT)`);
  await add('v25_sources', `CREATE TABLE IF NOT EXISTS nimbus_v25_sources (id INTEGER PRIMARY KEY AUTOINCREMENT, url TEXT NOT NULL UNIQUE, domain TEXT, reason TEXT, title TEXT, discovered_at TEXT, last_seen_at TEXT, status TEXT)`);
  await add('v25_logs', `CREATE TABLE IF NOT EXISTS nimbus_v25_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, mode TEXT, started_at TEXT, finished_at TEXT, patterns_checked INTEGER, pages_found INTEGER, pages_fetched INTEGER, links_found INTEGER, new_links INTEGER, manual_sources INTEGER, errors TEXT)`);
  await add('v25_state', `CREATE TABLE IF NOT EXISTS nimbus_v25_state (name TEXT PRIMARY KEY, value TEXT, updated_at TEXT)`);
  await add('idx_links_domain','CREATE INDEX IF NOT EXISTS idx_v25_links_domain ON nimbus_v25_links(source_domain)');
  await add('idx_links_time','CREATE INDEX IF NOT EXISTS idx_v25_links_time ON nimbus_v25_links(discovered_at)');
  await add('idx_sources_domain','CREATE INDEX IF NOT EXISTS idx_v25_sources_domain ON nimbus_v25_sources(domain)');
  await add('health_status_col', 'ALTER TABLE nimbus_v25_links ADD COLUMN health_status TEXT');
  await add('health_reason_col', 'ALTER TABLE nimbus_v25_links ADD COLUMN health_reason TEXT');
  await add('health_checked_at_col', 'ALTER TABLE nimbus_v25_links ADD COLUMN health_checked_at TEXT');
  await add('health_http_status_col', 'ALTER TABLE nimbus_v25_links ADD COLUMN health_http_status INTEGER');
  await add('idx_health_status','CREATE INDEX IF NOT EXISTS idx_v25_links_health ON nimbus_v25_links(health_status)');
  await run(env, `INSERT OR IGNORE INTO nimbus_v25_state (name,value,updated_at) VALUES ('auto_cursor','0',?)`, [nowIso()]);
  await run(env, `INSERT OR IGNORE INTO nimbus_v25_state (name,value,updated_at) VALUES ('last_batch','{}',?)`, [nowIso()]);
  return steps;
}
async function schema(env){ const steps=await ensureSchema(env); const tables=await all(env,`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'nimbus_v25_%' ORDER BY name`); return {ok:true,version:VERSION,db_bound:!!env.DB,applied_steps:steps.length,tables:rows(tables).map(r=>r.name),counts:await getCounts(env)}; }
async function getCounts(env){ await ensureSchema(env); const mega=await first(env,'SELECT COUNT(*) c FROM nimbus_v25_links'); const manual=await first(env,'SELECT COUNT(*) c FROM nimbus_v25_sources'); const logs=await first(env,'SELECT COUNT(*) c FROM nimbus_v25_logs'); const latest=await first(env,'SELECT MAX(discovered_at) t FROM nimbus_v25_links'); return {mega_links:Number(mega?.c||0),manual_sources:Number(manual?.c||0),scan_logs:Number(logs?.c||0),last_discovery:latest?.t||null}; }
async function getState(env,name){ const r=await first(env,'SELECT value FROM nimbus_v25_state WHERE name=?',[name]); return r?.value||null; }
async function setState(env,name,value){ await run(env,`INSERT INTO nimbus_v25_state (name,value,updated_at) VALUES (?,?,?) ON CONFLICT(name) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at`,[name,value,nowIso()]); }

async function search(request, env){ await ensureSchema(env); const body=await readJson(request); if(String(body.mode||'auto')==='manual') return manualSearch(env,String(body.query||'').trim(), body); return autoScan(env,{continueScan:!!body.continueScan,reset:!!body.reset,batchSize:body.batchSize,verify:body.verify!==false}); }
async function autoScan(env,options={}){
  await ensureSchema(env);
  const started=nowIso(); const errors=[];
  if(options.reset) await setState(env,'auto_cursor','0');
  let cursor=Number((await getState(env,'auto_cursor'))||'0'); if(!options.continueScan) cursor=0;
  const patterns = buildPatterns();
  const batchSize=clamp(Number(options.batchSize||24),5,48);
  const selected=[]; for(let i=0;i<batchSize;i++) selected.push(patterns[(cursor+i)%patterns.length]);
  const engineResults=[]; const resultUrls=new Map();
  const engineBatches = await mapLimit(selected, 6, async (pattern)=>({pattern, engines: await queryEngines(pattern,env)}));
  for(const pack of engineBatches){
    engineResults.push({pattern:pack.pattern,engines:pack.engines.map(e=>({engine:e.engine,ok:e.ok,count:e.urls.length,error:e.error||null}))});
    for(const e of pack.engines){
      if(!e.ok&&e.error) errors.push(`${e.engine}: ${e.error}`);
      for(const raw of e.urls){ const u=cleanUrl(raw); if(!u || isExcludedUrl(u)) continue; resultUrls.set(u,{url:u,pattern:pack.pattern,engine:e.engine}); }
    }
  }
  const pages=Array.from(resultUrls.values()).filter(p=>!isExcludedUrl(p.url)).slice(0,360);
  let pagesFetched=0,linksFound=0,newLinks=0,manualCount=0,liveLinks=0,deadLinks=0,unknownLinks=0; const saved=[],manuals=[];
  const pageResults = await mapLimit(pages, 10, async (page)=>{
    const domain=hostname(page.url);
    if(isManualDomain(domain)){ return {manual: await saveManual(env,page.url,'manual_review_domain',page.url)}; }
    const fetched=await fetchText(page.url,7000);
    if(!fetched.ok){
      if(fetched.manual) return {manual: await saveManual(env,page.url,fetched.reason||'manual_review',page.url)};
      return {error:`${domain||page.url}: ${fetched.error}`};
    }
    const title=extractTitle(fetched.text)||page.url;
    const links=extractMegaLinks(fetched.text);
    const linkItems = await mapLimit(links, 10, async (link)=>{
      const health = options.verify===false ? {status:'unverified',reason:'not_checked'} : await verifyMegaLink(link);
      const item = await saveMega(env,link,page.url,title,'auto_scan_v30_all_results',health);
      return item;
    });
    return {fetched:true, linksCount:links.length, linkItems};
  });
  for(const r of pageResults){
    if(!r) continue;
    if(r.error) { errors.push(r.error); continue; }
    if(r.manual){ manualCount+=r.manual.new?1:0; manuals.push(r.manual.item); continue; }
    if(r.fetched) pagesFetched++;
    linksFound += r.linksCount||0;
    for(const s of (r.linkItems||[])){
      if(s.new)newLinks++; saved.push(s.item);
      const hs=String(s.item.health_status||'unverified');
      if(['live','probably_live'].includes(hs)) liveLinks++; else if(['unavailable','reported_removed','invalid'].includes(hs)) deadLinks++; else unknownLinks++;
    }
  }
  const nextCursor=(cursor+batchSize)%patterns.length; await setState(env,'auto_cursor',String(nextCursor));
  const summary={patterns_checked:selected.length,total_patterns:patterns.length,pages_found:pages.length,pages_fetched:pagesFetched,links_found:linksFound,new_links:newLinks,verified_live:liveLinks,verified_unavailable:deadLinks,unverified_or_unknown:unknownLinks,manual_sources:manualCount,errors:errors.slice(0,20)};
  await run(env,`INSERT INTO nimbus_v25_logs (mode,started_at,finished_at,patterns_checked,pages_found,pages_fetched,links_found,new_links,manual_sources,errors) VALUES (?,?,?,?,?,?,?,?,?,?)`,['auto_scan_v30_all_results',started,nowIso(),summary.patterns_checked,summary.pages_found,summary.pages_fetched,summary.links_found,summary.new_links,summary.manual_sources,JSON.stringify(summary.errors)]);
  await setState(env,'last_batch',JSON.stringify({summary,saved:saved.slice(0,50),manuals:manuals.slice(0,25),engineResults:engineResults.slice(0,16)}));
  return {ok:true,version:VERSION,mode:'link_first_all_results_scan_with_health_status',cursor,next_cursor:nextCursor,patterns:selected,summary,saved,manual_sources:manuals,engine_results:engineResults};
}
async function manualSearch(env,query,options={}){
  await ensureSchema(env); if(!query) return {ok:false,version:VERSION,error:'empty_query'};
  const engines=await queryEngines(`${query} "mega.nz"`,env);
  const pages=[]; for(const e of engines) for(const u of e.urls){ const cu=cleanUrl(u); if(cu && !isExcludedUrl(cu)) pages.push({url:cu,engine:e.engine}); }
  const unique=Array.from(new Map(pages.map(p=>[p.url,p])).values()).slice(0,120);
  let newLinks=0,linksFound=0,liveLinks=0,deadLinks=0,unknownLinks=0; const saved=[],errors=[];
  const pageResults = await mapLimit(unique, 6, async (page)=>{
    try{ const fetched=await fetchText(page.url,7000); if(!fetched.ok) return null; const title=extractTitle(fetched.text)||page.url; const links=extractMegaLinks(fetched.text);
      const linkItems=await mapLimit(links,5,async(link)=>{ const health=await verifyMegaLink(link); return saveMega(env,link,page.url,title,'manual_search_v30_all_results',health); });
      return {linksCount:links.length,linkItems};
    }catch(e){ return {error:String(e.message||e)}; }
  });
  for(const r of pageResults){ if(!r) continue; if(r.error){errors.push(r.error);continue;} linksFound+=r.linksCount||0; for(const s of (r.linkItems||[])){ if(s.new)newLinks++; saved.push(s.item); const hs=String(s.item.health_status||'unverified'); if(['live','probably_live'].includes(hs)) liveLinks++; else if(['unavailable','reported_removed','invalid'].includes(hs)) deadLinks++; else unknownLinks++; } }
  return {ok:true,version:VERSION,mode:'manual_keyword_all_results_with_health_status',query,pages_found:unique.length,links_found:linksFound,new_links:newLinks,verified_live:liveLinks,verified_unavailable:deadLinks,unverified_or_unknown:unknownLinks,saved,engine_results:engines.map(e=>({engine:e.engine,ok:e.ok,count:e.urls.length,error:e.error||null})),errors};
}

async function queryEngines(query,env){ const tasks=[queryBingRss(query),queryDuckDuckGoLite(query),queryAhmia(query),queryMojeek(query),queryOnionLand(query),queryOnionEngine(query),queryUrlscan(query)]; if(env.BRAVE_API_KEY) tasks.push(queryBrave(query,env.BRAVE_API_KEY)); const names=['bing_rss','duckduckgo_lite','ahmia','mojeek','onionland_web','onionengine_web','urlscan','brave']; const res=await Promise.allSettled(tasks); return res.map((r,i)=>r.status==='fulfilled'?r.value:{engine:names[i]||'engine',ok:false,urls:[],error:String(r.reason&&r.reason.message?r.reason.message:r.reason)}); }

async function queryMojeek(query){ return queryGenericHtml('mojeek', `https://www.mojeek.com/search?q=${encodeURIComponent(query)}`, /mojeek\.com/i, 20); }
async function queryOnionLand(query){ return queryGenericHtml('onionland_web', `https://onionland.io/search?q=${encodeURIComponent(query)}`, /onionland\.io/i, 20); }
async function queryOnionEngine(query){ return queryGenericHtml('onionengine_web', `https://onionengine.com/search.php?search=${encodeURIComponent(query)}`, /onionengine\.com/i, 20); }
async function queryGenericHtml(engine,url,excludeRx,limit=20){
  try{
    const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 NimbusCore/30 public link indexer','accept':'text/html,*/*'},cf:{cacheTtl:0}});
    const text=await r.text();
    if(!r.ok)return{engine,ok:false,urls:[],error:`HTTP ${r.status}`};
    const urls=[];
    for(const m of text.matchAll(/href=["']([^"']+)["']/gims)){
      let u=decodeHtml(m[1]);
      const redir=/[?&](?:u|url|q|to|uddg)=([^&]+)/i.exec(u); if(redir) { try{u=decodeURIComponent(redir[1])}catch{} }
      if(u.startsWith('//')) u='https:'+u;
      if(/^https?:\/\//i.test(u)&&!(excludeRx&&excludeRx.test(u))) urls.push(cleanUrl(u));
    }
    return {engine,ok:true,urls:dedupe(urls).slice(0,limit)};
  }catch(e){ return {engine,ok:false,urls:[],error:String(e.message||e)}; }
}

async function queryBingRss(query){ const r=await fetch(`https://www.bing.com/search?format=rss&q=${encodeURIComponent(query)}`,{headers:{'user-agent':'Mozilla/5.0 NimbusCore/30 public link indexer'},cf:{cacheTtl:0}}); const text=await r.text(); if(!r.ok)return{engine:'bing_rss',ok:false,urls:[],error:`HTTP ${r.status}`}; const urls=[]; for(const m of text.matchAll(/<link>(.*?)<\/link>/gims)){ const u=decodeHtml(m[1]).trim(); if(/^https?:\/\//i.test(u)&&!/bing\.com/i.test(u)) urls.push(u); } return {engine:'bing_rss',ok:true,urls:dedupe(urls).slice(0,20)}; }
async function queryDuckDuckGoLite(query){ const r=await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,{headers:{'user-agent':'Mozilla/5.0 NimbusCore/30 public link indexer'},cf:{cacheTtl:0}}); const text=await r.text(); if(!r.ok)return{engine:'duckduckgo_lite',ok:false,urls:[],error:`HTTP ${r.status}`}; const urls=[]; for(const m of text.matchAll(/href=["']([^"']+)["']/gims)){ let u=decodeHtml(m[1]); const uddg=/[?&]uddg=([^&]+)/.exec(u); if(uddg)u=decodeURIComponent(uddg[1]); if(/^https?:\/\//i.test(u)&&!/duckduckgo\.com/i.test(u)) urls.push(u); } return {engine:'duckduckgo_lite',ok:true,urls:dedupe(urls).slice(0,20)}; }
async function queryAhmia(query){ const r=await fetch(`https://ahmia.fi/search/?q=${encodeURIComponent(query)}`,{headers:{'user-agent':'Mozilla/5.0 NimbusCore/30 public link indexer'},cf:{cacheTtl:0}}); const text=await r.text(); if(!r.ok)return{engine:'ahmia',ok:false,urls:[],error:`HTTP ${r.status}`}; const urls=[]; for(const m of text.matchAll(/href=["']([^"']+)["']/gims)){ const u=decodeHtml(m[1]); if(/^https?:\/\//i.test(u)&&!/ahmia\.fi/i.test(u)) urls.push(u); } return {engine:'ahmia',ok:true,urls:dedupe(urls).slice(0,20)}; }
async function queryUrlscan(query){ try{ if(!/mega\.nz|mega\.io/i.test(query)) return {engine:'urlscan',ok:true,urls:[]}; const r=await fetch(`https://urlscan.io/api/v1/search/?q=${encodeURIComponent('domain:mega.nz')}&size=25`,{headers:{'user-agent':'Mozilla/5.0 NimbusCore/30 public link indexer','accept':'application/json'},cf:{cacheTtl:0}}); const data=await r.json().catch(()=>({})); if(!r.ok)return{engine:'urlscan',ok:false,urls:[],error:`HTTP ${r.status}`}; const urls=[]; for(const x of (data.results||[])){ if(x.page?.url) urls.push(x.page.url); if(x.task?.url) urls.push(x.task.url); } return {engine:'urlscan',ok:true,urls:dedupe(urls).slice(0,20)}; }catch(e){ return {engine:'urlscan',ok:false,urls:[],error:String(e.message||e)}; } }
async function queryBrave(query,key){ const r=await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=20`,{headers:{'Accept':'application/json','X-Subscription-Token':key},cf:{cacheTtl:0}}); const data=await r.json().catch(()=>({})); if(!r.ok)return{engine:'brave',ok:false,urls:[],error:`HTTP ${r.status}`}; return {engine:'brave',ok:true,urls:dedupe((data.web?.results||[]).map(x=>x.url)).slice(0,20)}; }
async function fetchText(url,timeoutMs){ const controller=new AbortController(); const t=setTimeout(()=>controller.abort('timeout'),timeoutMs); try{ const r=await fetch(url,{redirect:'follow',signal:controller.signal,headers:{'user-agent':'Mozilla/5.0 NimbusCore/30 public link checker','accept':'text/html,text/plain,*/*'},cf:{cacheTtl:0}}); const ct=r.headers.get('content-type')||''; if([401,403,407,429].includes(r.status)) return {ok:false,manual:true,reason:`http_${r.status}`,error:`HTTP ${r.status}`}; if(!r.ok) return {ok:false,error:`HTTP ${r.status}`}; if(!/text|html|json|xml|javascript/i.test(ct)) return {ok:false,error:`non_text ${ct}`}; const text=await r.text(); return {ok:true,text:text.slice(0,900000)}; }catch(e){ return {ok:false,manual:false,error:String(e.message||e)}; }finally{clearTimeout(t)} }
function extractMegaLinks(text){ const decoded=decodeHtml(String(text||'')); const found=[]; const patterns=[/https?:\/\/(?:www\.)?mega\.(?:nz|io)\/folder\/[A-Za-z0-9_-]+(?:#[A-Za-z0-9_-]+)?/g,/https?:\/\/(?:www\.)?mega\.(?:nz|io)\/file\/[A-Za-z0-9_-]+(?:#[A-Za-z0-9_-]+)?/g,/https?:\/\/(?:www\.)?mega\.(?:nz|io)\/#F![A-Za-z0-9!_-]+/g,/https?:\/\/(?:www\.)?mega\.(?:nz|io)\/#![A-Za-z0-9!_-]+/g,/https?:\/\/(?:www\.)?mega\.(?:nz|io)\/[A-Za-z0-9_#!?&=\/-]+/g]; for(const rx of patterns) for(const m of decoded.matchAll(rx)) found.push(cleanMega(m[0])); return dedupe(found).filter(isValidMega).slice(0,120); }
function cleanMega(u){return String(u||'').replace(/[),.;\]}>'"\s]+$/g,'').replace(/^http:\/\//i,'https://')} function isValidMega(u){return /^https:\/\/(?:www\.)?mega\.(?:nz|io)\/(folder|file)\/[A-Za-z0-9_-]+(?:#[A-Za-z0-9_-]+)?$/i.test(u)||/^https:\/\/(?:www\.)?mega\.(?:nz|io)\/(#F!|#!)[A-Za-z0-9!_-]+$/i.test(u)} function normalizeMega(u){return cleanMega(u).replace(/^https:\/\/www\./i,'https://')}
async function saveMega(env,megaUrl,sourceUrl,title,sourceType,health={status:'unverified',reason:'not_checked'}){
  const n=normalizeMega(megaUrl); const now=nowIso(); const domain=hostname(sourceUrl); const score=confidence(n,sourceUrl,title);
  const dbStatus = healthDbStatus(health.status||'unverified');
  await run(env,`INSERT OR IGNORE INTO nimbus_v25_links (mega_url,normalized_url,source_url,source_domain,title,source_type,confidence,confidence_reason,discovered_at,last_seen_at,status,notes,health_status,health_reason,health_checked_at,health_http_status) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,[n,n,sourceUrl,domain,title||'',sourceType||'auto_scan',score.score,score.reason,now,now,dbStatus,'',health.status||'unverified',health.reason||'',now,health.http_status||null]);
  const changed=await first(env,`SELECT changes() c`);
  await run(env,`UPDATE nimbus_v25_links SET last_seen_at=?, source_url=COALESCE(source_url,?), source_domain=COALESCE(source_domain,?), title=COALESCE(title,?), status=?, health_status=?, health_reason=?, health_checked_at=?, health_http_status=? WHERE mega_url=?`,[now,sourceUrl,domain,title||'',dbStatus,health.status||'unverified',health.reason||'',now,health.http_status||null,n]);
  return {new:Number(changed?.c||0)>0,item:{mega_url:n,source_url:sourceUrl,source_domain:domain,title:title||'',confidence:score.score,confidence_reason:score.reason,health_status:health.status||'unverified',health_reason:health.reason||''}};
}
async function saveManual(env,url,reason,title){ const clean=cleanUrl(url); const now=nowIso(); const domain=hostname(clean); await run(env,`INSERT OR IGNORE INTO nimbus_v25_sources (url,domain,reason,title,discovered_at,last_seen_at,status) VALUES (?,?,?,?,?,?,?)`,[clean,domain,reason||'manual_review',title||clean,now,now,'open']); const changed=await first(env,`SELECT changes() c`); await run(env,`UPDATE nimbus_v25_sources SET last_seen_at=?, reason=COALESCE(reason,?), title=COALESCE(title,?) WHERE url=?`,[now,reason||'manual_review',title||clean,clean]); return {new:Number(changed?.c||0)>0,item:{url:clean,domain,reason,title:title||clean}}; }
function confidence(megaUrl,sourceUrl,title){ let score=50; const reasons=[]; if(/\/folder\//i.test(megaUrl)||/#F!/i.test(megaUrl)){score+=12;reasons.push('folder-link')} const d=hostname(sourceUrl); if(/rentry|paste|github|reddit|archive|gist|telegra|controlc|notes|bunkr|erome|coomer|kemono|simpcity|urlscan/i.test(d)){score+=18;reasons.push('indexed-source')} if(/mega/i.test(title||'')){score+=8;reasons.push('title-mentions-mega')} return {score:Math.min(100,score),reason:reasons.join(', ')||'public-indexed-result'}; }

async function verifyLinks(request, env){
  await ensureSchema(env);
  const body=await readJson(request);
  const limit=clamp(Number(body.limit||30),1,80);
  const onlyUnchecked=body.onlyUnchecked!==false;
  let rs;
  if(onlyUnchecked) rs=await all(env,`SELECT id, mega_url FROM nimbus_v25_links WHERE health_status IS NULL OR health_status='' OR health_status='unverified' ORDER BY id DESC LIMIT ?`,[limit]);
  else rs=await all(env,`SELECT id, mega_url FROM nimbus_v25_links ORDER BY id DESC LIMIT ?`,[limit]);
  const items=[]; let live=0, removed=0, checked=0;
  for(const row of rows(rs)){
    const h=await verifyMegaLink(row.mega_url); checked++;
    if(['live','probably_live'].includes(h.status)) live++; else removed++;
    await run(env,`UPDATE nimbus_v25_links SET health_status=?, health_reason=?, health_checked_at=?, health_http_status=?, status=? WHERE id=?`,[h.status,h.reason||'',nowIso(),h.http_status||null, ['unavailable','reported_removed','invalid'].includes(h.status)?'unavailable':'active', row.id]);
    items.push({id:row.id, mega_url:row.mega_url, ...h});
  }
  return {ok:true,version:VERSION,mode:'mega_health_bot_no_download',checked,live,not_live:removed,items};
}
async function verifyMegaLink(megaUrl){
  const parsed=parseMegaPublicLink(megaUrl);
  if(!parsed) return {status:'invalid',reason:'invalid_mega_url'};
  const api=await verifyMegaApi(parsed);
  if(api.status!=='unknown') return api;
  return verifyMegaLanding(megaUrl);
}
function parseMegaPublicLink(u){
  const s=normalizeMega(u);
  let m=/mega\.(?:nz|io)\/folder\/([A-Za-z0-9_-]+)(?:#([A-Za-z0-9_-]+))?/i.exec(s); if(m) return {type:'folder',id:m[1],key:m[2]||'',url:s};
  m=/mega\.(?:nz|io)\/file\/([A-Za-z0-9_-]+)(?:#([A-Za-z0-9_-]+))?/i.exec(s); if(m) return {type:'file',id:m[1],key:m[2]||'',url:s};
  m=/mega\.(?:nz|io)\/#F!([A-Za-z0-9_-]+)!?([A-Za-z0-9_-]+)?/i.exec(s); if(m) return {type:'folder',id:m[1],key:m[2]||'',url:s};
  m=/mega\.(?:nz|io)\/#\!([A-Za-z0-9_-]+)!?([A-Za-z0-9_-]+)?/i.exec(s); if(m) return {type:'file',id:m[1],key:m[2]||'',url:s};
  return null;
}
async function verifyMegaApi(parsed){
  try{
    const payload = parsed.type==='folder' ? [{a:'f',c:parsed.id,r:1}] : [{a:'g',p:parsed.id}];
    const r=await fetch(`https://g.api.mega.co.nz/cs?id=${Date.now()%100000000}`,{method:'POST',headers:{'content-type':'application/json','user-agent':'Mozilla/5.0 NimbusCore/30 health bot'},body:JSON.stringify(payload),cf:{cacheTtl:0}});
    const data=await r.json().catch(()=>null);
    if(!r.ok) return {status:'unknown',reason:`mega_api_http_${r.status}`,http_status:r.status};
    const first=Array.isArray(data)?data[0]:data;
    if(typeof first==='number' && first<0) return {status:'unavailable',reason:`mega_api_error_${first}`,http_status:r.status};
    if(first && typeof first==='object'){
      if(parsed.type==='folder'){
        const count=Array.isArray(first.f)?first.f.length:null;
        return {status:count===0?'probably_live':'live',reason:count===0?'mega_api_folder_empty_or_hidden':`mega_api_folder_nodes_${count}`,http_status:r.status,node_count:count};
      }
      return {status:'live',reason:'mega_api_file_metadata_ok',http_status:r.status};
    }
    return {status:'unknown',reason:'mega_api_unrecognized',http_status:r.status};
  }catch(e){ return {status:'unknown',reason:`mega_api_exception:${String(e.message||e).slice(0,80)}`}; }
}
async function verifyMegaLanding(megaUrl){
  const fetched=await fetchText(megaUrl,7000);
  if(!fetched.ok) return {status:'unknown',reason:fetched.error||'landing_fetch_failed'};
  const t=String(fetched.text||'').toLowerCase();
  if(/reported to contain objectionable|child exploitation|violent extremism|bestiality|provided to the authorities/.test(t)) return {status:'reported_removed',reason:'mega_reported_removed'};
  if(/folder link unavailable|file link unavailable|link unavailable|has been deleted|disabled by the owner|invalid url|does not exist|violated our terms of service|removed as it violated/.test(t)) return {status:'unavailable',reason:'mega_landing_unavailable'};
  if(/mega/i.test(fetched.text||'')) return {status:'probably_live',reason:'mega_landing_no_unavailable_marker'};
  return {status:'unknown',reason:'landing_no_signal'};
}


async function audit(env){
  await ensureSchema(env);
  return {ok:true,version:VERSION,all_results_visible:true,content_category_filters:false,content_keyword_blocklist:false,hidden_result_filters:false,structural_mega_url_validation_only:true,excluded_source_prefixes:EXCLUDED_SOURCE_PREFIXES,health_status_visible_for_all_links:true,notes:['Links are not hidden because of health status.','Unavailable links remain visible with red status.','Only non-MEGA malformed strings are rejected by structural URL validation.'],counts:await getCounts(env)};
}
async function reportPackage(env,url,headers){
  await ensureSchema(env);
  const format=String(url.searchParams.get('format')||'json').toLowerCase();
  const status=String(url.searchParams.get('status')||'all').toLowerCase();
  let sql='SELECT mega_url,source_url,source_domain,title,confidence,confidence_reason,health_status,health_reason,health_checked_at,discovered_at,last_seen_at FROM nimbus_v25_links';
  const params=[];
  if(status!=='all'){ sql+=' WHERE health_status=?'; params.push(status); }
  sql+=' ORDER BY id DESC LIMIT 10000';
  const data=rows(await all(env,sql,params));
  if(format==='csv'){
    const csv=['mega_url,source_url,source_domain,title,confidence,confidence_reason,health_status,health_reason,health_checked_at,discovered_at,last_seen_at'].concat(data.map(r=>[r.mega_url,r.source_url,r.source_domain,r.title,r.confidence,r.confidence_reason,r.health_status,r.health_reason,r.health_checked_at,r.discovered_at,r.last_seen_at].map(csvCell).join(','))).join('
');
    return new Response(csv,{status:200,headers:{...headers,'content-type':'text/csv;charset=utf-8','content-disposition':'attachment; filename="nimbus-core-v30-report-package.csv"'}});
  }
  return json({ok:true,version:VERSION,purpose:'review_and_report_package',items:data},200,headers);
}

async function latest(env,url){ await ensureSchema(env); const limit=clamp(Number(url.searchParams.get('limit')||10),1,100); const rs=await all(env,`SELECT id,mega_url,source_url,source_domain,title,confidence,confidence_reason,health_status,health_reason,health_checked_at,discovered_at,last_seen_at FROM nimbus_v25_links ORDER BY COALESCE(discovered_at,last_seen_at) DESC,id DESC LIMIT ?`,[limit]); return {ok:true,version:VERSION,items:rows(rs),counts:await getCounts(env)}; }
async function archive(env,url){ await ensureSchema(env); const limit=clamp(Number(url.searchParams.get('limit')||30),1,100); const offset=Math.max(0,Number(url.searchParams.get('offset')||0)); const q=String(url.searchParams.get('q')||'').trim(); let rs; if(q) rs=await all(env,`SELECT * FROM nimbus_v25_links WHERE mega_url LIKE ? OR source_url LIKE ? OR title LIKE ? ORDER BY COALESCE(discovered_at,last_seen_at) DESC,id DESC LIMIT ? OFFSET ?`,[`%${q}%`,`%${q}%`,`%${q}%`,limit,offset]); else rs=await all(env,`SELECT * FROM nimbus_v25_links ORDER BY COALESCE(discovered_at,last_seen_at) DESC,id DESC LIMIT ? OFFSET ?`,[limit,offset]); return {ok:true,version:VERSION,offset,limit,next_offset:offset+limit,items:rows(rs)}; }
async function manualSources(env,url){ await ensureSchema(env); const limit=clamp(Number(url.searchParams.get('limit')||50),1,100); const rs=await all(env,`SELECT * FROM nimbus_v25_sources ORDER BY COALESCE(discovered_at,last_seen_at) DESC,id DESC LIMIT ?`,[limit]); return {ok:true,version:VERSION,items:rows(rs)}; }
async function deleteLink(request,env){ await ensureSchema(env); const body=await readJson(request); const id=Number(body.id||0); const mega=body.mega_url?normalizeMega(body.mega_url):''; if(id) await run(env,'DELETE FROM nimbus_v25_links WHERE id=?',[id]); else if(mega) await run(env,'DELETE FROM nimbus_v25_links WHERE mega_url=?',[mega]); else return {ok:false,version:VERSION,error:'missing_id_or_url'}; return {ok:true,version:VERSION}; }
async function cleanup(env){ await ensureSchema(env); await run(env,`DELETE FROM nimbus_v25_links WHERE mega_url IS NULL OR mega_url='' OR mega_url NOT LIKE 'https://mega.%'`); await run(env,`DELETE FROM nimbus_v25_links WHERE source_url LIKE 'https://t.me/s/mega_drive_links_courses_new%'`); await run(env,`DELETE FROM nimbus_v25_sources WHERE url IS NULL OR url='' OR url LIKE 'https://t.me/s/mega_drive_links_courses_new%'`); await setState(env,'auto_cursor','0'); return {ok:true,version:VERSION,message:'V30 cleanup complete. Stable V25 storage kept; all results remain visible with health status badges.',counts:await getCounts(env)}; }
async function exportLinks(env,url,headers){ await ensureSchema(env); const format=String(url.searchParams.get('format')||'json').toLowerCase(); const rs=await all(env,'SELECT mega_url,source_url,source_domain,title,confidence,health_status,health_reason,health_checked_at,discovered_at,last_seen_at FROM nimbus_v25_links ORDER BY id DESC LIMIT 5000'); const data=rows(rs); if(format==='csv'){ const csv=['mega_url,source_url,source_domain,title,confidence,health_status,health_reason,health_checked_at,discovered_at,last_seen_at'].concat(data.map(r=>[r.mega_url,r.source_url,r.source_domain,r.title,r.confidence,r.health_status,r.health_reason,r.health_checked_at,r.discovered_at,r.last_seen_at].map(csvCell).join(','))).join('\n'); return new Response(csv,{status:200,headers:{...headers,'content-type':'text/csv;charset=utf-8','content-disposition':'attachment; filename="nimbus-core-v30-export.csv"'}}); } return json({ok:true,version:VERSION,items:data},200,headers); }
async function resetCursor(env){ await ensureSchema(env); await setState(env,'auto_cursor','0'); return {ok:true,version:VERSION,message:'cursor reset'}; }
async function diagnostics(env){ await ensureSchema(env); return {ok:true,version:VERSION,status:await publicStatus(env),counts:await getCounts(env),last_batch:safeJson(await getState(env,'last_batch'))}; }
function rows(result){return Array.isArray(result?.results)?result.results:[]} function clamp(n,min,max){return Math.min(max,Math.max(min,Number.isFinite(n)?n:min))} function dedupe(arr){return Array.from(new Set((arr||[]).filter(Boolean)))} function hostname(u){try{return new URL(u).hostname.replace(/^www\./,'').toLowerCase()}catch{return''}} function isManualDomain(d){return MANUAL_DOMAINS.some(x=>d===x||d.endsWith('.'+x))} function isExcludedUrl(u){const s=String(u||'').toLowerCase(); return EXCLUDED_SOURCE_PREFIXES.some(x=>s.startsWith(x.toLowerCase()))} function healthDbStatus(status){return ['unavailable','reported_removed','invalid'].includes(String(status||''))?'unavailable':'active'} async function mapLimit(items,limit,fn){const out=new Array(items.length);let i=0;async function worker(){while(i<items.length){const idx=i++;out[idx]=await fn(items[idx],idx)}} await Promise.all(Array.from({length:Math.min(limit,items.length)},worker));return out} function cleanUrl(u){return String(u||'').trim().replace(/&amp;/g,'&').replace(/[)\]}>'"\s]+$/g,'')} function decodeHtml(s){return String(s||'').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>')} function extractTitle(text){const m=/<title[^>]*>(.*?)<\/title>/is.exec(String(text||'')); return m?decodeHtml(m[1]).replace(/\s+/g,' ').trim().slice(0,180):''} function csvCell(v){return `"${String(v??'').replace(/"/g,'""')}"`} function safeJson(s){try{return JSON.parse(s||'{}')}catch{return{}}}
function resetPage(){ const html=`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Nimbus Reset</title></head><body style="background:#050914;color:#fff;font-family:system-ui;padding:24px"><h1>Nimbus Core V30 Reset</h1><pre id="log">Resetting...</pre><script>(async()=>{const log=document.getElementById('log'),out=[];function line(x){out.push(x);log.textContent=out.join('\\n')}try{if('serviceWorker'in navigator){const regs=await navigator.serviceWorker.getRegistrations();for(const r of regs){await r.unregister();line('Service worker removed')}}}catch(e){line('SW: '+e.message)}try{if(window.caches){const keys=await caches.keys();for(const k of keys){await caches.delete(k);line('Cache deleted: '+k)}}}catch(e){line('Cache: '+e.message)}try{localStorage.clear();sessionStorage.clear();line('Storage cleared')}catch(e){line('Storage: '+e.message)}line('Done. Opening V30 fresh...');setTimeout(()=>location.href='/?v=30&fresh=1',900)})();</script></body></html>`; return new Response(html,{headers:{'content-type':'text/html;charset=utf-8','cache-control':'no-store'}}); }
