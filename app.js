const $ = (id) => document.getElementById(id);
let session = localStorage.getItem('nimbus_session') || '';
function log(msg, data){ const line = `[${new Date().toLocaleTimeString()}] ${msg}${data ? ' ' + JSON.stringify(data, null, 2) : ''}`; $('log').textContent = line + '\n' + $('log').textContent; }
async function api(path, opts={}){
  const headers = {'content-type':'application/json', ...(opts.headers||{})};
  if(session) headers['x-nimbus-session'] = session;
  const res = await fetch(path, {...opts, headers});
  const ct = res.headers.get('content-type')||'';
  if(!ct.includes('application/json')) return res;
  const data = await res.json();
  if(!res.ok) throw new Error(data.error || res.statusText);
  return data;
}
function showApp(){ $('loginCard').classList.add('hidden'); $('app').classList.remove('hidden'); refreshAll(); }
function statCard(label, value){ return `<div class="stat card"><span>${label}</span><strong>${value ?? 0}</strong></div>`; }
async function refreshStats(){
  try{
    const r = await api('/api/stats'); const s=r.stats||{};
    $('statsGrid').innerHTML = [
      statCard('Sources', s.sources), statCard('Pages', s.pages), statCard('Links', s.links), statCard('Alive', s.alive), statCard('Dead', s.dead), statCard('Unknown', s.unknown), statCard('Queue Pending', s.queue_pending), statCard('Cache', s.cache)
    ].join('');
  }catch(e){ log('Stats failed', e.message); }
}
function row(r){
  const cls = r.health==='alive'?'ok':r.health==='dead'?'bad':'warn';
  return `<div class="result"><div><a href="${r.url}" target="_blank" rel="noopener">${r.url}</a><div class="meta">${r.type||''} · score ${r.score||0} · ${r.source_id||''} · ${r.last_seen||''}</div></div><span class="badge ${cls}">${r.health}</span></div>`;
}
async function refreshResults(){
  const h = $('healthFilter').value; const q = encodeURIComponent($('resultSearch').value||'');
  const r = await api(`/api/results?limit=100&health=${encodeURIComponent(h)}&q=${q}`);
  $('results').innerHTML = (r.results||[]).map(row).join('') || '<div class="empty">No results yet.</div>';
}
async function refreshSources(){
  const r = await api('/api/sources');
  $('sourcesList').innerHTML = (r.sources||[]).map(s=>`<div class="mini"><b>${s.name}</b><span>${s.type} · priority ${s.priority} · ${s.enabled?'enabled':'disabled'}</span></div>`).join('');
}
async function refreshAll(){ await refreshStats(); await refreshResults(); await refreshSources(); }
async function action(label, fn){
  try{ log(label + '...'); const r = await fn(); log(label + ' done', r); await refreshAll(); return r; }
  catch(e){ log(label + ' failed', e.message); alert(e.message); }
}
$('loginBtn').onclick = async()=> action('Login', async()=>{ const r=await api('/api/login',{method:'POST',body:JSON.stringify({pin:$('pin').value})}); session=r.token; localStorage.setItem('nimbus_session', session); showApp(); return r; });
$('checkDbBtn').onclick = ()=>action('Check DB', ()=>api('/api/check-db'));
$('repairDbBtn').onclick = ()=>action('Repair DB', ()=>api('/api/repair-db'));
$('diagBtn').onclick = ()=>action('Diagnostics', ()=>api('/api/diagnostics'));
$('cleanBtn').onclick = ()=>action('Clean Data', ()=>api('/api/clean-data'));
$('scanBtn').onclick = ()=>action('Start Scan', ()=>api('/api/scan',{method:'POST',body:JSON.stringify({query:$('query').value||'mega.nz'})}));
$('autoBtn').onclick = ()=>action('AutoScan', ()=>api('/api/autoscan'));
$('extractBtn').onclick = ()=>action('Extract URL', ()=>api('/api/extract-url',{method:'POST',body:JSON.stringify({url:$('extractUrl').value})}));
$('processBtn').onclick = ()=>action('Process Queue', ()=>api('/api/process-queue?limit=40'));
$('healthBtn').onclick = ()=>action('Check Batch', ()=>api('/api/check-batch?limit=30'));
$('addSourceBtn').onclick = ()=>action('Add Source', ()=>api('/api/sources',{method:'POST',body:JSON.stringify({name:$('srcName').value,type:$('srcType').value,url_template:$('srcTemplate').value,priority:Number($('srcPriority').value||50),enabled:true})}));
$('resetQueueBtn').onclick = ()=>action('Reset Queue', ()=>api('/api/reset-queue'));
$('resetCacheBtn').onclick = ()=>action('Reset Cache', ()=>api('/api/reset-cache'));
$('resetCursorBtn').onclick = ()=>action('Reset Cursor', ()=>api('/api/reset-cursor'));
$('refreshBtn').onclick = ()=>refreshAll();
$('healthFilter').onchange = refreshResults; $('resultSearch').oninput = ()=>setTimeout(refreshResults,150);
$('exportCsvBtn').onclick = ()=>{ window.open('/api/export?format=csv','_blank'); };
$('exportJsonBtn').onclick = ()=>{ window.open('/api/export?format=json','_blank'); };
(async()=>{
  try{ const v=await api('/api/version'); $('apiStatus').textContent='API ' + v.version; }
  catch{ $('apiStatus').textContent='API offline'; }
  if(session) showApp();
  if('serviceWorker' in navigator) navigator.serviceWorker.register('/service-worker.js').catch(()=>{});
})();
