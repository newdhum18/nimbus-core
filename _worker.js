const VERSION="0.7.0";
const MEGA_RE=/https?:\/\/(?:www\.)?mega\.nz\/(?:file|folder)\/[A-Za-z0-9_-]{6,}#[A-Za-z0-9_-]{8,}|https?:\/\/(?:www\.)?mega\.nz\/(?:#!|#F!)[A-Za-z0-9!_-]{12,}/gi;
const PROTECTED_HINTS=["login","sign in","signin","subscribe","subscription","unlock","credits","captcha","verification","register","premium","paywall","forbidden","access denied"];
const SOURCES=["rentry.co","pastebin.com","pastelink.net","paste.ee","justpaste.it","telegra.ph","gist.github.com","reddit.com","ofversedrops.com"];

export default {
  async fetch(request, env, ctx) {
    const url=new URL(request.url);
    try{
      if(url.pathname==="/api/ping") return json({ok:true,version:VERSION,db_bound:!!env.DB,message:env.DB?"DB binding found":"DB binding missing"});
      if(url.pathname==="/api/schema") return await schema(env);
      if(url.pathname==="/api/latest") return await latest(env,url);
      if(url.pathname==="/api/protected") return await protectedList(env,url);
      if(url.pathname==="/api/search" && request.method==="POST") return await search(request,env,ctx);
      if(url.pathname.startsWith("/api/")) return json({ok:false,error:"API route not found",path:url.pathname},404);
      if(env.ASSETS) return env.ASSETS.fetch(request);
      return new Response("Nimbus Core static assets are not available.",{status:404});
    }catch(err){
      return json({ok:false,error:"Worker exception handled",version:VERSION,message:err?.message||String(err),stack:err?.stack?String(err.stack).split("\n").slice(0,3).join("\n"):null},500);
    }
  }
};

async function schema(env){
  const db=getDB(env); if(!db.ok) return db.response;
  await createTables(db.value);
  return json({ok:true,version:VERSION,message:"D1 schema is ready",binding:"DB"});
}

async function latest(env,url){
  const db=getDB(env); if(!db.ok) return db.response;
  await createTables(db.value);
  const limit=clamp(Number(url.searchParams.get("limit")||200),1,500);
  const hours=Number(url.searchParams.get("hours")||0);
  const where=[];
  const binds=[];
  if(hours>0){
    where.push(`datetime(discovered_at) >= datetime('now', ?)`);
    binds.push(`-${hours} hours`);
  }
  const whereSql=where.length?`WHERE ${where.join(" AND ")}`:"";
  const items=await db.value.prepare(`SELECT * FROM mega_links ${whereSql} ORDER BY datetime(discovered_at) DESC, id DESC LIMIT ?`).bind(...binds,limit).all();
  const totalRow=await db.value.prepare(`SELECT COUNT(*) AS count FROM mega_links ${whereSql}`).bind(...binds).first();
  const last=await db.value.prepare(`SELECT created_at FROM scan_logs ORDER BY id DESC LIMIT 1`).first();
  return json({ok:true,version:VERSION,total:totalRow?.count||0,items:items.results||[],lastScan:last?.created_at||"--"});
}

async function protectedList(env,url){
  const db=getDB(env); if(!db.ok) return db.response;
  await createTables(db.value);
  const limit=clamp(Number(url.searchParams.get("limit")||200),1,500);
  const items=await db.value.prepare(`SELECT * FROM protected_sources ORDER BY datetime(discovered_at) DESC, id DESC LIMIT ?`).bind(limit).all();
  const totalRow=await db.value.prepare(`SELECT COUNT(*) AS count FROM protected_sources`).first();
  return json({ok:true,version:VERSION,total:totalRow?.count||0,items:items.results||[]});
}

async function search(request,env,ctx){
  const db=getDB(env); if(!db.ok) return db.response;
  await createTables(db.value);

  const body=await request.json().catch(()=>({}));
  const q=String(body.q||"").trim();
  const countries=Array.isArray(body.countries)&&body.countries.length?body.countries:["US","UK","JP","BR"];
  const limitPages=clamp(Number(body.limitPages||40),8,70);

  const queries=buildQueries(q,countries);
  const pages=[];
  for(const query of queries){
    const found=await duckSearch(query);
    pages.push(...found);
    if(pages.length>=limitPages*2) break;
  }

  const unique=dedupePages(pages).slice(0,limitPages);
  let megaFound=0, protectedFound=0, scanned=0, newLinks=0, seenLinks=0;

  for(const page of unique){
    const r=await inspectPage(page,q,db.value);
    scanned++;
    megaFound+=r.mega||0;
    protectedFound+=r.protected||0;
    newLinks+=r.newLinks||0;
    seenLinks+=r.seenLinks||0;
  }

  await db.value.prepare(`INSERT INTO scan_logs(query,regions,pages_scanned,mega_found,protected_found) VALUES(?,?,?,?,?)`)
    .bind(q||"auto",countries.join(","),scanned,megaFound,protectedFound).run();

  const latestItems=await db.value.prepare(
    q ? `SELECT * FROM mega_links WHERE query=? ORDER BY datetime(discovered_at) DESC, id DESC LIMIT 100`
      : `SELECT * FROM mega_links ORDER BY datetime(discovered_at) DESC, id DESC LIMIT 100`
  ).bind(...(q?[q]:[])).all();

  const latestTotal=await db.value.prepare(`SELECT COUNT(*) AS count FROM mega_links`).first();
  const protectedTotal=await db.value.prepare(`SELECT COUNT(*) AS count FROM protected_sources`).first();

  return json({
    ok:true,
    version:VERSION,
    mode:"free_public_discovery",
    query:q||"auto",
    countries,
    pages_scanned:scanned,
    mega_found:megaFound,
    protected_found:protectedFound,
    new_links:newLinks,
    seen_links:seenLinks,
    latest_total:latestTotal?.count||0,
    protected_total:protectedTotal?.count||0,
    scan_time:new Date().toISOString(),
    items:latestItems.results||[],
    note:"Brave API is not used in this version."
  });
}

async function createTables(db){
  await db.prepare(`CREATE TABLE IF NOT EXISTS mega_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    mega_url TEXT UNIQUE NOT NULL,
    source_url TEXT,
    title TEXT,
    query TEXT,
    region TEXT,
    discovered_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_seen_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS protected_sources (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_url TEXT UNIQUE NOT NULL,
    title TEXT,
    reason TEXT,
    query TEXT,
    region TEXT,
    discovered_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS scan_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    query TEXT,
    regions TEXT,
    pages_scanned INTEGER DEFAULT 0,
    mega_found INTEGER DEFAULT 0,
    protected_found INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )`).run();
}

function buildQueries(q,countries){
  const base=[];
  if(q){
    base.push(`"${q}" "mega.nz/folder/"`);
    base.push(`"${q}" "mega.nz/file/"`);
    base.push(`"${q}" "mega.nz"`);
    for(const site of SOURCES){
      base.push(`site:${site} "${q}" "mega.nz"`);
    }
  }else{
    base.push(`"mega.nz/folder/" "rentry.co"`);
    base.push(`"mega.nz/file/" "rentry.co"`);
    base.push(`"mega.nz/folder/"`);
    base.push(`"mega.nz/file/"`);
    for(const site of SOURCES){
      base.push(`site:${site} "mega.nz/folder/"`);
      base.push(`site:${site} "mega.nz/file/"`);
    }
  }

  const countryBoosts=(countries||[]).map(c=>{
    const map={US:"",UK:"UK",JP:"Japan",BR:"Brazil",DE:"Germany"};
    return map[c]||"";
  }).filter(Boolean);

  const withCountries=[];
  for(const b of base.slice(0,14)){
    withCountries.push(b);
    for(const c of countryBoosts.slice(0,2)){
      withCountries.push(`${b} ${c}`);
    }
  }
  return [...new Set(withCountries)].slice(0,28);
}

async function duckSearch(query){
  try{
    const endpoint="https://html.duckduckgo.com/html/?q="+encodeURIComponent(query);
    const res=await fetch(endpoint,{headers:{"User-Agent":"Mozilla/5.0","Accept":"text/html"}});
    const html=await res.text();
    const out=[];
    const re=/<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gsi;
    let m;
    while((m=re.exec(html))!==null){
      const href=cleanDuckUrl(decodeHtml(m[1]));
      const title=stripTags(decodeHtml(m[2]));
      if(href&&href.startsWith("http")) out.push({url:href,title:title||"Search Result",query});
    }
    return out.slice(0,8);
  }catch{
    return [];
  }
}

async function inspectPage(page,q,db){
  let mega=0, protectedCount=0, newLinks=0, seenLinks=0;

  const direct=extractMega(page.url);
  for(const link of direct){
    const saved=await saveMega(db,link,page.url,page.title,q);
    mega++;
    saved?newLinks++:seenLinks++;
  }

  try{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),7500);
    const res=await fetch(page.url,{
      signal:controller.signal,
      headers:{"User-Agent":"Mozilla/5.0 NimbusCore","Accept":"text/html,text/plain,application/json,*/*"}
    });
    clearTimeout(timer);

    const type=res.headers.get("content-type")||"";
    const status=res.status;
    let text="";
    if(type.includes("text")||type.includes("html")||type.includes("json")||type===""){
      text=(await res.text()).slice(0,650000);
    }

    if(status===401||status===403||status===402||isProtected(text,page.url)){
      const saved=await saveProtected(db,page.url,page.title,reasonFrom(status,text),q);
      if(saved) protectedCount++;
    }

    const links=extractMega(text);
    for(const link of links){
      const saved=await saveMega(db,link,page.url,page.title,q);
      mega++;
      saved?newLinks++:seenLinks++;
    }
  }catch(e){
    // Network failures are ignored; source may block server-side fetching.
  }

  return {mega,protected:protectedCount,newLinks,seenLinks};
}

async function saveMega(db,mega,source,title,q){
  const r=await db.prepare(`INSERT OR IGNORE INTO mega_links(mega_url,source_url,title,query,region) VALUES(?,?,?,?,?)`)
    .bind(mega,source,title||"Search Result",q||"auto","multi").run();
  await db.prepare(`UPDATE mega_links SET last_seen_at=CURRENT_TIMESTAMP WHERE mega_url=?`).bind(mega).run();
  return (r.meta?.changes||0)>0;
}

async function saveProtected(db,source,title,reason,q){
  const r=await db.prepare(`INSERT OR IGNORE INTO protected_sources(source_url,title,reason,query,region) VALUES(?,?,?,?,?)`)
    .bind(source,title||"Protected Source",reason,q||"auto","multi").run();
  return (r.meta?.changes||0)>0;
}

function extractMega(text){
  const matches=String(text||"").match(MEGA_RE)||[];
  return [...new Set(matches.map(cleanMega).filter(isRealMega))];
}
function cleanMega(x){return String(x).replace(/&amp;/g,"&").replace(/%23/g,"#").replace(/["'<>)\]}،؛\s]+$/g,"").trim();}
function isRealMega(x){
  const l=String(x||"").toLowerCase();
  return (l.includes("mega.nz/file/")||l.includes("mega.nz/folder/")||l.includes("mega.nz/#!")||l.includes("mega.nz/#f!")) &&
    !/(example|xxxx|placeholder|demo|\.png|\.jpg|\.jpeg|\.webp|\.css|\.js|wordmark|logo)/i.test(l);
}
function isProtected(text,url){
  const t=(String(text||"")+" "+url).toLowerCase();
  return PROTECTED_HINTS.some(w=>t.includes(w));
}
function reasonFrom(status,text){
  if(status===401)return"Login required";
  if(status===403)return"Access forbidden";
  if(status===402)return"Payment required";
  const t=String(text||"").toLowerCase();
  if(t.includes("captcha"))return"Captcha";
  if(t.includes("credits"))return"Credits required";
  if(t.includes("unlock"))return"Unlock required";
  if(t.includes("subscribe")||t.includes("subscription"))return"Subscription required";
  if(t.includes("login")||t.includes("sign in"))return"Login required";
  return"Protected or restricted";
}
function dedupePages(items){
  const seen=new Set(),out=[];
  for(const item of items){
    try{
      const u=new URL(item.url);
      u.hash="";
      const clean=u.href;
      if(!seen.has(clean)){
        seen.add(clean);
        item.url=clean;
        out.push(item);
      }
    }catch{}
  }
  return out;
}
function cleanDuckUrl(href){
  try{
    href=href.replace(/&amp;/g,"&");
    if(href.includes("/l/?")){
      const u=new URL("https://duckduckgo.com"+href);
      return decodeURIComponent(u.searchParams.get("uddg")||"");
    }
    return href;
  }catch{return""}
}
function decodeHtml(x){return String(x).replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#x2F;/g,"/").replace(/&#39;/g,"'");}
function stripTags(x){return String(x).replace(/<[^>]+>/g,"").replace(/\s+/g," ").trim();}
function getDB(env){
  if(!env.DB) return {ok:false,response:json({ok:false,error:"D1 binding DB is missing",fix:"Create D1 database and bind it as DB"},500)};
  return {ok:true,value:env.DB};
}
function clamp(n,min,max){return Math.max(min,Math.min(max,Number.isFinite(n)?n:min));}
function json(data,status=200){
  return new Response(JSON.stringify(data,null,2),{
    status,
    headers:{
      "content-type":"application/json;charset=utf-8",
      "cache-control":"no-store",
      "access-control-allow-origin":"*"
    }
  });
}
