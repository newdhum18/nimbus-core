const CORE_DOMAINS = Object.freeze([
  "rentry.co","pastebin.com","paste.ee","justpaste.it","controlc.com",
  "dpaste.org","pastes.io","paste.rs","pastelink.net","telegra.ph",
  "reddit.com","old.reddit.com","archive.org","meawfy.com","ofversedrops.com",
  "linktr.ee","blogspot.com","wordpress.com","tumblr.com"
]);

const RESERVE_DOMAINS = Object.freeze([
  "hastebin.com","0bin.net","privatebin.net","pastecode.io","paste2.org",
  "ghostbin.com","textbin.net","codepad.org","ideone.com","scribd.com",
  "issuu.com","slideshare.net","medium.com","substack.com","notion.site",
  "notion.so","docs.google.com","sites.google.com","wixsite.com","weebly.com",
  "gitbook.io","readthedocs.io","readme.io","calameo.com","beacons.ai",
  "bio.link","solo.to","msha.ke","taplink.cc","allmylinks.com","instabio.cc",
  "heylink.me","lnk.bio","flow.page","about.me","carrd.co","campsite.bio",
  "linkin.bio","bio.fm","hypage.com","koji.to","snipfeed.co","milkshake.app",
  "shor.by","tap.bio"
]);

const DDG_ENGINES = Object.freeze([
  { id:"ddg-lite", sourceType:"html", priorityBase:1100, rankScore:40, template:"https://lite.duckduckgo.com/lite/?q=site%3A{domain}%20{q}%20%22mega.nz%2Ffolder%22{facet}" },
  { id:"ddg-html", sourceType:"html", priorityBase:1000, rankScore:30, template:"https://duckduckgo.com/html/?q=site%3A{domain}%20{q}%20%22mega.nz%2Ffolder%22{facet}" }
]);

const BING_ENGINES = Object.freeze([
  { id:"bing-rss", sourceType:"rss", priorityBase:250, rankScore:-10, template:"https://www.bing.com/search?format=rss&q=site%3A{domain}%20{q}%20%22mega.nz%2Ffolder%22{facet}" },
  { id:"bing-web", sourceType:"html", priorityBase:100, rankScore:-20, template:"https://www.bing.com/search?q=site%3A{domain}%20{q}%20%22mega.nz%2Ffolder%22{facet}&count=20" }
]);

const DIRECT_SOURCES = Object.freeze([
  {id:"direct_meawfy_api",name:"Meawfy public results API",category:"mega-index",sourceType:"custom",templateUrl:"https://meawfy.com/internal/api/results.json?q={q}",defaultEnabled:true,priority:1300,rankScore:60},
  {id:"direct_meawfy_search",name:"Meawfy public search",category:"mega-index",sourceType:"custom",templateUrl:"https://meawfy.com/?s={q}",defaultEnabled:true,priority:1290,rankScore:50},
  {id:"direct_ofversedrops",name:"OfverseDrops public search",category:"mega-index",sourceType:"custom",templateUrl:"https://ofversedrops.com/?s={q}",defaultEnabled:true,priority:1280,rankScore:45},
  {id:"direct_reddit_comments",name:"Reddit comments search",category:"community",sourceType:"html",templateUrl:"https://www.reddit.com/search/?q=%22mega.nz%2Ffolder%22%20{q}&type=comment",defaultEnabled:true,priority:1270,rankScore:40}
]);

const DEFAULT_FACETS = Object.freeze(["%20comments","%20archive"]);
const RESERVE_FACETS = Object.freeze(["","%20archive","%20collection","%20public","%20folder","%20index"]);

function category(domain){
  if(/paste|rentry|controlc|dpaste|telegra/.test(domain))return"paste";
  if(/reddit/.test(domain))return"community";
  if(/archive/.test(domain))return"archive";
  if(/meawfy|ofversedrops/.test(domain))return"mega-index";
  return"web";
}

function makeSource({id,domain,engine,facet="",enabled,priorityOffset=0,categoryName=category(domain)}){
  return {
    id,
    name:`${engine.id} ${domain}${facet.replaceAll("%20"," ")}`,
    category:categoryName,
    sourceType:engine.sourceType,
    templateUrl:engine.template.replace("{domain}",domain).replace("{facet}",facet),
    enabled,
    defaultEnabled:enabled,
    priority:engine.priorityBase-priorityOffset,
    rankScore:engine.rankScore
  };
}

export function sourceCatalog(){
  const rows=DIRECT_SOURCES.map(x=>({...x,enabled:true}));

  // 4 direct + 19 domains × 2 DDG engines = 42.
  let offset=0;
  for(const domain of CORE_DOMAINS){
    for(const engine of DDG_ENGINES){
      offset+=1;
      rows.push(makeSource({id:`default_${String(rows.length+1).padStart(3,"0")}`,domain,engine,enabled:true,priorityOffset:offset}));
    }
  }

  // Add 38 more high-value DDG variants to reach exactly 80 defaults.
  let extra=0;
  outerDefaults:for(const domain of CORE_DOMAINS){
    for(const facet of DEFAULT_FACETS){
      for(const engine of DDG_ENGINES){
        if(rows.length===80)break outerDefaults;
        extra+=1;
        rows.push(makeSource({id:`default_${String(rows.length+1).padStart(3,"0")}`,domain,engine,facet,enabled:true,priorityOffset:100+extra}));
      }
    }
  }

  // Reserve sources: DDG variants first, Bing always at the very bottom.
  let reserve=0;
  outerReserve:for(const domain of RESERVE_DOMAINS){
    for(const facet of RESERVE_FACETS){
      for(const engine of DDG_ENGINES){
        if(rows.length===260)break outerReserve;
        reserve+=1;
        rows.push(makeSource({id:`reserve_${String(reserve).padStart(3,"0")}`,domain,engine,facet,enabled:false,priorityOffset:reserve,categoryName:"reserve"}));
      }
    }
  }

  let bing=0;
  outerBing:for(const domain of [...CORE_DOMAINS,...RESERVE_DOMAINS]){
    for(const engine of BING_ENGINES){
      if(rows.length===300)break outerBing;
      bing+=1;
      rows.push(makeSource({id:`bing_${String(bing).padStart(3,"0")}`,domain,engine,enabled:false,priorityOffset:bing,categoryName:"reserve"}));
    }
  }

  if(rows.length!==300)throw new Error(`Source catalog invariant failed: expected 300, received ${rows.length}`);
  if(rows.filter(r=>r.defaultEnabled).length!==80)throw new Error("Source catalog invariant failed: expected 80 defaults");
  if(rows.some(r=>/github|youtube/i.test(`${r.name} ${r.templateUrl}`)))throw new Error("Source catalog contains disallowed domains");
  return rows;
}
