const $=(id)=>document.getElementById(id);
let currentHours=APP_CONFIG.defaultHours || 24;
let lastSearchQuery="";

function init(){
  bindUI();
  if(localStorage.getItem("nc_session")==="ok") {
    showDashboard();
    bootLoad();
  }
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("service-worker.js").catch(()=>{});
  }
}

function bindUI(){
  $("loginBtn").addEventListener("click",login);
  $("pinInput").addEventListener("keydown",(e)=>{if(e.key==="Enter") login();});
  $("logoutBtn").addEventListener("click",logout);
  $("refreshBtn").addEventListener("click",()=>loadLatest());
  $("autoScanBtn").addEventListener("click",()=>runScan("", {source:"auto"}));
  $("scanBtn").addEventListener("click",()=>runScan($("keywordInput").value.trim(), {source:"manual"}));
  $("refreshProtectedBtn").addEventListener("click",()=>loadProtected());
  $("pingBtn").addEventListener("click",pingApi);
  $("schemaBtn").addEventListener("click",checkSchema);

  document.querySelectorAll(".tab").forEach(btn=>{
    btn.addEventListener("click",()=>switchTab(btn.dataset.tab));
  });

  document.querySelectorAll(".range").forEach(btn=>{
    btn.addEventListener("click",()=>{
      document.querySelectorAll(".range").forEach(x=>x.classList.remove("active"));
      btn.classList.add("active");
      currentHours=Number(btn.dataset.hours||0);
      loadLatest();
    });
  });
}

async function bootLoad(){
  await Promise.allSettled([loadLatest(), loadProtected()]);
}

function login(){
  const pin=$("pinInput").value.trim();
  if(pin===APP_CONFIG.localPin){
    localStorage.setItem("nc_session","ok");
    showDashboard();
    bootLoad();
  }else{
    toast("PIN غير صحيح");
  }
}

function logout(){
  localStorage.removeItem("nc_session");
  $("dashboardScreen").classList.remove("active");
  $("lockScreen").classList.add("active");
  $("pinInput").value="";
}

function showDashboard(){
  $("lockScreen").classList.remove("active");
  $("dashboardScreen").classList.add("active");
}

function switchTab(name){
  document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t.dataset.tab===name));
  document.querySelectorAll(".panel").forEach(p=>p.classList.toggle("active",p.id===name));
  if(name==="latest") loadLatest();
  if(name==="protected") loadProtected();
}

async function api(path, opts={}){
  const res=await fetch(path, opts);
  const text=await res.text();
  let data;
  try{ data=JSON.parse(text); }
  catch{
    throw {ok:false,error:"Invalid JSON from server",status:res.status,body:text.slice(0,800)};
  }
  if(!res.ok || data.ok===false) throw data;
  return data;
}

function selectedCountries(){
  return [...document.querySelectorAll(".chips input:checked")].map(x=>x.value);
}

async function loadLatest(){
  setStatus("تحميل النتائج...");
  const box=$("latestList");
  try{
    const params=new URLSearchParams();
    params.set("limit", APP_CONFIG.latestLimit || 200);
    if(currentHours>0) params.set("hours", currentHours);
    const data=await api("/api/latest?"+params.toString());
    $("latestCount").textContent=data.total ?? (data.items?.length||0);
    $("lastScan").textContent=formatDate(data.lastScan);
    renderLatest(data.items||[], box);
    setStatus(`تم تحميل ${data.items?.length||0} نتيجة`);
  }catch(e){
    box.innerHTML=emptyState("لم يتم تحميل النتائج. تأكد من /api/schema و Binding باسم DB.");
    setStatus("خطأ في تحميل النتائج");
    console.error(e);
  }
}

async function loadProtected(){
  const box=$("protectedList");
  try{
    const data=await api("/api/protected?limit=200");
    $("protectedCount").textContent=data.total ?? (data.items?.length||0);
    renderProtected(data.items||[], box);
  }catch(e){
    box.innerHTML=emptyState("لم يتم تحميل المصادر المحمية.");
    console.error(e);
  }
}

async function runScan(keyword="", opts={}){
  const isManual=opts.source==="manual";
  if(isManual && !keyword){
    toast("اكتب كلمة البحث أولاً");
    return;
  }

  lastSearchQuery=keyword;
  const countries=selectedCountries();
  const target=isManual ? $("searchResults") : $("latestList");
  const summary=$("scanSummary");

  target.classList.add("loading");
  if(isManual){
    summary.classList.remove("hidden");
    summary.textContent="Scanning...";
    target.innerHTML="";
  }else{
    toast("بدأ الفحص العام...");
  }

  try{
    const data=await api("/api/search",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({
        q:keyword,
        countries,
        limitPages: keyword ? 40 : 50
      })
    });

    if(isManual){
      summary.textContent=[
        `OK: ${data.ok}`,
        `Query: ${data.query}`,
        `Pages scanned: ${data.pages_scanned}`,
        `MEGA found: ${data.mega_found}`,
        `Protected found: ${data.protected_found}`,
        `New links: ${data.new_links}`,
        `Duplicates/seen: ${data.seen_links}`
      ].join("\n");
      renderLatest(data.items||[], target);
    }else{
      toast(`تم الفحص: ${data.mega_found} روابط، ${data.protected_found} محمية`);
      await loadLatest();
    }

    await loadProtected();
    $("latestCount").textContent=data.latest_total ?? $("latestCount").textContent;
    $("protectedCount").textContent=data.protected_total ?? $("protectedCount").textContent;
    $("lastScan").textContent=formatDate(data.scan_time || new Date().toISOString());
    setStatus("آخر فحص مكتمل");
  }catch(e){
    const msg=JSON.stringify(e,null,2);
    if(isManual){
      summary.textContent=msg;
    }else{
      toast("فشل الفحص");
      console.error(e);
    }
    setStatus("خطأ في الفحص");
  }finally{
    target.classList.remove("loading");
  }
}

async function pingApi(){
  const out=$("settingsOutput");
  out.textContent="Checking API...";
  try{
    const data=await api("/api/ping");
    out.textContent=JSON.stringify(data,null,2);
    toast("API يعمل");
  }catch(e){
    out.textContent=JSON.stringify(e,null,2);
  }
}

async function checkSchema(){
  const out=$("settingsOutput");
  out.textContent="Checking DB schema...";
  try{
    const data=await api("/api/schema");
    out.textContent=JSON.stringify(data,null,2);
    toast("DB جاهزة");
    await bootLoad();
  }catch(e){
    out.textContent=JSON.stringify(e,null,2);
  }
}

function renderLatest(items, box){
  if(!items.length){
    box.innerHTML=emptyState("لا توجد نتائج في هذا النطاق الزمني. جرّب آخر أسبوع أو اضغط Auto Scan.");
    return;
  }
  box.innerHTML="";
  for(const item of items){
    const card=document.createElement("article");
    card.className="resultCard";
    card.innerHTML=`
      <h3>${escapeHtml(item.title || "MEGA Link")}</h3>
      <div class="meta">Source: ${escapeHtml(item.source_url || "")}</div>
      <div class="meta">Discovered: ${formatDate(item.discovered_at)} | Query: ${escapeHtml(item.query || "auto")}</div>
      <div class="linkBox">${escapeHtml(item.mega_url || "")}</div>
      <div class="cardActions">
        <a class="mega" href="${safeHref(item.mega_url)}" target="_blank" rel="noopener">Open MEGA</a>
        <a href="${safeHref(item.source_url)}" target="_blank" rel="noopener">Open Source</a>
        <button type="button">Copy</button>
      </div>`;
    card.querySelector("button").addEventListener("click",()=>copyText(item.mega_url));
    box.appendChild(card);
  }
}

function renderProtected(items, box){
  if(!items.length){
    box.innerHTML=emptyState("لا توجد مصادر محمية محفوظة حتى الآن.");
    return;
  }
  box.innerHTML="";
  for(const item of items){
    const card=document.createElement("article");
    card.className="resultCard";
    card.innerHTML=`
      <h3>${escapeHtml(item.title || "Protected Source")}</h3>
      <div class="meta">Reason: ${escapeHtml(item.reason || "Protected")}</div>
      <div class="meta">Discovered: ${formatDate(item.discovered_at)} | Query: ${escapeHtml(item.query || "auto")}</div>
      <div class="linkBox">${escapeHtml(item.source_url || "")}</div>
      <div class="cardActions">
        <a class="protected" href="${safeHref(item.source_url)}" target="_blank" rel="noopener">Open Source</a>
      </div>`;
    box.appendChild(card);
  }
}

function emptyState(text){
  return `<div class="empty">${escapeHtml(text)}</div>`;
}

async function copyText(text){
  await navigator.clipboard.writeText(text || "");
  toast("تم النسخ");
}

function setStatus(text){
  $("subStatus").textContent=text;
}

function toast(text){
  const el=$("toast");
  el.textContent=text;
  el.classList.add("show");
  clearTimeout(window.__toastTimer);
  window.__toastTimer=setTimeout(()=>el.classList.remove("show"),2200);
}

function formatDate(value){
  if(!value || value==="--") return "--";
  const d=new Date(value);
  if(isNaN(d.getTime())) return String(value);
  return d.toLocaleString("sv-SE").replace("T"," ");
}

function escapeHtml(s){
  return String(s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
}

function safeHref(url){
  const s=String(url||"");
  if(s.startsWith("http://")||s.startsWith("https://")) return s;
  return "#";
}

init();
