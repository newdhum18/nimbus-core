const MEGA_RE=/https?:\/\/(?:www\.)?mega\.nz\/(?:file|folder)\/[A-Za-z0-9_-]{6,}#[A-Za-z0-9_-]{8,}|https?:\/\/(?:www\.)?mega\.nz\/(?:#!|#F!)[A-Za-z0-9!_-]{12,}/gi;
const PROTECTED_HINTS=["login","sign in","signin","subscribe","subscription","unlock","credits","captcha","verification","register","premium","paywall"];

const SOURCES=[
  "rentry.co","pastebin.com","pastelink.net","paste.ee","justpaste.it",
  "telegra.ph","gist.github.com","reddit.com","ofversedrops.com"
];

export default {
  async fetch(request, env, ctx){
    const url=new URL(request.url);
    if(url.pathname==="/api/schema") return schema(env);
    if(url.pathname==="/api/latest") return latest(env);
    if(url.pathname==="/api/protected") return protectedList(env);
    if(url.pathname==="/api/search" && request.method==="POST") return search(request, env, ctx);
    if(url.pathname.startsWith("/api/")) return json({error:"Not found"},404);
    return env.ASSETS.fetch(request);
  }
};

async function schema(env){
  const db=mustDB(env);
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
  return json({ok:true,message:"D1 schema is ready"});
}

async function latest(env){
  const db=mustDB(env);
  await safeSchema(db);
  const rs=await db.prepare(`SELECT * FROM mega_links ORDER BY discovered_at DESC LIMIT 100`).all();
  const last=await db.prepare(`SELECT created_at FROM scan_logs ORDER BY id DESC LIMIT 1`).first();
  return json({items:rs.results||[],lastScan:last?.created_at||"--"});
}

async function protectedList(env){
  const db=mustDB(env);
  await safeSchema(db);
  const rs=await db.prepare(`SELECT * FROM protected_sources ORDER BY discovered_at DESC LIMIT 100`).all();
  return json({items:rs.results||[]});
}

async function search(request, env, ctx){
  const db=mustDB(env);
  await safeSchema(db);
  const body=await request.json().catch(()=>({}));
  const q=(body.q||"").trim();
  const countries=Array.isArray(body.countries)&&body.countries.length?body.countries:["US","UK","JP","BR"];

  const queries=buildQueries(q);
  const pages=[];
  for(const query of queries){
    const found=await duckSearch(query);
    pages.push(...found);
  }

  const unique=dedupePages(pages).slice(0,24);
  let megaFound=0, protectedFound=0;

  const settled=await Promise.allSettled(unique.map(p=>inspectPage(p,q,db)));
  for(const s of settled){
    if(s.status==="fulfilled"){
      megaFound+=s.value.mega||0;
      protectedFound+=s.value.protected||0;
    }
  }

  await db.prepare(`INSERT INTO scan_logs(query,regions,pages_scanned,mega_found,protected_found) VALUES(?,?,?,?,?)`)
    .bind(q||"auto", countries.join(","), unique.length, megaFound, protectedFound).run();

  return json({
    ok:true,
    mode:"free_public_discovery",
    query:q||"auto",
    pages_scanned:unique.length,
    mega_found:megaFound,
    protected_found:protectedFound,
    note:"Brave API is not used in this version."
  });
}

function buildQueries(q){
  const terms=q? [`"${q}" "mega.nz"`, `${q} "mega.nz/folder/"`, `${q} "mega.nz/file/"`] : [
    `"mega.nz/folder/"`,
    `"mega.nz/file/"`,
    `"mega.nz" "rentry.co"`,
    `"mega.nz" "pastebin"`
  ];
  const list=[...terms];
  for(const site of SOURCES){
    if(q){
      list.push(`site:${site} "${q}" "mega.nz"`);
      list.push(`site:${site} "${q}" "mega.nz/folder/"`);
    }else{
      list.push(`site:${site} "mega.nz/folder/"`);
      list.push(`site:${site} "mega.nz/file/"`);
    }
  }
  return list.slice(0,18);
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
    return out.slice(0,6);
  }catch{return []}
}

async function inspectPage(page, q, db){
  let mega=0, protectedCount=0;
  const direct=extractMega(page.url);
  if(direct.length){
    for(const link of direct){ await saveMega(db, link, page.url, page.title, q); mega++; }
    return {mega,protected:0};
  }

  try{
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),8000);
    const res=await fetch(page.url,{signal:controller.signal,headers:{"User-Agent":"Mozilla/5.0 NimbusCore","Accept":"text/html,text/plain,application/json,*/*"}});
    clearTimeout(timer);

    const type=res.headers.get("content-type")||"";
    const status=res.status;
    const text= type.includes("text")||type.includes("html")||type.includes("json") ? await res.text() : "";

    if(status===401||status===403||status===402||isProtected(text,page.url)){
      await saveProtected(db,page.url,page.title,reasonFrom(status,text),q);
      protectedCount++;
    }

    const links=extractMega(text);
    for(const link of links){ await saveMega(db, link, page.url, page.title, q); mega++; }
    return {mega,protected:protectedCount};
  }catch(e){
    return {mega:0,protected:0};
  }
}

function extractMega(text){
  const matches=String(text||"").match(MEGA_RE)||[];
  return [...new Set(matches.map(cleanMega).filter(isRealMega))];
}
function cleanMega(x){return String(x).replace(/&amp;/g,"&").replace(/%23/g,"#").replace(/["'<>)\]}،؛\s]+$/g,"").trim()}
function isRealMega(x){const l=x.toLowerCase();return (l.includes("mega.nz/file/")||l.includes("mega.nz/folder/")||l.includes("mega.nz/#!")||l.includes("mega.nz/#f!"))&&!/(example|xxxx|placeholder|demo|\.png|\.jpg|\.css|\.js)/i.test(l)}
function isProtected(text,url){const t=(String(text||"")+" "+url).toLowerCase();return PROTECTED_HINTS.some(w=>t.includes(w))}
function reasonFrom(status,text){if(status===401)return"Login required";if(status===403)return"Access forbidden";if(status===402)return"Payment required";const t=String(text||"").toLowerCase();if(t.includes("captcha"))return"Captcha";if(t.includes("credits"))return"Credits required";if(t.includes("unlock"))return"Unlock required";if(t.includes("subscribe"))return"Subscription required";if(t.includes("login")||t.includes("sign in"))return"Login required";return"Protected or restricted"}
async function saveMega(db,mega,source,title,q){await db.prepare(`INSERT OR IGNORE INTO mega_links(mega_url,source_url,title,query,region) VALUES(?,?,?,?,?)`).bind(mega,source,title||"Search Result",q||"auto","multi").run();await db.prepare(`UPDATE mega_links SET last_seen_at=CURRENT_TIMESTAMP WHERE mega_url=?`).bind(mega).run()}
async function saveProtected(db,source,title,reason,q){await db.prepare(`INSERT OR IGNORE INTO protected_sources(source_url,title,reason,query,region) VALUES(?,?,?,?,?)`).bind(source,title||"Protected Source",reason,q||"auto","multi").run()}
function dedupePages(items){const seen=new Set(),out=[];for(const item of items){try{const u=new URL(item.url);u.hash="";const clean=u.href;if(!seen.has(clean)){seen.add(clean);item.url=clean;out.push(item)}}catch{}}return out}
function cleanDuckUrl(href){try{href=href.replace(/&amp;/g,"&");if(href.includes("/l/?")){const u=new URL("https://duckduckgo.com"+href);return decodeURIComponent(u.searchParams.get("uddg")||"")}return href}catch{return""}}
function decodeHtml(x){return String(x).replace(/&amp;/g,"&").replace(/&quot;/g,'"').replace(/&#x2F;/g,"/").replace(/&#39;/g,"'")}
function stripTags(x){return String(x).replace(/<[^>]+>/g,"").trim()}
async function safeSchema(db){try{await db.prepare(`SELECT 1 FROM mega_links LIMIT 1`).first()}catch{await schema({DB:db})}}
function mustDB(env){if(!env.DB) throw new Response(JSON.stringify({error:"D1 binding DB is missing. Create D1 database and bind it as DB."}),{status:500,headers:{"content-type":"application/json"}});return env.DB}
function json(data,status=200){return new Response(JSON.stringify(data,null,2),{status,headers:{"content-type":"application/json;charset=utf-8","access-control-allow-origin":"*"}})}
