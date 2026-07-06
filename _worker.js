const VERSION="1.5.0";
const MEGA_RE=/https?:\/\/(?:www\.)?mega\.nz\/(?:file|folder)\/[A-Za-z0-9_-]{6,}#[A-Za-z0-9_-]{8,}|https?:\/\/(?:www\.)?mega\.nz\/(?:#!|#F!)[A-Za-z0-9!_-]{12,}/gi;

const URL_PATTERNS=[
`"https://mega.nz/folder/"`,
`"https://mega.nz/file/"`,
`"mega.nz/folder/" "#"`,
`"mega.nz/file/" "#"`,
`"mega.nz/#F!"`,
`"mega.nz/#!"`,
`"mega.nz" "/folder/"`,
`"mega.nz" "/file/"`,
`"mega.nz/folder/" "rentry.co"`,
`"mega.nz/file/" "rentry.co"`,
`"mega.nz/folder/" "paste"`,
`"mega.nz/file/" "paste"`,
`"mega.nz/folder/" "download"`,
`"mega.nz/file/" "download"`,
`"mega.nz/folder/" "shared"`,
`"mega.nz/file/" "shared"`
];

const SOURCE_DOMAINS=[
"rentry.co","pastebin.com","pastelink.net","paste.ee","justpaste.it","telegra.ph","gist.github.com","github.com","reddit.com","ofversedrops.com",
"controlc.com","pastes.io","hastebin.com","dpaste.com","notes.io","sebsauvage.net","ghostbin.site","0bin.net","throwbin.io","nekobin.com",
"paste.rs","paste.mozilla.org","paste2.org","privatebin.net","paste.c-net.org","pastebin.pl","paste.sh","snippet.host","anotepad.com","yamcode.com",
"ahmia.fi","onionland.io","onionengine.com","dark.fail","urlscan.io","any.run"
];

const TOR_ONLY=[
"duckduckgogg42xjoc72x3sjasowoarfbgcmvfimaftt6twagswzczad.onion","haystak5njsmn2hqkewecpaxetahtwhsbsa64jom2k22z5afxhnpxfid.onion","torchdeedp3i2jigzjdmfpn5ptjhzt7m5gb2b56dov4bd5y5hpx2gwqd.onion","tornoteev2z6p6ih2ut7bg6py3ri5x3qhc4hhcgz7gmw5nn7d5ln6ad.onion","onionlande3hgjhz5jz3u7vgd3g6o6m4icn6tht36twdqibpby5y7yd.onion","candle6q4m6j4k5n.onion","vormwebc7w4h7k6r.onion","tor66sewebg7whfpn.onion","excavator2b7k7r5w.onion","darksearch7x3q5y7r.onion","deepsearch2x3q5y7r.onion","recon7x3q5y7r.onion","kilos7x3q5y7r.onion","zqktlwiuavvvqqt4ybvgvi7tyo4hjl5xgfuvpdf6otjiycgwqbym2qad.onion","onionlinks3x3q5y7r.onion","darkweblinks3x3q5y7r.onion"
];

const PROTECTED_HINTS=["login","sign in","signin","subscribe","subscription","unlock","credits","captcha","verification","register","premium","paywall","forbidden","access denied"];

export default{async fetch(request,env,ctx){const url=new URL(request.url);try{
if(url.pathname==="/api/login"&&request.method==="POST")return login(request,env);
if(url.pathname==="/api/ping")return withAuth(request,env,()=>json({ok:true,version:VERSION,db_bound:!!env.DB,auth_pin_configured:!!env.AUTH_PIN,brave_enabled:!!env.BRAVE_API_KEY,mode:"link_first_url_pattern_scan",patterns:URL_PATTERNS.length,sources:SOURCE_DOMAINS.length}));
if(url.pathname==="/api/session")return withAuth(request,env,()=>json({ok:true,version:VERSION,session:"valid"}));
if(url.pathname==="/api/schema")return withAuth(request,env,()=>schema(env));
if(url.pathname==="/api/latest")return withAuth(request,env,()=>listLinks(env,url));
if(url.pathname==="/api/archive")return withAuth(request,env,()=>listLinks(env,url));
if(url.pathname==="/api/manual-sources")return withAuth(request,env,()=>manualList(env,url));
if(url.pathname==="/api/cleanup"&&request.method==="POST")return withAuth(request,env,()=>cleanup(env));
if(url.pathname==="/api/delete-link"&&request.method==="POST")return withAuth(request,env,()=>deleteLink(request,env));
if(url.pathname==="/api/search"&&request.method==="POST")return withAuth(request,env,()=>search(request,env));
if(url.pathname.startsWith("/api/"))return json({ok:false,error:"API route not found"},404);
if(env.ASSETS){const res=await env.ASSETS.fetch(request);const h=new Headers(res.headers);if(url.pathname==="/"||url.pathname.endsWith(".html")||url.pathname.endsWith(".js")||url.pathname.endsWith(".css"))h.set("cache-control","no-store");return new Response(res.body,{status:res.status,headers:h});}
return new Response("Nimbus Core static assets unavailable",{status:404});
}catch(err){return json({ok:false,error:"Worker exception",version:VERSION,message:err?.message||String(err)},500);}}};

async function login(request,env){if(!env.AUTH_PIN)return json({ok:false,error:"AUTH_PIN missing"},500);const body=await request.json().catch(()=>({}));if(String(body.pin||"")!==String(env.AUTH_PIN))return json({ok:false,error:"Invalid PIN"},401);const exp=Math.floor(Date.now()/1000)+2592000;const payload=b64url(JSON.stringify({exp,iat:Math.floor(Date.now()/1000),v:VERSION}));const sig=await sign(payload,env);return json({ok:true,version:VERSION,token:`${payload}.${sig}`,expires:exp});}
async function withAuth(request,env,fn){const auth=request.headers.get("authorization")||"";const token=auth.startsWith("Bearer ")?auth.slice(7):"";const valid=await verifyToken(token,env);if(!valid.ok)return json({ok:false,error:"Unauthorized",reason:valid.reason},401);return fn();}
async function verifyToken(token,env){if(!env.AUTH_PIN)return{ok:false,reason:"AUTH_PIN missing"};const parts=String(token||"").split(".");if(parts.length!==2)return{ok:false,reason:"token missing"};const[payload,sig]=parts;const expected=await sign(payload,env);if(sig!==expected)return{ok:false,reason:"bad signature"};try{const data=JSON.parse(atob(payload.replace(/-/g,"+").replace(/_/g,"/")));if(data.exp<Math.floor(Date.now()/1000))return{ok:false,reason:"expired"};return{ok:true};}catch{return{ok:false,reason:"bad payload"}}}
async function sign(payload,env){const secret=env.AUTH_SECRET||env.AUTH_PIN;const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);const sig=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(payload));return b64urlBytes(new Uint8Array(sig));}
function b64url(s){return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
function b64urlBytes(bytes){let s="";for(const b of bytes)s+=String.fromCharCode(b);return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}

async function schema(env){const db=getDB(env);if(!db.ok)return db.response;await createTables(db.value);return json({ok:true,version:VERSION,message:"D1 schema is ready",binding:"DB"});}
async function createTables(db){
await db.prepare(`CREATE TABLE IF NOT EXISTS mega_links (id INTEGER PRIMARY KEY AUTOINCREMENT, mega_url TEXT UNIQUE NOT NULL, source_url TEXT, title TEXT, query TEXT, region TEXT, confidence INTEGER DEFAULT 50, confidence_reason TEXT, discovered_at TEXT DEFAULT CURRENT_TIMESTAMP, last_seen_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
await db.prepare(`CREATE TABLE IF NOT EXISTS manual_sources (id INTEGER PRIMARY KEY AUTOINCREMENT, source_url TEXT UNIQUE NOT NULL, title TEXT, reason TEXT, query TEXT, region TEXT, discovered_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
await db.prepare(`CREATE TABLE IF NOT EXISTS protected_sources (id INTEGER PRIMARY KEY AUTOINCREMENT, source_url TEXT UNIQUE NOT NULL, title TEXT, reason TEXT, query TEXT, region TEXT, discovered_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
await db.prepare(`CREATE TABLE IF NOT EXISTS scan_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, query TEXT, regions TEXT, pages_scanned INTEGER DEFAULT 0, mega_found INTEGER DEFAULT 0, protected_found INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
await db.prepare(`CREATE TABLE IF NOT EXISTS scan_state (id TEXT PRIMARY KEY, cursor INTEGER DEFAULT 0, updated_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
await ensureColumn(db,"mega_links","confidence","INTEGER DEFAULT 50");await ensureColumn(db,"mega_links","confidence_reason","TEXT");await ensureColumn(db,"mega_links","last_seen_at","TEXT DEFAULT CURRENT_TIMESTAMP");
}
async function ensureColumn(db,table,col,def){const info=await db.prepare(`PRAGMA table_info(${table})`).all();if(!(info.results||[]).some(r=>r.name===col)){await db.prepare(`ALTER TABLE ${table} ADD COLUMN ${col} ${def}`).run();}}

async function cleanup(env){
const db=getDB(env);if(!db.ok)return db.response;await createTables(db.value);
const a=await db.value.prepare(`UPDATE mega_links SET query=NULL, region=NULL WHERE query IS NOT NULL OR region IS NOT NULL`).run();
const b=await db.value.prepare(`UPDATE manual_sources SET query=NULL, region=NULL WHERE query IS NOT NULL OR region IS NOT NULL`).run();
const c=await db.value.prepare(`DELETE FROM mega_links WHERE id NOT IN (SELECT MIN(id) FROM mega_links GROUP BY mega_url)`).run();
return json({ok:true,version:VERSION,message:"Old query labels and region labels removed. Duplicate links cleaned.",mega_labels_removed:a.meta?.changes||0,manual_labels_removed:b.meta?.changes||0,duplicates_deleted:c.meta?.changes||0});
}
async function deleteLink(request,env){const db=getDB(env);if(!db.ok)return db.response;await createTables(db.value);const body=await request.json().catch(()=>({}));const id=Number(body.id||0);if(!id)return json({ok:false,error:"Missing id"},400);const r=await db.value.prepare(`DELETE FROM mega_links WHERE id=?`).bind(id).run();return json({ok:true,deleted:r.meta?.changes||0});}
async function listLinks(env,url){const db=getDB(env);if(!db.ok)return db.response;await createTables(db.value);const limit=clamp(Number(url.searchParams.get("limit")||30),1,100);const offset=clamp(Number(url.searchParams.get("offset")||0),0,1000000);const q=String(url.searchParams.get("q")||"").trim();let where="",binds=[];if(q){where=`WHERE mega_url LIKE ? OR source_url LIKE ? OR title LIKE ?`;binds=[`%${q}%`,`%${q}%`,`%${q}%`];}const items=await db.value.prepare(`SELECT * FROM mega_links ${where} ORDER BY datetime(last_seen_at) DESC, confidence DESC, id DESC LIMIT ? OFFSET ?`).bind(...binds,limit,offset).all();const total=await db.value.prepare(`SELECT COUNT(*) AS count FROM mega_links ${where}`).bind(...binds).first();const last=await db.value.prepare(`SELECT created_at FROM scan_logs ORDER BY id DESC LIMIT 1`).first();return json({ok:true,version:VERSION,total:total?.count||0,items:items.results||[],lastScan:last?.created_at||"--",limit,offset});}
async function manualList(env,url){const db=getDB(env);if(!db.ok)return db.response;await createTables(db.value);const limit=clamp(Number(url.searchParams.get("limit")||30),1,100);const offset=clamp(Number(url.searchParams.get("offset")||0),0,1000000);const items=await db.value.prepare(`SELECT * FROM manual_sources ORDER BY datetime(discovered_at) DESC, id DESC LIMIT ? OFFSET ?`).bind(limit,offset).all();const total=await db.value.prepare(`SELECT COUNT(*) AS count FROM manual_sources`).first();return json({ok:true,version:VERSION,total:total?.count||0,items:items.results||[],limit,offset});}

async function search(request,env){
const db=getDB(env);if(!db.ok)return db.response;await createTables(db.value);
const body=await request.json().catch(()=>({}));
const keyword=String(body.keyword||"").trim();
const limitPages=clamp(Number(body.limitPages||180),40,200);
const state=await getState(db.value,keyword);
const patterns=buildPatterns(keyword,state.cursor,!!body.more);
await setState(db.value,keyword,state.cursor+patterns.length);
let pages=[];const engines=new Set();
for(const pattern of patterns){
 const results=await Promise.allSettled([duckSearch(pattern),bingSearch(pattern),braveSearch(pattern,env),mojeekSearch(pattern),yepSearch(pattern),ahmiaSearch(pattern),onionLandSearch(pattern),onionEngineSearch(pattern)]);
 for(const r of results){if(r.status==="fulfilled"){pages.push(...r.value);for(const p of r.value)engines.add(p.engine)}}
 if(pages.length>=limitPages*5)break;
}
pages=dedupePages(pages);
const batch=pages.slice(0,limitPages);
let megaFound=0,manualSources=0,scanned=0,newLinks=0,seenLinks=0;
for(const page of batch){const r=await inspectPage(page,keyword,db.value);scanned++;megaFound+=r.mega||0;manualSources+=r.manual||0;newLinks+=r.newLinks||0;seenLinks+=r.seenLinks||0;}
for(const onion of TOR_ONLY){await saveManual(db.value,"http://"+onion,"Tor-only source","Requires Tor browser");}
await db.value.prepare(`INSERT INTO scan_logs(query,regions,pages_scanned,mega_found,protected_found) VALUES(?,?,?,?,?)`).bind("link-first-url-patterns","open-web",scanned,megaFound,manualSources).run();
const items=await db.value.prepare(`SELECT * FROM mega_links ORDER BY datetime(last_seen_at) DESC, confidence DESC, id DESC LIMIT 100`).all();
const latestTotal=await db.value.prepare(`SELECT COUNT(*) AS count FROM mega_links`).first();
const manualTotal=await db.value.prepare(`SELECT COUNT(*) AS count FROM manual_sources`).first();
return json({ok:true,version:VERSION,mode:"link_first_url_pattern_scan",keyword_mode:keyword?"manual_optional":"none",batch_cursor:state.cursor,patterns_used:patterns.length,engines_used:[...engines],search_results_collected:pages.length,pages_scanned:scanned,mega_found:megaFound,manual_sources_found:manualSources,new_links:newLinks,seen_links:seenLinks,latest_total:latestTotal?.count||0,manual_total:manualTotal?.count||0,scan_time:new Date().toISOString(),items:items.results||[]});
}
async function getState(db,keyword){const id=keyword?`manual:${keyword}`:"link-first";let row=await db.prepare(`SELECT cursor FROM scan_state WHERE id=?`).bind(id).first();if(!row){await db.prepare(`INSERT INTO scan_state(id,cursor) VALUES(?,0)`).bind(id).run();row={cursor:0}}return{cursor:Number(row.cursor||0),id};}
async function setState(db,keyword,cursor){const id=keyword?`manual:${keyword}`:"link-first";await db.prepare(`UPDATE scan_state SET cursor=?, updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(cursor,id).run();}
function buildPatterns(keyword,cursor=0,more=false){
let bank=[];
if(keyword){
 bank.push(`"${keyword}" "mega.nz/folder/"`,`"${keyword}" "mega.nz/file/"`,`"${keyword}" "mega.nz/#F!"`,`"${keyword}" "mega.nz/#!"`);
 for(const site of SOURCE_DOMAINS){bank.push(`site:${site} "${keyword}" "mega.nz/folder/"`,`site:${site} "${keyword}" "mega.nz/file/"`)}
}else{
 bank.push(...URL_PATTERNS);
 for(const site of SOURCE_DOMAINS){bank.push(`site:${site} "mega.nz/folder/"`,`site:${site} "mega.nz/file/"`,`site:${site} "mega.nz/#F!"`,`site:${site} "mega.nz/#!"`)}
 bank.push(`intext:"https://mega.nz/folder/"`,`intext:"https://mega.nz/file/"`,`intitle:"mega.nz/folder/"`,`intitle:"mega.nz/file/"`);
 if(more){bank.push(`"mega.nz/folder/" "#" "https"`,`"mega.nz/file/" "#" "https"`,`"mega.nz/folder/" "key"`,`"mega.nz/file/" "key"`,`"mega.nz/folder/" "shared"`,`"mega.nz/file/" "shared"`);}
}
bank=[...new Set(bank.map(x=>x.trim()).filter(Boolean))];
const start=cursor%bank.length;return rotate(bank,start).slice(0,more?140:100);
}
function rotate(arr,start){return arr.slice(start).concat(arr.slice(0,start));}

async function duckSearch(q){try{const res=await fetch("https://html.duckduckgo.com/html/?q="+encodeURIComponent(q)+"&kl=wt-wt",{headers:{"User-Agent":"Mozilla/5.0","Accept":"text/html"}});const html=await res.text();const out=[];const re=/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gsi;let m;while((m=re.exec(html))!==null){const href=cleanDuckUrl(decodeHtml(m[1]));const title=stripTags(decodeHtml(m[2]));if(href&&href.startsWith("http"))out.push({url:href,title:title||"Search Result",engine:"duckduckgo"});}return out.slice(0,14);}catch{return[]}}
async function bingSearch(q){try{const res=await fetch("https://www.bing.com/search?q="+encodeURIComponent(q)+"&count=30&setmkt=en-WW",{headers:{"User-Agent":"Mozilla/5.0","Accept":"text/html"}});const html=await res.text();const out=[];const re=/<li class="b_algo"[\s\S]*?<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gsi;let m;while((m=re.exec(html))!==null){const href=decodeHtml(m[1]);const title=stripTags(decodeHtml(m[2]));if(href&&href.startsWith("http"))out.push({url:href,title:title||"Search Result",engine:"bing"});}return out.slice(0,14);}catch{return[]}}
async function braveSearch(q,env){if(!env.BRAVE_API_KEY)return[];try{const res=await fetch("https://api.search.brave.com/res/v1/web/search?q="+encodeURIComponent(q)+"&count=20&country=ALL",{headers:{"Accept":"application/json","X-Subscription-Token":env.BRAVE_API_KEY}});const data=await res.json();return(data.web?.results||[]).map(r=>({url:r.url,title:r.title||"Brave Result",engine:"brave"})).slice(0,20);}catch{return[]}}
async function mojeekSearch(q){return genericLinks("https://www.mojeek.com/search?q="+encodeURIComponent(q),"mojeek")}
async function yepSearch(q){return genericLinks("https://yep.com/web?q="+encodeURIComponent(q),"yep")}
async function ahmiaSearch(q){return genericLinks("https://ahmia.fi/search/?q="+encodeURIComponent(q),"ahmia")}
async function onionLandSearch(q){return genericLinks("https://onionland.io/search?q="+encodeURIComponent(q),"onionland-web")}
async function onionEngineSearch(q){return genericLinks("https://onionengine.com/search.php?search="+encodeURIComponent(q),"onionengine-web")}
async function genericLinks(url,engine){try{const res=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0","Accept":"text/html"}});const html=await res.text();const out=[];const re=/<a\s+(?:[^>]*?\s+)?href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gsi;let m;while((m=re.exec(html))!==null){let href=decodeHtml(m[1]);if(href.startsWith("/")){const u=new URL(url);href=u.origin+href}const title=stripTags(decodeHtml(m[2]));if(href.startsWith("http")&&!href.includes("javascript:"))out.push({url:href,title:title||engine,engine});}return out.slice(0,16);}catch{return[]}}

async function inspectPage(page,keyword,db){
let mega=0,manual=0,newLinks=0,seenLinks=0;
const direct=[...extractMega(page.url),...extractMega(page.title)];
for(const link of direct){const c=score(link,page,"direct",keyword);const saved=await saveMega(db,link,page.url,page.title,c.score,c.reason);mega++;saved?newLinks++:seenLinks++;}
let text="",status=0;
try{
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),9000);
 const res=await fetch(page.url,{signal:controller.signal,headers:{"User-Agent":"Mozilla/5.0 NimbusCore","Accept":"text/html,text/plain,application/json,*/*"}});
 clearTimeout(timer);status=res.status;const type=res.headers.get("content-type")||"";
 if(type.includes("text")||type.includes("html")||type.includes("json")||type==="")text=(await res.text()).slice(0,1200000);
 const links=extractMega(text);
 for(const link of links){const c=score(link,page,text,keyword);const saved=await saveMega(db,link,page.url,page.title,c.score,c.reason);mega++;saved?newLinks++:seenLinks++;}
 if(links.length===0&&direct.length===0&&(status===401||status===403||status===402||isProtected(text,page.url))){const saved=await saveManual(db,page.url,page.title,reasonFrom(status,text));if(saved)manual++;}
}catch(e){}
return{mega,manual,newLinks,seenLinks};
}
function score(link,page,text,keyword){let s=50,reasons=[];const host=safeHost(page.url);if(host.includes("rentry.co")){s+=25;reasons.push("rentry source")}if(host.includes("paste")||host.includes("justpaste")){s+=18;reasons.push("paste source")}if(host.includes("github")||host.includes("gist")){s+=10;reasons.push("developer source")}if(link.includes("/folder/")){s+=8;reasons.push("folder link")}if(page.engine){s+=5;reasons.push(page.engine)}if(keyword&&String(page.title||"").toLowerCase().includes(keyword.toLowerCase())){s+=8;reasons.push("manual keyword in title")}return{score:Math.min(99,s),reason:reasons.join(", ")||"MEGA URL pattern"}}
async function saveMega(db,mega,source,title,confidence,reason){const r=await db.prepare(`INSERT OR IGNORE INTO mega_links(mega_url,source_url,title,query,region,confidence,confidence_reason) VALUES(?,?,?,?,?,?,?)`).bind(mega,source,title||"MEGA Link",null,null,confidence||50,reason||"MEGA URL pattern").run();await db.prepare(`UPDATE mega_links SET last_seen_at=CURRENT_TIMESTAMP, query=NULL, region=NULL, confidence=MAX(COALESCE(confidence,0), ?), confidence_reason=COALESCE(confidence_reason, ?), source_url=COALESCE(source_url, ?), title=COALESCE(title, ?) WHERE mega_url=?`).bind(confidence||50,reason||"MEGA URL pattern",source,title||"MEGA Link",mega).run();return(r.meta?.changes||0)>0;}
async function saveManual(db,source,title,reason){const r=await db.prepare(`INSERT OR IGNORE INTO manual_sources(source_url,title,reason,query,region) VALUES(?,?,?,?,?)`).bind(source,title||"Manual Source",reason,null,null).run();return(r.meta?.changes||0)>0;}
function extractMega(text){const matches=String(text||"").match(MEGA_RE)||[];return[...new Set(matches.map(cleanMega).filter(isRealMega))];}
function cleanMega(x){return String(x).replace(/&amp;/g,"&").replace(/%23/g,"#").replace(/["'<>)\]}،؛\s]+$/g,"").trim()}
function isRealMega(x){const l=String(x||"").toLowerCase();return(l.includes("mega.nz/file/")||l.includes("mega.nz/folder/")||l.includes("mega.nz/#!")||l.includes("mega.nz/#f!"))&&!/(example|xxxx|placeholder|demo|\.png|\.jpg|\.jpeg|\.webp|\.css|\.js|wordmark|logo)/i.test(l)}
function isProtected(text,url){const t=(String(text||"")+" "+url).toLowerCase();return PROTECTED_HINTS.some(w=>t.includes(w))}
function reasonFrom(status,text){if(status===401)return"Login required";if(status===403)return"Access forbidden";if(status===402)return"Payment required";const t=String(text||"").toLowerCase();if(t.includes("captcha"))return"Captcha";if(t.includes("credits"))return"Credits required";if(t.includes("unlock"))return"Unlock required";if(t.includes("subscribe")||t.includes("subscription"))return"Subscription required";if(t.includes("login")||t.includes("sign in"))return"Login required";return"Manual review needed"}
function dedupePages(items){const seen=new Set(),out=[];for(const item of items){try{const u=new URL(item.url);u.hash="";const clean=u.href;if(!seen.has(clean)){seen.add(clean);item.url=clean;out.push(item)}}catch{}}return out}
function cleanDuckUrl(href){try{href=href.replace(/&amp;/g,"&");if(href.includes("/l/?")){const u=new URL("https://duckduckgo.com"+href);return decodeURIComponent(u.searchParams.get("uddg")||"")}return href}catch{return""}}
function decodeHtml(x){return String(x).replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#x2F;/g,"/").replace(/&#39;/g,"'")}
function stripTags(x){return String(x).replace(/<[^>]+>/g,"").replace(/\s+/g," ").trim()}
function safeHost(u){try{return new URL(u).host}catch{return""}}
function getDB(env){if(!env.DB)return{ok:false,response:json({ok:false,error:"D1 binding DB is missing"},500)};return{ok:true,value:env.DB}}
function clamp(n,min,max){return Math.max(min,Math.min(max,Number.isFinite(n)?n:min))}
function json(data,status=200){return new Response(JSON.stringify(data,null,2),{status,headers:{"content-type":"application/json;charset=utf-8","cache-control":"no-store","access-control-allow-origin":"*"}})}
