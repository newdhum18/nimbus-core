const $ = (id) => document.getElementById(id);
const tokenKey = 'nimbus_v27_token';
let token = localStorage.getItem(tokenKey) || '';
function headers() { return token ? { 'content-type': 'application/json', 'authorization': 'Bearer ' + token } : { 'content-type': 'application/json' }; }
async function api(path, body) { const res = await fetch(path, { method: body ? 'POST' : 'GET', headers: headers(), body: body ? JSON.stringify(body) : undefined }); return res.json(); }
function show(id, data) { $(id).textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2); }
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function healthBadge(s){return `<span class="badge ${esc(s||'unknown')}">${esc((s||'unknown').toUpperCase())}</span>`;}
async function init(){
  bindTabs(); bindButtons();
  const p = await api('/api/ping').catch(()=>({ok:false})); $('status').textContent = p.ok ? 'Online' : 'Offline';
  if(token){ $('loginPanel').classList.add('hidden'); $('app').classList.remove('hidden'); await refreshAll(); }
}
function bindTabs(){document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tabs button,.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');$(b.dataset.tab).classList.add('active');});}
function bindButtons(){
  $('loginBtn').onclick=async()=>{const r=await api('/api/login',{pin:$('pin').value});show('loginOut',r); if(r.ok){token=r.token;localStorage.setItem(tokenKey,token);$('loginPanel').classList.add('hidden');$('app').classList.remove('hidden');refreshAll();}};
  $('autoScanFullBtn').onclick=async()=>{const r=await api('/api/autoscan',{query:$('query').value,cycles:4,perCycle:25});show('scanOut',r);refreshAll();};
  $('autoScanBtn').onclick=async()=>{const r=await api('/api/search',{query:$('query').value,processLimit:20});show('scanOut',r);refreshAll();};
  $('processBtn').onclick=async()=>{const r=await api('/api/process-queue?limit=30');show('scanOut',r);refreshAll();};
  $('extractBtn').onclick=async()=>{const r=await api('/api/extract-url',{url:$('targetUrl').value});show('extractOut',r);refreshAll();};
  $('healthOneBtn').onclick=async()=>{const r=await api('/api/health-check',{mega_url:$('megaUrl').value,processLimit:5});show('healthOut',r);refreshAll();};
  $('healthBatchBtn').onclick=async()=>{const r=await api('/api/health-check',{limit:100,processLimit:30});show('healthOut',r);refreshAll();};
  $('queueRefreshBtn').onclick=loadQueue; $('queueProcessBtn').onclick=async()=>{show('settingsOut',await api('/api/process-queue?limit=40'));refreshAll();};
  $('archiveBtn').onclick=loadArchive; $('pagesBtn').onclick=loadPages; $('sourcesBtn').onclick=loadSources;
  $('saveSourceBtn').onclick=async()=>{show('settingsOut',await api('/api/upsert-source',{name:$('srcName').value,type:$('srcType').value,endpoint:$('srcEndpoint').value,enabled:1}));loadSources();};
  $('exportJsonBtn').onclick=()=>downloadExport('json'); $('exportCsvBtn').onclick=()=>downloadExport('csv');
  $('pingBtn').onclick=async()=>show('settingsOut',await api('/api/ping')); $('schemaBtn').onclick=async()=>{show('settingsOut',await api('/api/schema'));refreshAll();}; $('diagBtn').onclick=async()=>show('settingsOut',await api('/api/diagnostics'));
  $('cleanupBtn').onclick=async()=>{show('settingsOut',await api('/api/cleanup'));refreshAll();}; $('resetBtn').onclick=async()=>show('settingsOut',await api('/api/reset-cursor'));
  $('logoutBtn').onclick=()=>{localStorage.removeItem(tokenKey);location.reload();};
}
async function refreshAll(){await loadStats();await loadLatest();}
async function loadStats(){const r=await api('/api/stats'); show('statsOut',r); const c=r.counts||{}; $('cLinks').textContent=c.mega_links||0; $('cAlive').textContent=c.alive_links||0; $('cDead').textContent=c.dead_links||0; $('cUnknown').textContent=c.unknown_links||0; $('cPages').textContent=c.pages||0; $('cQueue').textContent=c.queue_queued||0;}
async function loadLatest(){const r=await api('/api/latest?limit=15'); $('latestList').innerHTML = (r.items||[]).map(linkCard).join('') || '<p class="muted">No links yet.</p>';}
async function downloadExport(format){ const r=await fetch('/api/export?format='+format,{headers:{authorization:'Bearer '+token}}); const blob=await r.blob(); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='nimbus-core-v27-export.'+format; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),1500);}
function linkCard(x){return `<div class="item"><div>${healthBadge(x.health_status)} <b>${esc(x.link_type||'link')}</b> <span class="muted">score ${esc(x.confidence||0)}</span></div><a href="${esc(x.mega_url)}" target="_blank" rel="noreferrer">${esc(x.mega_url)}</a><small>${esc(x.source_domain||'')} · ${esc(x.title||'')}</small></div>`;}
async function loadQueue(){const r=await api('/api/queue?limit=120'); $('queueList').innerHTML=(r.items||[]).map(x=>`<div class="item"><b>#${x.id} ${esc(x.task_type)}</b> <span class="badge">${esc(x.status)}</span><small>priority ${x.priority} · attempts ${x.attempts}/${x.max_attempts}</small><code>${esc(x.payload)}</code>${x.last_error?`<small class="err">${esc(x.last_error)}</small>`:''}</div>`).join('')||'<p class="muted">No queue.</p>';}
async function loadArchive(){const q=encodeURIComponent($('archiveQ').value||'');const h=encodeURIComponent($('healthFilter').value||'');const r=await api(`/api/archive?limit=80&q=${q}&health=${h}`);$('archiveList').innerHTML=(r.items||[]).map(linkCard).join('')||'<p class="muted">No archive.</p>';}
async function loadPages(){const r=await api('/api/pages?limit=120');$('pagesList').innerHTML=(r.items||[]).map(x=>`<div class="item"><b>${esc(x.status)}</b> <a href="${esc(x.url)}" target="_blank">${esc(x.url)}</a><small>${esc(x.domain)} · depth ${x.depth} · links ${x.links_found||0} · child pages ${x.pages_found||0}</small>${x.error?`<small class="err">${esc(x.error)}</small>`:''}</div>`).join('')||'<p class="muted">No pages.</p>';}
async function loadSources(){const r=await api('/api/sources');$('sourcesList').innerHTML=(r.items||[]).map(x=>`<div class="item"><b>${esc(x.name)}</b> <span class="badge">${esc(x.type)}</span><small>${esc(x.endpoint)}</small><small>${esc(x.note||'')}</small></div>`).join('')||'<p class="muted">No sources.</p>';}
init();
