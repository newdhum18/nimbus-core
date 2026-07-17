/**
 * Phase 13 autonomous source catalog.
 * Each entry represents a distinct public discovery surface or protocol,
 * not a synthetic repetition used only to inflate a source count.
 */
const S = (id,name,category,sourceType,templateUrl,priority,rankScore=0) => ({
  id,name,category,sourceType,templateUrl,
  enabled:true,defaultEnabled:true,priority,rankScore
});

const CATALOG = Object.freeze([
  // V37 research-verified direct evidence pages. They remain disabled until
  // sanitized fixture and controlled live-fetch validation are completed.
  {...S("v37_ulvis_verified","ULVIS Paste — verified direct evidence","paste","custom","https://paste.ulvis.net/xMc4Xjvf",1462,78),enabled:false,defaultEnabled:false},
  {...S("v37_pastebin_verified","Pastebin — verified direct evidence","paste","custom","https://pastebin.com/eEUnV3gF",1461,77),enabled:false,defaultEnabled:false},
  // Pastemode was reachable but exposed only a dynamic loading placeholder.
  // Keep it disabled as a browser-review candidate; no browser bypass exists.
  {...S("v37_pastemode_review","Pastemode — browser review candidate","paste","custom","https://pastemode.com/mCRPQ3bQ8O",250,-50),enabled:false,defaultEnabled:false},
  S("meawfy_api","Meawfy public index API","mega-index","json","https://meawfy.com/internal/api/results.json?q={q}",1500,100),
  S("meawfy_search","Meawfy public search","mega-index","html","https://meawfy.com/?s={q}",1490,90),
  S("ofversedrops_search","OfverseDrops public search","mega-index","ofversedrops","https://ofversedrops.com/?s={q}",1480,85),

  // PasteToday coverage is intentionally split into two honest surfaces:
  // 1) a deterministic direct validation note supplied for the isolated
  //    adapter test; 2) a separate public-search discovery surface.
  // This prevents a DuckDuckGo outage from being misdiagnosed as a
  // PasteToday extraction failure.
  S("pastetoday_direct","PasteToday direct validation","paste","pastetoday","https://pastetoday.com/wic5vif7en",1475,88),
  S("pastetoday_search","PasteToday public discovery","paste","pastetoday","https://lite.duckduckgo.com/lite/?q=site%3Apastetoday.com%20{q}%20%22mega.nz%2Ffolder%22",1465,82),
  S("ddg_pastetoday","DuckDuckGo alternate — PasteToday","paste","html","https://duckduckgo.com/html/?q=site%3Apastetoday.com%20{q}%20%22mega.nz%2Ffolder%22",1360,58),
  S("ddg_html_pastetoday","DuckDuckGo HTML — PasteToday","paste","html","https://html.duckduckgo.com/html/?q=site%3Apastetoday.com%20{q}%20%22mega.nz%2Ffolder%22",1350,56),
  S("wayback_cdx_pastetoday","Wayback CDX — PasteToday","archive","json","https://web.archive.org/cdx/search/cdx?url=pastetoday.com/*&output=json&filter=statuscode:200&filter=mimetype:text/html&fl=original,timestamp&collapse=urlkey&limit=100&from=2024",1340,54),

  S("reddit_search_json","Reddit public search JSON","comments","json","https://www.reddit.com/search.json?q=%22mega.nz%2Ffolder%22%20{q}&sort=new&limit=100&raw_json=1",1450,80),
  S("reddit_comments_json","Reddit comments search JSON","comments","json","https://www.reddit.com/search.json?q=%22mega.nz%2Ffolder%22%20{q}&type=comment&sort=new&limit=100&raw_json=1",1440,80),
  S("old_reddit_search","Old Reddit public search","comments","html","https://old.reddit.com/search?q=%22mega.nz%2Ffolder%22%20{q}&sort=new",1430,70),

  S("wayback_cdx_rentry","Wayback CDX — Rentry","archive","json","https://web.archive.org/cdx/search/cdx?url=rentry.co/*&output=json&filter=statuscode:200&filter=mimetype:text/html&fl=original,timestamp&collapse=urlkey&limit=100&from=2024",1400,65),
  S("wayback_cdx_pastebin","Wayback CDX — Pastebin","archive","json","https://web.archive.org/cdx/search/cdx?url=pastebin.com/*&output=json&filter=statuscode:200&fl=original,timestamp&collapse=urlkey&limit=100&from=2024",1390,60),
  S("wayback_cdx_telegra","Wayback CDX — Telegra.ph","archive","json","https://web.archive.org/cdx/search/cdx?url=telegra.ph/*&output=json&filter=statuscode:200&fl=original,timestamp&collapse=urlkey&limit=100&from=2024",1380,55),

  S("ddg_rentry","DuckDuckGo Lite — Rentry","paste","html","https://lite.duckduckgo.com/lite/?q=site%3Arentry.co%20{q}%20%22mega.nz%2Ffolder%22",1320,50),
  S("ddg_pastebin","DuckDuckGo Lite — Pastebin","paste","html","https://lite.duckduckgo.com/lite/?q=site%3Apastebin.com%20{q}%20%22mega.nz%2Ffolder%22",1310,48),
  S("ddg_pasteee","DuckDuckGo Lite — Paste.ee","paste","html","https://lite.duckduckgo.com/lite/?q=site%3Apaste.ee%20{q}%20%22mega.nz%2Ffolder%22",1300,46),
  S("ddg_justpaste","DuckDuckGo Lite — JustPaste","paste","html","https://lite.duckduckgo.com/lite/?q=site%3Ajustpaste.it%20{q}%20%22mega.nz%2Ffolder%22",1290,44),
  S("ddg_controlc","DuckDuckGo Lite — ControlC","paste","html","https://lite.duckduckgo.com/lite/?q=site%3Acontrolc.com%20{q}%20%22mega.nz%2Ffolder%22",1280,42),
  S("ddg_telegra","DuckDuckGo Lite — Telegra.ph","paste","html","https://lite.duckduckgo.com/lite/?q=site%3Atelegra.ph%20{q}%20%22mega.nz%2Ffolder%22",1270,40),
  S("ddg_pastelink","DuckDuckGo Lite — Pastelink","paste","html","https://lite.duckduckgo.com/lite/?q=site%3Apastelink.net%20{q}%20%22mega.nz%2Ffolder%22",1260,38),
  S("ddg_pastesio","DuckDuckGo Lite — Pastes.io","paste","html","https://lite.duckduckgo.com/lite/?q=site%3Apastes.io%20{q}%20%22mega.nz%2Ffolder%22",1250,36),
  S("ddg_dpaste","DuckDuckGo Lite — dpaste","paste","html","https://lite.duckduckgo.com/lite/?q=site%3Adpaste.org%20{q}%20%22mega.nz%2Ffolder%22",1240,34),

  S("ddg_archive","DuckDuckGo Lite — Internet Archive","archive","html","https://lite.duckduckgo.com/lite/?q=site%3Aarchive.org%20{q}%20%22mega.nz%2Ffolder%22",1200,30),
  S("ddg_reddit","DuckDuckGo Lite — Reddit","comments","html","https://lite.duckduckgo.com/lite/?q=site%3Areddit.com%20{q}%20%22mega.nz%2Ffolder%22",1190,28),
  S("ddg_meawfy","DuckDuckGo Lite — Meawfy","mega-index","html","https://lite.duckduckgo.com/lite/?q=site%3Ameawfy.com%20{q}%20%22mega.nz%2Ffolder%22",1180,26),
  S("ddg_ofversedrops","DuckDuckGo Lite — OfverseDrops","mega-index","html","https://lite.duckduckgo.com/lite/?q=site%3Aofversedrops.com%20{q}%20%22mega.nz%2Ffolder%22",1170,24),

  S("ddg_html_rentry","DuckDuckGo HTML — Rentry","paste","html","https://duckduckgo.com/html/?q=site%3Arentry.co%20{q}%20%22mega.nz%2Ffolder%22",1100,20),
  S("ddg_html_pastebin","DuckDuckGo HTML — Pastebin","paste","html","https://duckduckgo.com/html/?q=site%3Apastebin.com%20{q}%20%22mega.nz%2Ffolder%22",1090,18),
  S("ddg_html_reddit","DuckDuckGo HTML — Reddit","comments","html","https://duckduckgo.com/html/?q=site%3Areddit.com%20{q}%20%22mega.nz%2Ffolder%22",1080,16),
  S("ddg_html_archive","DuckDuckGo HTML — Internet Archive","archive","html","https://duckduckgo.com/html/?q=site%3Aarchive.org%20{q}%20%22mega.nz%2Ffolder%22",1070,14),

  // Bing remains a disabled-by-learning reserve only after proven yield.
  {...S("bing_rss_rentry","Bing RSS reserve — Rentry","reserve","rss","https://www.bing.com/search?format=rss&q=site%3Arentry.co%20{q}%20%22mega.nz%2Ffolder%22",300,-30),enabled:false,defaultEnabled:false},
  {...S("bing_rss_reddit","Bing RSS reserve — Reddit","reserve","rss","https://www.bing.com/search?format=rss&q=site%3Areddit.com%20{q}%20%22mega.nz%2Ffolder%22",290,-35),enabled:false,defaultEnabled:false},
  {...S("bing_rss_archive","Bing RSS reserve — Archive","reserve","rss","https://www.bing.com/search?format=rss&q=site%3Aarchive.org%20{q}%20%22mega.nz%2Ffolder%22",280,-40),enabled:false,defaultEnabled:false}
]);

export function sourceCatalog(){
  const rows=CATALOG.map((row)=>({...row}));
  const ids=new Set(rows.map((r)=>r.id));
  const templates=new Set(rows.map((r)=>r.templateUrl));
  if(ids.size!==rows.length)throw new Error("Duplicate source IDs in autonomous catalog");
  if(templates.size!==rows.length)throw new Error("Duplicate source templates in autonomous catalog");
  if(rows.some(r=>/github|youtube/i.test(`${r.name} ${r.templateUrl}`)))throw new Error("Disallowed source in autonomous catalog");
  return rows;
}
