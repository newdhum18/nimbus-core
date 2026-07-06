const VERSION="0.9.0";
const MEGA_RE=/https?:\/\/(?:www\.)?mega\.nz\/(?:file|folder)\/[A-Za-z0-9_-]{6,}#[A-Za-z0-9_-]{8,}|https?:\/\/(?:www\.)?mega\.nz\/(?:#!|#F!)[A-Za-z0-9!_-]{12,}/gi;
const PROTECTED_HINTS=["login","sign in","signin","subscribe","subscription","unlock","credits","captcha","verification","register","premium","paywall","forbidden","access denied"];
const SOURCES=["rentry.co","pastebin.com","pastelink.net","paste.ee","justpaste.it","telegra.ph","gist.github.com","github.com","reddit.com","ofversedrops.com","controlc.com","pastes.io","hastebin.com","dpaste.com","notes.io"];

export default {
  async fetch(request, env, ctx) {
    const url=new URL(request.url);
    try{
      if(url.pathname==="/api/login" && request.method==="POST") return login(request,env);
      if(url.pathname==="/api/ping") return withAuth(request,env,()=>json({ok:true,version:VERSION,db_bound:!!env.DB,auth_pin_configured:!!env.AUTH_PIN,message:"API ready"}));
      if(url.pathname==="/api/session") return withAuth(request,env,()=>json({ok:true,version:VERSION,session:"valid"}));
      if(url.pathname==="/api/schema") return withAuth(request,env,()=>schema(env));
      if(url.pathname==="/api/latest") return withAuth(request,env,()=>latest(env,url));
      if(url.pathname==="/api/protected") return withAuth(request,env,()=>protectedList(env,url));
      if(url.pathname==="/api/search" && request.method==="POST") return withAuth(request,env,()=>search(request,env,ctx));
      if(url.pathname.startsWith("/api/")) return json({ok:false,error:"API route not found"},404);
      if(env.ASSETS) return env.ASSETS.fetch(request);
      return new Response("Nimbus Core static assets are not available.",{status:404});
    }catch(err){return json({ok:false,error:"Worker exception",version:VERSION,message:err?.message||String(err)},500);}
  }
};

async function login(request,env){
  if(!env.AUTH_PIN) return json({ok:false,error:"AUTH_PIN is missing. Add Cloudflare variable AUTH_PIN."},500);
  const body=await request.json().catch(()=>({}));
  if(String(body.pin||"")!==String(env.AUTH_PIN)) return json({ok:false,error:"Invalid PIN"},401);
  const exp=Math.floor(Date.now()/1000)+60*60*24*30;
  const payload=b64url(JSON.stringify({exp,iat:Math.floor(Date.now()/1000),v:VERSION}));
  const sig=await sign(payload,env);
  return json({ok:true,version:VERSION,token:`${payload}.${sig}`,expires:exp});
}
async function withAuth(request,env,fn){
  const auth=request.headers.get("authorization")||"";
  const token=auth.startsWith("Bearer ")?auth.slice(7):"";
  const valid=await verifyToken(token,env);
  if(!valid.ok) return json({ok:false,error:"Unauthorized",reason:valid.reason},401);
  return fn();
}
async function verifyToken(token,env){
  if(!env.AUTH_PIN) return {ok:false,reason:"AUTH_PIN missing"};
  const parts=String(token||"").split(".");
  if(parts.length!==2) return {ok:false,reason:"token missing"};
  const [payload,sig]=parts;
  const expected=await sign(payload,env);
  if(sig!==expected) return {ok:false,reason:"bad signature"};
  try{const data=JSON.parse(atob(payload.replace(/-/g,"+").replace(/_/g,"/"))); if(data.exp<Math.floor(Date.now()/1000))return {ok:false,reason:"expired"}; return {ok:true};}
  catch{return {ok:false,reason:"bad payload"}}
}
async function sign(payload,env){
  const secret=env.AUTH_SECRET || env.AUTH_PIN;
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const sig=await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(payload));
  return b64urlBytes(new Uint8Array(sig));
}
function b64url(s){return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}
function b64urlBytes(bytes){let s=""; for(const b of bytes)s+=String.fromCharCode(b); return btoa(s).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"")}

async function schema(env){const db=getDB(env); if(!db.ok)return db.response; await createTables(db.value); return json({ok:true,version:VERSION,message:"D1 schema is ready",binding:"DB"});}
async function latest(env,url){
  const db=getDB(env); if(!db.ok)return db.response; await createTables(db.value);
  const limit=clamp(Number(url.searchParams.get("limit")||500),1,1000);
  const hours=Number(url.searchParams.get("hours")||0);
  const binds=[]; let where="";
  if(hours>0){where=`WHERE datetime(discovered_at) >= datetime('now', ?)`; binds.push(`-${hours} hours`);}
  const items=await db.value.prepare(`SELECT * FROM mega_links ${where} ORDER BY datetime(discovered_at) DESC, id DESC LIMIT ?`).bind(...binds,limit).all();
  const total=await db.value.prepare(`SELECT COUNT(*) AS count FROM mega_links ${where}`).bind(...binds).first();
  const last=await db.value.prepare(`SELECT created_at FROM scan_logs ORDER BY id DESC LIMIT 1`).first();
  return json({ok:true,version:VERSION,total:total?.count||0,items:items.results||[],lastScan:last?.created_at||"--"});
}
async function protectedList(env,url){
  const db=getDB(env); if(!db.ok)return db.response; await createTables(db.value);
  const limit=clamp(Number(url.searchParams.get("limit")||300),1,1000);
  const items=await db.value.prepare(`SELECT * FROM protected_sources ORDER BY datetime(discovered_at) DESC, id DESC LIMIT ?`).bind(limit).all();
  const total=await db.value.prepare(`SELECT COUNT(*) AS count FROM protected_sources`).first();
  return json({ok:true,version:VERSION,total:total?.count||0,items:items.results||[]});
}
async function search(request,env,ctx){
  const db=getDB(env); if(!db.ok)return db.response; await createTables(db.value);
  const body=await request.json().catch(()=>({}));
  const q=String(body.q||"").trim();
  const countries=Array.isArray(body.countries)&&body.countries.length?body.countries:["ALL"];
  const limitPages=clamp(Number(body.limitPages||80),20,120);

  const queries=buildQueries(q,countries);
  let pages=[];
  for(const query of queries){
    const [ddg,bing]=await Promise.allSettled([duckSearch(query),bingSearch(query)]);
    if(ddg.status==="fulfilled") pages.push(...ddg.value);
    if(bing.status==="fulfilled") pages.push(...bing.value);
    if(pages.length>=limitPages*3) break;
  }
  pages=dedupePages(pages);
  const directMega=pages.filter(p=>extractMega(p.url).length).slice(0,limitPages);
  const otherPages=pages.filter(p=>!extractMega(p.url).length).slice(0,limitPages);
  const unique=[...directMega,...otherPages].slice(0,limitPages);

  let megaFound=0,protectedFound=0,scanned=0,newLinks=0,seenLinks=0;
  for(const page of unique){
    const r=await inspectPage(page,q,db.value);
    scanned++; megaFound+=r.mega||0; protectedFound+=r.protected||0; newLinks+=r.newLinks||0; seenLinks+=r.seenLinks||0;
  }
  await db.value.prepare(`INSERT INTO scan_logs(query,regions,pages_scanned,mega_found,protected_found) VALUES(?,?,?,?,?)`)
    .bind(q||"auto",countries.join(","),scanned,megaFound,protectedFound).run();

  const items=await db.value.prepare(q?`SELECT * FROM mega_links WHERE query=? ORDER BY datetime(discovered_at) DESC, id DESC LIMIT 200`:`SELECT * FROM mega_links ORDER BY datetime(discovered_at) DESC, id DESC LIMIT 200`).bind(...(q?[q]:[])).all();
  const latestTotal=await db.value.prepare(`SELECT COUNT(*) AS count FROM mega_links`).first();
  const protectedTotal=await db.value.prepare(`SELECT COUNT(*) AS count FROM protected_sources`).first();
  return json({ok:true,version:VERSION,mode:"deep_public_discovery",query:q||"auto",countries,queries_used:queries.length,search_results_collected:pages.length,pages_scanned:scanned,mega_found:megaFound,protected_found:protectedFound,new_links:newLinks,seen_links:seenLinks,latest_total:latestTotal?.count||0,protected_total:protectedTotal?.count||0,scan_time:new Date().toISOString(),items:items.results||[],note:"Brave API is not used. Use AUTH_PIN for security."});
}
async function createTables(db){
  await db.prepare(`CREATE TABLE IF NOT EXISTS mega_links (id INTEGER PRIMARY KEY AUTOINCREMENT, mega_url TEXT UNIQUE NOT NULL, source_url TEXT, title TEXT, query TEXT, region TEXT, discovered_at TEXT DEFAULT CURRENT_TIMESTAMP, last_seen_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS protected_sources (id INTEGER PRIMARY KEY AUTOINCREMENT, source_url TEXT UNIQUE NOT NULL, title TEXT, reason TEXT, query TEXT, region TEXT, discovered_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS scan_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, query TEXT, regions TEXT, pages_scanned INTEGER DEFAULT 0, mega_found INTEGER DEFAULT 0, protected_found INTEGER DEFAULT 0, created_at TEXT DEFAULT CURRENT_TIMESTAMP)`).run();
}
function buildQueries(q,countries){
  const countryTerms={US:"USA OR United States",UK:"UK OR Britain",JP:"Japan",BR:"Brazil",DE:"Germany",FR:"France",RU:"Russia",IN:"India",KR:"Korea"};
  const geo=(countries||[]).includes("ALL")?[""]:[...(countries||[]).map(c=>countryTerms[c]).filter(Boolean),""];
  const bases=q?[`"${q}" "mega.nz/folder/"`,`"${q}" "mega.nz/file/"`,`"${q}" "mega.nz"`]:[`"mega.nz/folder/"`,`"mega.nz/file/"`,`"mega.nz" "rentry"`];
  const out=[];
  for(const g of geo.slice(0,6)){ for(const b of bases){out.push(g?`${b} ${g}`:b);} }
  for(const site of SOURCES){ if(q){out.push(`site:${site} "${q}" "mega.nz"`); out.push(`site:${site} "${q}" "mega.nz/folder/"`);} else {out.push(`site:${site} "mega.nz/folder/"`); out.push(`site:${site} "mega.nz/file/"`);} }
  out.push(`"mega.nz/folder/" "download"`);
  out.push(`"mega.nz/file/" "download"`);
  return [...new Set(out)].slice(0,45);
}
async function duckSearch(query){
  try{const res=await fetch("https://html.duckduckgo.com/html/?q="+encodeURIComponent(query),{headers:{"User-Agent":"Mozilla/5.0","Accept":"text/html"}}); const html=await res.text(); const out=[]; const re=/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gsi; let m; while((m=re.exec(html))!==null){const href=cleanDuckUrl(decodeHtml(m[1])); const title=stripTags(decodeHtml(m[2])); if(href&&href.startsWith("http")) out.push({url:href,title:title||"Search Result",query,engine:"duckduckgo"});} return out.slice(0,12);}catch{return[]}
}
async function bingSearch(query){
  try{const res=await fetch("https://www.bing.com/search?q="+encodeURIComponent(query)+"&count=20",{headers:{"User-Agent":"Mozilla/5.0","Accept":"text/html"}}); const html=await res.text(); const out=[]; const re=/<li class="b_algo"[\s\S]*?<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gsi; let m; while((m=re.exec(html))!==null){const href=decodeHtml(m[1]); const title=stripTags(decodeHtml(m[2])); if(href&&href.startsWith("http")) out.push({url:href,title:title||"Search Result",query,engine:"bing"});} return out.slice(0,12);}catch{return[]}
}
async function inspectPage(page,q,db){
  let mega=0,protectedCount=0,newLinks=0,seenLinks=0;
  const direct=extractMega(page.url);
  for(const link of direct){const saved=await saveMega(db,link,page.url,page.title,q); mega++; saved?newLinks++:seenLinks++;}
  let text="", status=0;
  try{
    const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),8000);
    const res=await fetch(page.url,{signal:controller.signal,headers:{"User-Agent":"Mozilla/5.0 NimbusCore","Accept":"text/html,text/plain,application/json,*/*"}});
    clearTimeout(timer); status=res.status; const type=res.headers.get("content-type")||"";
    if(type.includes("text")||type.includes("html")||type.includes("json")||type==="") text=(await res.text()).slice(0,900000);
    const links=extractMega(text);
    for(const link of links){const saved=await saveMega(db,link,page.url,page.title,q); mega++; saved?newLinks++:seenLinks++;}
    if(links.length===0 && direct.length===0 && (status===401||status===403||status===402||isProtected(text,page.url))){
      const saved=await saveProtected(db,page.url,page.title,reasonFrom(status,text),q); if(saved) protectedCount++;
    }
  }catch(e){
    if(direct.length===0){/* do not mark network failures as protected */}
  }
  return {mega,protected:protectedCount,newLinks,seenLinks};
}
async function saveMega(db,mega,source,title,q){const r=await db.prepare(`INSERT OR IGNORE INTO mega_links(mega_url,source_url,title,query,region) VALUES(?,?,?,?,?)`).bind(mega,source,title||"Search Result",q||"auto","global").run(); await db.prepare(`UPDATE mega_links SET last_seen_at=CURRENT_TIMESTAMP, source_url=COALESCE(source_url, ?), title=COALESCE(title, ?) WHERE mega_url=?`).bind(source,title||"Search Result",mega).run(); return (r.meta?.changes||0)>0;}
async function saveProtected(db,source,title,reason,q){const r=await db.prepare(`INSERT OR IGNORE INTO protected_sources(source_url,title,reason,query,region) VALUES(?,?,?,?,?)`).bind(source,title||"Protected Source",reason,q||"auto","global").run(); return (r.meta?.changes||0)>0;}
function extractMega(text){const matches=String(text||"").match(MEGA_RE)||[]; return [...new Set(matches.map(cleanMega).filter(isRealMega))];}
function cleanMega(x){return String(x).replace(/&amp;/g,"&").replace(/%23/g,"#").replace(/["'<>)\]}،؛\s]+$/g,"").trim();}
function isRealMega(x){const l=String(x||"").toLowerCase(); return (l.includes("mega.nz/file/")||l.includes("mega.nz/folder/")||l.includes("mega.nz/#!")||l.includes("mega.nz/#f!"))&&!/(example|xxxx|placeholder|demo|\.png|\.jpg|\.jpeg|\.webp|\.css|\.js|wordmark|logo)/i.test(l);}
function isProtected(text,url){const t=(String(text||"")+" "+url).toLowerCase(); return PROTECTED_HINTS.some(w=>t.includes(w));}
function reasonFrom(status,text){if(status===401)return"Login required"; if(status===403)return"Access forbidden"; if(status===402)return"Payment required"; const t=String(text||"").toLowerCase(); if(t.includes("captcha"))return"Captcha"; if(t.includes("credits"))return"Credits required"; if(t.includes("unlock"))return"Unlock required"; if(t.includes("subscribe")||t.includes("subscription"))return"Subscription required"; if(t.includes("login")||t.includes("sign in"))return"Login required"; return"Protected or restricted";}
function dedupePages(items){const seen=new Set(),out=[]; for(const item of items){try{const u=new URL(item.url); u.hash=""; const clean=u.href; if(!seen.has(clean)){seen.add(clean); item.url=clean; out.push(item);}}catch{}} return out;}
function cleanDuckUrl(href){try{href=href.replace(/&amp;/g,"&"); if(href.includes("/l/?")){const u=new URL("https://duckduckgo.com"+href); return decodeURIComponent(u.searchParams.get("uddg")||"");} return href;}catch{return""}}
function decodeHtml(x){return String(x).replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#x2F;/g,"/").replace(/&#39;/g,"'");}
function stripTags(x){return String(x).replace(/<[^>]+>/g,"").replace(/\s+/g," ").trim();}
function getDB(env){if(!env.DB) return {ok:false,response:json({ok:false,error:"D1 binding DB is missing"},500)}; return {ok:true,value:env.DB};}
function clamp(n,min,max){return Math.max(min,Math.min(max,Number.isFinite(n)?n:min));}
function json(data,status=200){return new Response(JSON.stringify(data,null,2),{status,headers:{"content-type":"application/json;charset=utf-8","cache-control":"no-store","access-control-allow-origin":"*"}});}
