let currentView = "latest";
const storeKey = "nimbus_core_v2_items";
const sessionKey = "nimbus_core_unlocked";

function $(id){ return document.getElementById(id); }
function nowISO(){ return new Date().toISOString(); }
function loadItems(){ return JSON.parse(localStorage.getItem(storeKey) || "[]"); }
function saveItems(items){ localStorage.setItem(storeKey, JSON.stringify(items)); render(); }

function unlock(){
  const pin = $("pin").value.trim();
  if(pin === NIMBUS_CONFIG.temporaryPin){
    sessionStorage.setItem(sessionKey, "1");
    $("login").classList.add("hidden");
    render();
  } else alert("Wrong PIN");
}
function lock(){ sessionStorage.removeItem(sessionKey); $("login").classList.remove("hidden"); }

function setView(view){
  currentView = view;
  document.querySelectorAll(".view").forEach(x=>x.classList.add("hidden"));
  $(view).classList.remove("hidden");
  document.querySelectorAll(".tab[data-view]").forEach(x=>x.classList.toggle("active", x.dataset.view===view));
  render();
}

function addDemo(){
  const items = loadItems();
  items.unshift({
    id: crypto.randomUUID(), type:"public", title:"Sample Public Result", source:"rentry.co", region:"US", discoveredAt:nowISO(), status:"new",
    link:"https://mega.nz/folder/example#demo", sourceUrl:"https://rentry.co/example"
  });
  items.unshift({
    id: crypto.randomUUID(), type:"protected", title:"Sample Protected Source", source:"example.com", reason:"login_required", discoveredAt:nowISO(), status:"new",
    sourceUrl:"https://example.com/protected"
  });
  saveItems(items);
}

function scanNow(){
  const q = $("query").value.trim();
  if(!q){ alert("Enter keyword first"); return; }
  const items = loadItems();
  items.unshift({
    id: crypto.randomUUID(), type:"protected", title:`Manual scan queued: ${q}`, source:"Brave API pending", reason:"backend_not_connected_yet", discoveredAt:nowISO(), status:"new", sourceUrl:"#"
  });
  saveItems(items);
  setView("latest");
  alert("V2 saved this search locally. V3 will connect this button to Brave API + D1 database.");
}

function archive(id){ const items = loadItems().map(x=>x.id===id?{...x,status:"archived"}:x); saveItems(items); }
function copyText(t){ navigator.clipboard?.writeText(t); alert("Copied"); }

function itemCard(x){
  const isProtected = x.type === "protected";
  const tag = isProtected ? `<span class="tag lock">Protected</span>` : `<span class="tag">Public</span>`;
  const reason = isProtected ? `<div class="meta">Reason: ${x.reason || "unknown"}</div>` : `<div class="meta">Region: ${x.region || "unknown"}</div>`;
  const linkLine = x.link ? `<div class="meta">${x.link}</div>` : "";
  const megaBtn = x.link ? `<a class="mini green" href="${x.link}" target="_blank" rel="noopener">Open</a><button class="mini" onclick="copyText('${x.link.replaceAll("'","%27")}')">Copy</button>` : "";
  const srcBtn = x.sourceUrl && x.sourceUrl !== "#" ? `<a class="mini" href="${x.sourceUrl}" target="_blank" rel="noopener">Source</a>` : "";
  return `<div class="item">${tag}<h3>${x.title}</h3><div class="meta">Source: ${x.source || "unknown"}</div>${reason}<div class="meta">Discovered: ${new Date(x.discoveredAt).toLocaleString()}</div>${linkLine}<div class="actions">${megaBtn}${srcBtn}<button class="mini" onclick="archive('${x.id}')">Archive</button></div></div>`;
}

function render(){
  const items = loadItems();
  const today = new Date().toDateString();
  $("todayCount").textContent = items.filter(x=>new Date(x.discoveredAt).toDateString()===today && x.status!=="archived").length;
  $("weekCount").textContent = items.filter(x=>Date.now()-new Date(x.discoveredAt).getTime()<7*24*3600*1000 && x.status!=="archived").length;
  $("protectedCount").textContent = items.filter(x=>x.type==="protected" && x.status!=="archived").length;
  $("archiveCount").textContent = items.filter(x=>x.status==="archived").length;

  const latest = items.filter(x=>x.status!=="archived" && x.type!=="protected");
  const prot = items.filter(x=>x.status!=="archived" && x.type==="protected");
  const arch = items.filter(x=>x.status==="archived");
  $("latestList").innerHTML = latest.length ? latest.map(itemCard).join("") : `<p>No public discoveries yet.</p>`;
  $("protectedList").innerHTML = prot.length ? prot.map(itemCard).join("") : `<p>No protected sources yet.</p>`;
  $("archiveList").innerHTML = arch.length ? arch.map(itemCard).join("") : `<p>Archive is empty.</p>`;
}

if(sessionStorage.getItem(sessionKey)==="1") $("login").classList.add("hidden");
if("serviceWorker" in navigator){ navigator.serviceWorker.register("service-worker.js").catch(()=>{}); }
render();
