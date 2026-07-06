const $=(id)=>document.getElementById(id);
let latestOffset=0, archiveOffset=0, manualOffset=0, archiveFilterText="";
const pageSize=APP_CONFIG.pageSize||30;

function init(){
  bindUI();
  restoreSession();
  if("serviceWorker" in navigator){navigator.serviceWorker.register("service-worker.js?v=15").catch(()=>{});}
}
function bindUI(){
  $("loginForm").addEventListener("submit",e=>{e.preventDefault();login();});
  $("logoutBtn").addEventListener("click",logout);
  $("refreshBtn").addEventListener("click",()=>{latestOffset=0;loadLatest(false);});
  $("autoScanBtn").addEventListener("click",()=>runScan("",{source:"auto"}));
  $("moreLatestBtn").addEventListener("click",()=>runScan("",{source:"more-latest"}));
  $("scanBtn").addEventListener("click",()=>runScan($("keywordInput").value.trim(),{source:"manual"}));
  $("moreSearchBtn").addEventListener("click",()=>runScan($("keywordInput").value.trim(),{source:"more-search"}));
  $("refreshManualBtn").addEventListener("click",()=>{manualOffset=0;loadManual(false);});
  $("moreManualBtn").addEventListener("click",()=>loadManual(true));
  $("archiveRefreshBtn").addEventListener("click",()=>{archiveOffset=0;loadArchive(false);});
  $("moreArchiveBtn").addEventListener("click",()=>loadArchive(true));
  $("archiveFilter").addEventListener("input",()=>{archiveFilterText=$("archiveFilter").value.trim(); archiveOffset=0; loadArchive(false);});
  $("pingBtn").addEventListener("click",pingApi);
  $("schemaBtn").addEventListener("click",checkSchema);
  $("cleanupBtn").addEventListener("click",cleanupOldData);
  $("clearCacheBtn").addEventListener("click",clearAppCache);
  document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>switchTab(btn.dataset.tab)));
}
async function restoreSession(){const token=localStorage.getItem("nc_token");if(!token)return;try{await api("/api/session");showDashboard();bootLoad();}catch{localStorage.removeItem("nc_token");}}
async function login(){const pin=$("pinInput").value.trim();if(!pin){toast("اكتب الرمز السري");return;}try{const data=await rawApi("/api/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({pin})});localStorage.setItem("nc_token",data.token);$("pinInput").value="";showDashboard();bootLoad();toast("تم الدخول");}catch(e){toast("رمز غير صحيح أو AUTH_PIN غير مضاف");}}
function logout(){localStorage.removeItem("nc_token");$("dashboardScreen").classList.remove("active");$("lockScreen").classList.add("active");}
function showDashboard(){$("lockScreen").classList.remove("active");$("dashboardScreen").classList.add("active");}
async function bootLoad(){latestOffset=0;manualOffset=0;await Promise.allSettled([loadLatest(false),loadManual(false)]);}
function switchTab(name){
  document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t.dataset.tab===name));
  document.querySelectorAll(".panel").forEach(p=>p.classList.toggle("active",p.id===name));
  if(name==="latest"){latestOffset=0;loadLatest(false);}
  if(name==="manual"){manualOffset=0;loadManual(false);}
  if(name==="archive"){archiveOffset=0;loadArchive(false);}
}
function authHeaders(extra={}){const t=localStorage.getItem("nc_token");return Object.assign({"authorization":`Bearer ${t||""}`},extra);}
async function rawApi(path,opts={}){
  opts.headers=Object.assign({},opts.headers||{},path.startsWith("/api/login")?{}:authHeaders());
  const res=await fetch(path,{...opts,cache:"no-store"});
  const text=await res.text();
  let data; try{data=JSON.parse(text);}catch{throw{ok:false,error:"Invalid JSON",status:res.status,body:text.slice(0,1000)}}
  if(!res.ok||data.ok===false)throw data; return data;
}
async function api(path,opts={}){opts.headers=Object.assign({},opts.headers||{},authHeaders(opts.headers||{}));return rawApi(path,opts);}
async function loadLatest(append){
  setStatus("تحميل النتائج...");
  const box=$("latestList");
  try{
    const p=new URLSearchParams({limit:pageSize,offset:latestOffset});
    const data=await api("/api/latest?"+p.toString());
    $("latestCount").textContent=data.total??0;
    $("lastScan").textContent=formatDate(data.lastScan);
    renderLinks(data.items||[],box,append);
    if((data.items||[]).length) latestOffset += (data.items||[]).length;
    setStatus(`تم تحميل ${data.items?.length||0} نتيجة`);
  }catch(e){box.innerHTML=emptyState("لم يتم تحميل النتائج. تحقق من تسجيل الدخول و DB.");setStatus("خطأ");console.error(e);}
}
async function loadArchive(append){
  const box=$("archiveList");
  if(!append) box.innerHTML=emptyState("جاري تحميل الأرشيف...");
  try{
    const p=new URLSearchParams({limit:pageSize,offset:archiveOffset});
    if(archiveFilterText) p.set("q",archiveFilterText);
    const data=await api("/api/archive?"+p.toString());
    renderLinks(data.items||[],box,append);
    if((data.items||[]).length) archiveOffset += (data.items||[]).length;
  }catch(e){box.innerHTML=emptyState("تعذر تحميل الأرشيف.");}
}
async function loadManual(append){
  const box=$("manualList");
  try{
    const p=new URLSearchParams({limit:pageSize,offset:manualOffset});
    const data=await api("/api/manual-sources?"+p.toString());
    $("manualCount").textContent=data.total??0;
    renderManual(data.items||[],box,append);
    if((data.items||[]).length) manualOffset += (data.items||[]).length;
  }catch(e){box.innerHTML=emptyState("لم يتم تحميل المصادر اليدوية.");console.error(e);}
}
async function runScan(keyword="",opts={}){
  const isManual=opts.source==="manual"||opts.source==="more-search";
  const target=isManual?$("searchResults"):$("latestList");
  const summary=$("scanSummary");
  target.classList.add("loading");
  if(isManual){summary.classList.remove("hidden");summary.textContent="Scanning MEGA URL shapes...";if(opts.source==="manual")target.innerHTML="";}else toast("بدأ فحص روابط MEGA فقط...");
  try{
    const data=await api("/api/search",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({keyword:keyword,limitPages:180,more:opts.source.includes("more")})});
    const txt=[
      `OK: ${data.ok}`,
      `Version: ${data.version}`,
      `Mode: ${data.mode}`,
      `Keyword mode: ${data.keyword_mode}`,
      `Batch cursor: ${data.batch_cursor}`,
      `Patterns used: ${data.patterns_used}`,
      `Engines: ${data.engines_used?.join(", ")}`,
      `Search results: ${data.search_results_collected}`,
      `Pages scanned: ${data.pages_scanned}`,
      `MEGA found: ${data.mega_found}`,
      `New links: ${data.new_links}`,
      `Seen/duplicates: ${data.seen_links}`,
      `Manual sources: ${data.manual_sources_found}`
    ].join("\n");
    if(isManual){
      summary.textContent=txt;
      renderLinks(data.items||[],target,opts.source==="more-search");
    }else{
      toast(`تم الفحص: ${data.new_links} جديد / ${data.seen_links} مكرر`);
      latestOffset=0;
      await loadLatest(false);
    }
    manualOffset=0; await loadManual(false);
    $("latestCount").textContent=data.latest_total??$("latestCount").textContent;
    $("manualCount").textContent=data.manual_total??$("manualCount").textContent;
    $("lastScan").textContent=formatDate(data.scan_time||new Date().toISOString());
    setStatus("آخر فحص مكتمل");
  }catch(e){if(isManual)summary.textContent=JSON.stringify(e,null,2);else toast("فشل الفحص");setStatus("خطأ في الفحص");console.error(e);}
  finally{target.classList.remove("loading");}
}
async function deleteLink(id,card){
  if(!confirm("حذف هذا الرابط من الأرشيف؟")) return;
  try{await api("/api/delete-link",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({id})}); card.remove(); toast("تم الحذف"); latestOffset=0; await loadLatest(false);}
  catch(e){toast("تعذر الحذف");}
}
async function cleanupOldData(){const out=$("settingsOutput");out.textContent="Cleaning old labels and stale rows...";try{const data=await api("/api/cleanup",{method:"POST"});out.textContent=JSON.stringify(data,null,2);toast("تم تنظيف البيانات القديمة");latestOffset=0;archiveOffset=0;manualOffset=0;await bootLoad();}catch(e){out.textContent=JSON.stringify(e,null,2);toast("تعذر التنظيف");}}
async function pingApi(){const out=$("settingsOutput");out.textContent="Checking API...";try{const data=await api("/api/ping");out.textContent=JSON.stringify(data,null,2);toast("API يعمل");}catch(e){out.textContent=JSON.stringify(e,null,2);}}
async function checkSchema(){const out=$("settingsOutput");out.textContent="Checking DB schema...";try{const data=await api("/api/schema");out.textContent=JSON.stringify(data,null,2);toast("DB جاهزة");await bootLoad();}catch(e){out.textContent=JSON.stringify(e,null,2);}}
async function clearAppCache(){try{if("caches"in window){const keys=await caches.keys();await Promise.all(keys.map(k=>caches.delete(k)));}if("serviceWorker"in navigator){const regs=await navigator.serviceWorker.getRegistrations();await Promise.all(regs.map(r=>r.unregister()));}toast("تم تنظيف الكاش، سيتم إعادة التحميل");setTimeout(()=>location.href=location.pathname+"?v=15&fresh="+Date.now(),800);}catch(e){toast("تعذر تنظيف الكاش");}}
function renderLinks(items,box,append){
  if(!append) box.innerHTML="";
  if(!items.length && !append){box.innerHTML=emptyState("لا توجد نتائج. اضغط Auto Scan أو More.");return;}
  for(const item of items){
    const card=document.createElement("article");card.className="resultCard";
    card.innerHTML=`<h3>${escapeHtml(item.title||"MEGA Link")}</h3>
    <div class="confidence">⭐ Confidence ${Number(item.confidence||50)}% — ${escapeHtml(item.confidence_reason||"MEGA URL pattern")}</div>
    <div class="meta">Source: ${escapeHtml(item.source_url||"")}</div>
    <div class="meta">First seen: ${formatDate(item.discovered_at)} | Last seen: ${formatDate(item.last_seen_at)}</div>
    <div class="linkBox">${escapeHtml(item.mega_url||"")}</div>
    <div class="cardActions"><a class="mega" href="${safeHref(item.mega_url)}" target="_blank" rel="noopener">Open MEGA</a><a href="${safeHref(item.source_url)}" target="_blank" rel="noopener">Open Source</a><button type="button" class="copyBtn">Copy</button><button type="button" class="danger delBtn">Delete</button></div>`;
    card.querySelector(".copyBtn").addEventListener("click",()=>copyText(item.mega_url));
    card.querySelector(".delBtn").addEventListener("click",()=>deleteLink(item.id,card));
    box.appendChild(card);
  }
}
function renderManual(items,box,append){
  if(!append) box.innerHTML="";
  if(!items.length && !append){box.innerHTML=emptyState("لا توجد مصادر تحتاج فتح يدوي.");return;}
  for(const item of items){
    const card=document.createElement("article");card.className="resultCard";
    card.innerHTML=`<h3>${escapeHtml(item.title||"Manual Source")}</h3><div class="meta">Reason: ${escapeHtml(item.reason||"Manual review")}</div><div class="meta">Discovered: ${formatDate(item.discovered_at)}</div><div class="linkBox">${escapeHtml(item.source_url||"")}</div><div class="cardActions"><a class="danger" href="${safeHref(item.source_url)}" target="_blank" rel="noopener">Open Source</a></div>`;
    box.appendChild(card);
  }
}
function emptyState(text){return `<div class="empty">${escapeHtml(text)}</div>`}
async function copyText(text){await navigator.clipboard.writeText(text||"");toast("تم النسخ");}
function setStatus(text){$("subStatus").textContent=text;}
function toast(text){const el=$("toast");el.textContent=text;el.classList.add("show");clearTimeout(window.__toastTimer);window.__toastTimer=setTimeout(()=>el.classList.remove("show"),2200);}
function formatDate(value){if(!value||value==="--")return"--";const d=new Date(value);if(isNaN(d.getTime()))return String(value);return d.toLocaleString("sv-SE").replace("T"," ");}
function escapeHtml(s){return String(s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}
function safeHref(url){const s=String(url||"");return(s.startsWith("http://")||s.startsWith("https://"))?s:"#";}
init();
