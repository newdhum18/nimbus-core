const CFG = window.NIMBUS_CONFIG || { apiBase:'', version:'27' };
const $ = id => document.getElementById(id);
let token = localStorage.getItem('nimbus_token') || '';
let archiveOffset = 0;
let archiveFilter = '';

init();
function init(){ bind(); if('serviceWorker' in navigator) navigator.serviceWorker.register('/service-worker.js?v=30').catch(()=>{}); show(token?'appView':'loginView'); if(token){ ping(); loadDashboard(); } }
function bind(){
  $('loginBtn').onclick=login;
  document.querySelectorAll('.tabs button').forEach(b=>b.onclick=()=>openPage(b.dataset.page));
  $('scanBtn').onclick=()=>runScan(false); $('moreBtn').onclick=()=>runScan(true); $('resetCursorBtn').onclick=resetCursor;
  $('manualBtn').onclick=manualSearch; $('archiveFilterBtn').onclick=()=>{archiveOffset=0;archiveFilter=$('archiveFilter').value.trim();loadArchive(false)}; $('archiveMoreBtn').onclick=()=>loadArchive(true);
  $('sourcesBtn').onclick=loadSources; $('pingBtn').onclick=ping; $('dbBtn').onclick=checkDb; $('diagBtn').onclick=diagnostics; $('cleanBtn').onclick=cleanOld;
  $('clearCacheBtn').onclick=clearCache; $('fullResetBtn').onclick=()=>location.href='/reset?v=30&fresh=1'; $('logoutBtn').onclick=logout;
  $('exportJsonBtn').onclick=()=>downloadExport('json'); $('exportCsvBtn').onclick=()=>downloadExport('csv'); $('verifyLinksBtn').onclick=verifyLinks;
}
function show(id){ $('loginView').classList.toggle('hidden',id!=='loginView'); $('appView').classList.toggle('hidden',id!=='appView'); }
function logout(){ localStorage.removeItem('nimbus_token'); token=''; show('loginView'); }
function openPage(page){ document.querySelectorAll('.tabs button').forEach(b=>b.classList.toggle('active',b.dataset.page===page)); document.querySelectorAll('.page').forEach(p=>p.classList.remove('active')); $('page-'+page).classList.add('active'); if(page==='dashboard')loadDashboard(); if(page==='archive'){archiveOffset=0;loadArchive(false)} if(page==='sources')loadSources(); }
async function api(path, opts={}){ const headers={'content-type':'application/json'}; if(token) headers.authorization='Bearer '+token; let res,text,data; try{ res=await fetch(CFG.apiBase+path,{...opts,headers:{...headers,...(opts.headers||{})},cache:'no-store'}); text=await res.text(); }catch(e){ return {ok:false,error:'network_error',message:e.message}; } try{data=JSON.parse(text)}catch{data={ok:false,error:'non_json_response',status:res?.status,body:String(text).slice(0,1200)}} if(['invalid_token','expired_token','missing_token'].includes(data.error)){logout()} return data; }
async function login(){ $('loginOut').textContent='Checking...'; const d=await api('/api/login',{method:'POST',body:JSON.stringify({pin:$('pinInput').value})}); $('loginOut').textContent=pretty(d); if(d.ok&&d.token){token=d.token;localStorage.setItem('nimbus_token',token);show('appView');loadDashboard();} }
async function ping(){ const d=await api('/api/ping'); $('settingsOut').textContent=pretty(d); }
async function checkDb(){ const d=await api('/api/schema'); $('settingsOut').textContent=pretty(d); message('settingsOut', d.ok?'DB OK':'DB check failed'); if(d.counts) updateCounts(d.counts); }
async function diagnostics(){ const d=await api('/api/diagnostics'); $('settingsOut').textContent=pretty(d); if(d.counts) updateCounts(d.counts); }
async function cleanOld(){ const d=await api('/api/cleanup',{method:'POST',body:'{}'}); $('settingsOut').textContent=pretty(d); if(d.counts) updateCounts(d.counts); }
async function loadDashboard(){ const d=await api('/api/latest?limit=12'); if(d.ok){updateCounts(d.counts);renderLinks($('latestList'),d.items||[])} }
async function runScan(more){ $('scanMessage').className='notice show'; $('scanMessage').textContent='Scanning...'; $('scanOut').textContent=''; $('scanList').className='list empty'; $('scanList').textContent='Scanning...'; $('scanSummary').innerHTML=''; const d=await api('/api/search',{method:'POST',body:JSON.stringify({mode:'auto',continueScan:!!more,batchSize:18})}); $('scanOut').textContent=pretty(d); if(d.ok){ $('scanMessage').textContent=`Auto Scan finished: ${d.summary?.links_found||0} links found, ${d.summary?.new_links||0} new.`; renderSummary(d.summary); renderLinks($('scanList'),d.saved||[]); loadDashboard(); } else { $('scanMessage').textContent=d.message||d.error||'Scan failed'; $('scanList').className='list empty'; $('scanList').textContent=d.message||d.error||'Scan failed'; } }
async function resetCursor(){ const d=await api('/api/reset-cursor',{method:'POST',body:'{}'}); $('scanOut').textContent=pretty(d); }
async function manualSearch(){ const q=$('manualInput').value.trim(); if(!q){$('manualMessage').className='notice show';$('manualMessage').textContent='Enter search text.';return} $('manualMessage').className='notice show'; $('manualMessage').textContent='Searching...'; $('manualOut').textContent=''; $('manualList').className='list empty'; $('manualList').textContent='Searching...'; const d=await api('/api/search',{method:'POST',body:JSON.stringify({mode:'manual',query:q})}); $('manualOut').textContent=pretty(d); if(d.ok){$('manualMessage').textContent=`Manual search finished: ${d.links_found||0} links found, ${d.new_links||0} new.`; renderLinks($('manualList'),d.saved||[]); loadDashboard();} else {$('manualMessage').textContent=d.message||d.error||'Manual search failed'; $('manualList').textContent=d.message||d.error||'Manual search failed';} }
async function loadArchive(more){ if(!more) archiveOffset=0; const d=await api(`/api/archive?limit=30&offset=${archiveOffset}&q=${encodeURIComponent(archiveFilter)}`); if(d.ok){renderLinks($('archiveList'),d.items||[],true,more);archiveOffset=d.next_offset||archiveOffset+30;} }

async function verifyLinks(){
  $('verifyMessage').className='notice show';
  $('verifyMessage').textContent='Health Bot checking MEGA links without downloading files...';
  $('verifyOut').textContent='';
  const d=await api('/api/verify-links',{method:'POST',body:JSON.stringify({limit:40,onlyUnchecked:false})});
  $('verifyOut').textContent=pretty(d);
  if(d.ok){ $('verifyMessage').textContent=`Health Bot finished: ${d.checked||0} checked, ${d.live||0} live/probably live, ${d.not_live||0} unavailable.`; loadArchive(false); loadDashboard(); }
  else $('verifyMessage').textContent=d.message||d.error||'Health Bot failed';
}

async function loadSources(){ const d=await api('/api/manual-sources?limit=80'); if(d.ok) renderSources(d.items||[]); else $('sourcesList').textContent=pretty(d); }
function updateCounts(c={}){ $('countMega').textContent=c.mega_links??0; $('countManual').textContent=c.manual_sources??0; }
function renderSummary(s){ if(!s)return; $('scanSummary').innerHTML=Object.entries(s).filter(([k])=>k!=='errors').map(([k,v])=>`<div><b>${esc(v)}</b><br><span>${esc(k.replaceAll('_',' '))}</span></div>`).join(''); }
function healthBadge(item){ const s=String(item.health_status||'unverified'); let cls='unknown', icon='⚪', label='Not checked'; if(['live','probably_live'].includes(s)){cls='ok';icon='✅';label=s==='live'?'Verified live':'Probably live'} else if(['unavailable','reported_removed','invalid'].includes(s)){cls='bad';icon='❌';label=s==='reported_removed'?'Removed / reported':'Unavailable'} return `<span class="pill health ${cls}">${icon} ${esc(label)}</span>`; }
function renderLinks(el,items,del=false,append=false){ if(!append)el.innerHTML=''; el.className='list'; if(!items.length&&!append){el.className='list empty';el.textContent='No links found in this batch.';return} for(const item of items){ const div=document.createElement('article'); div.className='item'; const h=healthBadge(item); div.innerHTML=`<a href="${attr(item.mega_url)}" target="_blank" rel="noopener noreferrer">${esc(item.mega_url||'')}</a><div class="meta">${h}<span class="pill">${esc(item.confidence??'')}</span>${esc(item.confidence_reason||'public-indexed-result')}</div><div class="meta health-reason">${esc(item.health_reason||'')}</div><div class="meta">Source: <a href="${attr(item.source_url||'')}" target="_blank" rel="noopener noreferrer">${esc(item.source_domain||item.source_url||'')}</a></div>${del?'<button class="danger">Delete</button>':''}`; if(del) div.querySelector('button').onclick=async()=>{await api('/api/delete-link',{method:'POST',body:JSON.stringify({id:item.id,mega_url:item.mega_url})});div.remove();loadDashboard();}; el.appendChild(div); } }
function renderSources(items){ const el=$('sourcesList'); el.innerHTML=''; el.className='list'; if(!items.length){el.className='list empty';el.textContent='No manual sources.';return} for(const item of items){ const div=document.createElement('article'); div.className='item'; div.innerHTML=`<a href="${attr(item.url)}" target="_blank" rel="noopener noreferrer">${esc(item.url)}</a><div class="meta"><span class="pill">${esc(item.reason||'manual_review')}</span>${esc(item.domain||'')}</div>`; el.appendChild(div); } }
async function clearCache(){ const lines=[]; try{if('serviceWorker'in navigator){const regs=await navigator.serviceWorker.getRegistrations();for(const r of regs){await r.unregister();lines.push('Service worker removed')}}}catch(e){lines.push('SW '+e.message)} try{if(window.caches){const keys=await caches.keys();for(const k of keys){await caches.delete(k);lines.push('Cache deleted: '+k)}}}catch(e){lines.push('Cache '+e.message)} $('settingsOut').textContent=lines.concat(['Reopen: /?v=30&fresh=1']).join('\n'); }
async function downloadExport(format){ const res=await fetch(`/api/export?format=${format}`,{headers:{authorization:'Bearer '+token},cache:'no-store'}); const blob=await res.blob(); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`nimbus-core-v30-export.${format==='csv'?'csv':'json'}`; document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1500); }
function pretty(x){return JSON.stringify(x,null,2)} function esc(s){return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))} function attr(s){return esc(s||'#')} function message(){ }
