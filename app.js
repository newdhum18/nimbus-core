(() => {
  const cfg = window.NIMBUS_CONFIG || { version: '31.0-hyper-extractor', apiBase: '' };
  const $ = (s) => document.querySelector(s);
  const out = $('#output') || $('#results') || null;
  const write = (data) => {
    if (!out) return;
    out.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  };
  async function api(path, options = {}) {
    const res = await fetch((cfg.apiBase || '') + path, {
      cache: 'no-store',
      headers: { 'content-type': 'application/json', ...(options.headers || {}) },
      ...options
    });
    const text = await res.text();
    try { return JSON.parse(text); } catch { return { ok: res.ok, status: res.status, text }; }
  }
  window.NimbusCore = {
    version: cfg.version,
    status: () => api('/api/status?nocache=' + Date.now()),
    autoscan: (body = {}) => api('/api/autoscan?nocache=' + Date.now(), { method: 'POST', body: JSON.stringify({ max_sources: 28, deep_rounds: 6, ...body }) }),
    search: (keyword, body = {}) => api('/api/search?nocache=' + Date.now(), { method: 'POST', body: JSON.stringify({ keyword, max_sources: 28, deep_rounds: 6, ...body }) }),
    reset: () => fetch('/reset?nocache=' + Date.now(), { cache: 'no-store' }).then(r => r.text())
  };
  document.addEventListener('DOMContentLoaded', () => {
    const v = $('#version');
    if (v) v.textContent = cfg.version;
    const bStatus = $('#btn-status');
    const bAuto = $('#btn-autoscan');
    const bSearch = $('#btn-search');
    if (bStatus) bStatus.onclick = async () => write(await window.NimbusCore.status());
    if (bAuto) bAuto.onclick = async () => write(await window.NimbusCore.autoscan({}));
    if (bSearch) bSearch.onclick = async () => {
      const kw = ($('#keyword') && $('#keyword').value) || '';
      write(await window.NimbusCore.search(kw, {}));
    };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js').catch(() => {});
    }
  });
})();
