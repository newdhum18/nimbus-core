const $=(id)=>document.getElementById(id);

function init(){
  if(localStorage.getItem("nc_session")==="ok") showDashboard();
  $("loginBtn").addEventListener("click",login);
  $("logoutBtn").addEventListener("click",logout);
  $("autoScanBtn").addEventListener("click",()=>runScan(""));
  $("scanBtn").addEventListener("click",()=>runScan($("keywordInput").value.trim()));
  $("schemaBtn").addEventListener("click",checkSchema);
  document.querySelectorAll(".tab").forEach(btn=>btn.addEventListener("click",()=>switchTab(btn.dataset.tab)));
  loadLatest();
  loadProtected();
  if(localStorage.getItem("nc_session")==="ok" && APP_CONFIG.autoScanOnOpen){
    setTimeout(()=>runScan("", true), 900);
  }
  if("serviceWorker" in navigator){navigator.serviceWorker.register("service-worker.js").catch(()=>{});}
}

function login(){
  const pin=$("pinInput").value.trim();
  if(pin===APP_CONFIG.localPin){localStorage.setItem("nc_session","ok");showDashboard();loadLatest();loadProtected();setTimeout(()=>runScan("", true),900);}
  else alert("PIN غير صحيح");
}
function logout(){localStorage.removeItem("nc_session");$("dashboardScreen").classList.remove("active");$("lockScreen").classList.add("active");}
function showDashboard(){$("lockScreen").classList.remove("active");$("dashboardScreen").classList.add("active");}
function switchTab(name){document.querySelectorAll(".tab").forEach(t=>t.classList.toggle("active",t.dataset.tab===name));document.querySelectorAll(".panel").forEach(p=>p.classList.toggle("active",p.id===name));}

async function api(path, opts={}){
  const res=await fetch(path, opts);
  const data=await res.json().catch(()=>({error:"Invalid JSON"}));
  if(!res.ok) throw data;
  return data;
}

async function loadLatest(){
  try{
    const data=await api("/api/latest");
    $("todayCount").textContent=data.items?.length||0;
    $("lastScan").textContent=data.lastScan||"--";
    renderLatest(data.items||[]);
  }catch(e){
    renderLatest([]);
    $("latestList").innerHTML=`<p class="muted">لم يتم تحميل قاعدة البيانات. تأكد من ربط D1 باسم DB ثم افتح /api/schema.</p>`;
  }
}

async function loadProtected(){
  try{
    const data=await api("/api/protected");
    $("protectedCount").textContent=data.items?.length||0;
    renderProtected(data.items||[]);
  }catch(e){renderProtected([]);}
}

async function checkSchema(){
  $("settingsOutput").textContent="Checking...";
  try{
    const data=await api("/api/schema");
    $("settingsOutput").textContent=JSON.stringify(data,null,2);
    await loadLatest(); await loadProtected();
  }catch(e){$("settingsOutput").textContent=JSON.stringify(e,null,2);}
}

async function runScan(keyword="", quiet=false){
  if(!quiet) $("scanOutput").textContent="Scanning...";
  try{
    const countries=[...document.querySelectorAll(".chips input:checked")].map(x=>x.value);
    const data=await api("/api/search",{
      method:"POST",
      headers:{"content-type":"application/json"},
      body:JSON.stringify({q:keyword,countries})
    });
    if(!quiet) $("scanOutput").textContent=JSON.stringify(data,null,2);
    await loadLatest(); await loadProtected();
  }catch(e){
    if(!quiet) $("scanOutput").textContent=JSON.stringify(e,null,2);
  }
}

function renderLatest(items){
  const box=$("latestList");
  if(!items.length){box.innerHTML=`<p class="muted">لا توجد روابط محفوظة حتى الآن. اضغط Auto Scan Now أو Search Now.</p>`;return;}
  box.innerHTML="";
  items.forEach(item=>{
    const div=document.createElement("div");
    div.className="item";
    div.innerHTML=`
      <h3>${escapeHtml(item.title||"MEGA Link")}</h3>
      <small>Source: ${escapeHtml(item.source_url)}</small>
      <small>Discovered: ${escapeHtml(item.discovered_at)} | Query: ${escapeHtml(item.query||"auto")}</small>
      <pre>${escapeHtml(item.mega_url)}</pre>
      <div class="row">
        <a class="green" href="${item.mega_url}" target="_blank" rel="noopener">Open MEGA</a>
        <a href="${item.source_url}" target="_blank" rel="noopener">Open Source</a>
        <button>Copy</button>
      </div>`;
    div.querySelector("button").addEventListener("click",()=>copyText(item.mega_url));
    box.appendChild(div);
  });
}

function renderProtected(items){
  const box=$("protectedList");
  if(!items.length){box.innerHTML=`<p class="muted">لا توجد مصادر محمية محفوظة حتى الآن.</p>`;return;}
  box.innerHTML="";
  items.forEach(item=>{
    const div=document.createElement("div");
    div.className="item";
    div.innerHTML=`
      <h3>${escapeHtml(item.title||"Protected Source")}</h3>
      <small>Reason: ${escapeHtml(item.reason)}</small>
      <small>Discovered: ${escapeHtml(item.discovered_at)} | Query: ${escapeHtml(item.query||"auto")}</small>
      <pre>${escapeHtml(item.source_url)}</pre>
      <div class="row"><a class="red" href="${item.source_url}" target="_blank" rel="noopener">Open Source</a></div>`;
    box.appendChild(div);
  });
}

async function copyText(text){await navigator.clipboard.writeText(text);alert("تم النسخ");}
function escapeHtml(s){return String(s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}
init();
