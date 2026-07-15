import { uid, nowIso } from "../db/queries.js";
import { assertPublicHttpUrl } from "../search/crawler.js";
import { extractHttpTargets } from "../search/target-decoder.js";

const BLOCKED_HOSTS = [/(^|\.)mega\.(nz|io)$/i,/(^|\.)duckduckgo\.com$/i,/(^|\.)bing\.com$/i,/(^|\.)google\./i,/(^|\.)web\.archive\.org$/i];
const BARE_DOMAIN_RE = /(?:^|[\s>"'(])((?:[a-z0-9-]+\.)+[a-z]{2,63})(?=[:/\s<"')]|$)/gi;
function hash(text){let h=2166136261;for(const ch of String(text)){h^=ch.charCodeAt(0);h=Math.imul(h,16777619);}return(h>>>0).toString(36);}
function hostRoot(value){const u=assertPublicHttpUrl(value);u.pathname="/";u.search="";u.hash="";return u.toString();}
export function normalizeCandidateUrl(value){const url=assertPublicHttpUrl(value);url.hash="";for(const key of [...url.searchParams.keys()])if(/^(utm_|fbclid$|gclid$|ref$|source$)/i.test(key))url.searchParams.delete(key);return url.toString();}
export function candidateId(value){return `candidate_${hash(normalizeCandidateUrl(value))}`;}
export function discoverCandidateUrls(input,baseUrl,{limit=80}={}){
  const raw=String(input||"");
  const out=[],seen=new Set();
  const add=v=>{
    try{
      const n=normalizeCandidateUrl(new URL(v,baseUrl).toString());
      const h=new URL(n).hostname;
      if(BLOCKED_HOSTS.some(r=>r.test(h))||seen.has(n))return;
      seen.add(n);out.push(n);
    }catch{}
  };
  // Search engines commonly wrap target URLs (uddg=, /url?q=, ck/a?...).
  // Decode those wrappers first, then fall back to raw HTML/JSON URL discovery.
  for(const target of extractHttpTargets(raw,baseUrl))add(target);
  for(const m of raw.matchAll(/(?:href|src|action)\s*=\s*["']([^"']+)["']/gi))add(m[1]);
  for(const m of raw.matchAll(/https?:\/\/[^\s"'<>\\]+/gi))add(m[0]);
  // Some search/RSS responses render a visible hostname without a clickable
  // absolute URL. Preserve those public host signals as root candidates.
  for(const m of raw.matchAll(BARE_DOMAIN_RE))add(`https://${m[1]}/`);
  return out.slice(0,limit);
}

export function calculateSourceGrade(metrics={}){
  const pages=Math.max(1,Number(metrics.pagesTested||0));
  const novel=Number(metrics.novelLinks||0),alive=Number(metrics.aliveLinks||0),dead=Number(metrics.deadLinks||0),unknown=Number(metrics.unknownLinks||0),dupes=Number(metrics.duplicateLinks||0);
  const fail=Number(metrics.failedFetches||0),blocked=Number(metrics.blockedFetches||0),ok=Number(metrics.successfulFetches||0);
  const novelty=novel/pages,aliveRate=alive/Math.max(1,alive+dead+unknown);
  const score=novelty*28+aliveRate*32+Math.min(20,novel*3)+Math.min(12,ok)-Math.min(24,fail*4)-Math.min(30,blocked*10)-Math.min(10,dupes/pages*5);
  return score>=58?"A":score>=32?"B":score>=10?"C":"D";
}
function familyFor(host,url=""){const v=`${host} ${url}`.toLowerCase();if(/paste|rentry|telegra|controlc|dpaste|note|justpaste|pastetoday|pasteee|paste\.ee/.test(v))return"note";if(/reddit|forum|board/.test(v))return"community";if(/archive|wayback|mirror/.test(v))return"archive";if(/index|search|links/.test(v))return"index";return"web";}

export async function registerSourceCandidates(db,{urls=[],sourceId=null,sourceHost=null,autoscanRunId=null,discoveryRunId=null,megaLinksFound=0,novelLinksFound=0,aliveLinksFound=0,deadLinksFound=0,unknownLinksFound=0,duplicateLinksFound=0,successful=true,blockedFetches=0,pagesTested=1,latency=0,megaFingerprints=[],evidenceUrl=null}={}){
  const now=nowIso();let registered=0;const domainMap=new Map();
  for(const value of urls){let normalized;try{normalized=normalizeCandidateUrl(value);}catch{continue;}const u=new URL(normalized),host=u.hostname,root=hostRoot(normalized),id=candidateId(normalized),delta=successful?(aliveLinksFound>0?24:novelLinksFound>0?18:megaLinksFound>0?10:2):-5;
    await db.prepare(`INSERT INTO source_candidates(id,normalized_url,host,discovered_from_source_id,discovered_from_autoscan_run_id,discovered_from_discovery_run_id,evidence_count,mega_links_found,successful_fetches,failed_fetches,confidence,state,first_seen_at,last_seen_at,pages_tested,novel_links_found,alive_links_found,duplicate_links_found,average_latency,quality_grade,family) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(normalized_url) DO UPDATE SET evidence_count=evidence_count+1,mega_links_found=mega_links_found+excluded.mega_links_found,successful_fetches=successful_fetches+excluded.successful_fetches,failed_fetches=failed_fetches+excluded.failed_fetches,confidence=MAX(-100,MIN(100,confidence+?)),last_seen_at=excluded.last_seen_at,pages_tested=pages_tested+excluded.pages_tested,novel_links_found=novel_links_found+excluded.novel_links_found,alive_links_found=alive_links_found+excluded.alive_links_found,duplicate_links_found=duplicate_links_found+excluded.duplicate_links_found,average_latency=CASE WHEN average_latency=0 THEN excluded.average_latency ELSE (average_latency+excluded.average_latency)/2 END`).bind(id,normalized,host,sourceId,autoscanRunId,discoveryRunId,1,Number(megaLinksFound),successful?1:0,successful?0:1,Math.max(0,delta),"candidate",now,now,Math.max(1,Number(pagesTested)),Number(novelLinksFound),Number(aliveLinksFound),Number(duplicateLinksFound),Number(latency),"C",familyFor(host,normalized),delta).run();
    if(!domainMap.has(host))domainMap.set(host,{host,root,example:normalized});registered++;
  }
  for(const {host,root,example} of domainMap.values()){
    const delta=successful?(aliveLinksFound>0?24:novelLinksFound>0?18:megaLinksFound>0?10:2):-5;
    await db.prepare(`INSERT INTO source_candidate_domains(host,root_url,state,family,quality_grade,evidence_count,pages_tested,extracted_links,novel_links,alive_links,dead_links,unknown_links,duplicate_links,successful_fetches,failed_fetches,blocked_fetches,average_latency,confidence,first_seen_at,last_seen_at,last_tested_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(host) DO UPDATE SET evidence_count=evidence_count+1,pages_tested=pages_tested+excluded.pages_tested,extracted_links=extracted_links+excluded.extracted_links,novel_links=novel_links+excluded.novel_links,alive_links=alive_links+excluded.alive_links,dead_links=dead_links+excluded.dead_links,unknown_links=unknown_links+excluded.unknown_links,duplicate_links=duplicate_links+excluded.duplicate_links,successful_fetches=successful_fetches+excluded.successful_fetches,failed_fetches=failed_fetches+excluded.failed_fetches,blocked_fetches=blocked_fetches+excluded.blocked_fetches,average_latency=CASE WHEN average_latency=0 THEN excluded.average_latency ELSE (average_latency+excluded.average_latency)/2 END,confidence=MAX(-100,MIN(100,confidence+?)),last_seen_at=excluded.last_seen_at,last_tested_at=excluded.last_tested_at`).bind(host,root,"candidate",familyFor(host,example),"C",1,Math.max(1,Number(pagesTested)),Number(megaLinksFound),Number(novelLinksFound),Number(aliveLinksFound),Number(deadLinksFound),Number(unknownLinksFound),Number(duplicateLinksFound),successful?1:0,successful?0:1,Number(blockedFetches),Number(latency),Math.max(0,delta),now,now,now,delta).run();
    const dm=await db.prepare(`SELECT * FROM source_candidate_domains WHERE host=?`).bind(host).first();if(dm){const g=calculateSourceGrade({pagesTested:dm.pages_tested,novelLinks:dm.novel_links,aliveLinks:dm.alive_links,deadLinks:dm.dead_links,unknownLinks:dm.unknown_links,duplicateLinks:dm.duplicate_links,failedFetches:dm.failed_fetches,blockedFetches:dm.blocked_fetches,successfulFetches:dm.successful_fetches});let state=dm.state;if(Number(dm.blocked_fetches||0)>=3)state="blocked";else if(Number(dm.pages_tested)>=12&&Number(dm.novel_links)===0)state="dormant";else if(Number(dm.failed_fetches)>=8&&Number(dm.successful_fetches)===0)state="quarantined";else if(Number(dm.duplicate_links)>=20&&Number(dm.novel_links)===0)state="duplicate";else if(Number(dm.pages_tested)>=20&&g==="D")state="rejected";await db.prepare(`UPDATE source_candidate_domains SET quality_grade=?,state=?,rejection_reason=CASE WHEN ?='rejected' THEN 'low_quality_after_sampling' WHEN ?='duplicate' THEN 'duplicate_mirror' WHEN ?='blocked' THEN 'repeated_http_blocking' WHEN ?='quarantined' THEN 'repeated_fetch_failure' ELSE rejection_reason END WHERE host=? AND state NOT IN ('promoted')`).bind(g,state,state,state,state,state,host).run();}
    for(const fp of megaFingerprints||[])await db.prepare(`INSERT INTO source_graph_edges(id,mega_fingerprint,from_host,to_host,discovery_method,evidence_url,evidence_count,first_seen_at,last_seen_at,from_source_id) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(mega_fingerprint,to_host,discovery_method) DO UPDATE SET evidence_count=evidence_count+1,last_seen_at=excluded.last_seen_at,evidence_url=COALESCE(source_graph_edges.evidence_url,excluded.evidence_url),from_host=COALESCE(source_graph_edges.from_host,excluded.from_host),from_source_id=COALESCE(source_graph_edges.from_source_id,excluded.from_source_id)`).bind(uid("edge"),fp,sourceHost,host,"link_reappearance",evidenceUrl||example,1,now,now,sourceId).run();
  }
  return{registered,domains:domainMap.size};
}

export async function promoteQualifiedCandidates(db,{limit=20}={}){
  const rows=await db.prepare(`
    SELECT * FROM source_candidate_domains
    WHERE state IN ('candidate','testing','sandbox')
      AND successful_fetches>=1
      AND pages_tested>=1
      AND confidence>=2
      AND blocked_fetches<3
      AND failed_fetches<=successful_fetches+3
    ORDER BY
      CASE WHEN family='note' THEN 0 WHEN alive_links>0 OR novel_links>0 THEN 1 ELSE 2 END,
      alive_links DESC,novel_links DESC,extracted_links DESC,
      confidence DESC,successful_fetches DESC,last_seen_at DESC
    LIMIT ?`).bind(Math.max(1,Math.min(100,Number(limit)||20))).all();
  let promoted=0,created=0,activated=0,sandboxed=0,updated=0;
  const decisions=[];
  for(const row of rows.results||[]){
    const sourceId=`discovered_${hash(row.host)}`;
    const alive=Number(row.alive_links||0),novel=Number(row.novel_links||0),links=Number(row.extracted_links||0);
    const successes=Number(row.successful_fetches||0),evidence=Number(row.evidence_count||0);
    // Active promotion requires real MEGA yield. Note/paste surfaces may qualify
    // with repeated extraction evidence even before the health checker classifies
    // a link as alive, but a single reachable page never auto-enables a source.
    const proven=alive>0||novel>0||(row.family==='note'&&links>=3&&successes>=2&&evidence>=2);
    const enabled=proven?1:0;
    const priority=proven?(row.family==='note'?960:900):420;
    const rank=Math.max(1,Math.min(95,Number(row.confidence||0)+(proven?20:0)));
    const root=String(row.root_url||`https://${row.host}/`);
    // Note-first sources are crawled directly from their root surface. Other
    // discovered domains retain a site-search template as a safe sandbox entry.
    const template=row.family==='note'
      ? root
      : `https://lite.duckduckgo.com/lite/?q=site%3A${encodeURIComponent(row.host)}%20{q}%20%22mega.nz%2Ffolder%22`;
    const sourceType=row.family==='note'?'html':'html';
    const now=nowIso();
    const existing=await db.prepare(`SELECT id,enabled FROM sources WHERE id=? OR template_url=? LIMIT 1`).bind(sourceId,template).first();
    if(!existing){
      await db.prepare(`INSERT INTO sources(id,name,category,source_type,template_url,enabled,default_enabled,priority,rank_score,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)`).bind(sourceId,`Discovered — ${row.host}`,row.family||"discovered",sourceType,template,enabled,0,priority,rank,now,now).run();
      await db.prepare(`INSERT INTO source_metrics(source_id,requests,successes,failures,timeouts,blocks,links_found,valid_links,yield_rate,average_latency,consecutive_failures,last_success_at,last_failure_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(source_id) DO NOTHING`).bind(sourceId,Number(row.pages_tested||0),successes,Number(row.failed_fetches||0),0,Number(row.blocked_fetches||0),links,alive,Number(row.pages_tested||0)?links*100/Math.max(1,Number(row.pages_tested||0)):0,Number(row.average_latency||0),0,successes>0?row.last_tested_at:null,Number(row.failed_fetches||0)>0?row.last_tested_at:null,now).run();
      created++;if(enabled)activated++;else sandboxed++;
    }else{
      await db.prepare(`UPDATE sources SET enabled=CASE WHEN ?=1 THEN 1 ELSE enabled END,source_type=?,template_url=?,priority=MAX(priority,?),rank_score=MAX(rank_score,?),updated_at=? WHERE id=?`).bind(enabled,sourceType,template,priority,rank,now,existing.id).run();
      updated++;
    }
    const finalId=existing?.id||sourceId;
    const state=proven?'promoted':'sandbox';
    if(proven)promoted++;
    await db.prepare(`UPDATE source_candidate_domains SET state=?,promoted_source_id=?,quality_grade=CASE WHEN ?=1 AND quality_grade IN ('C','D') THEN 'B' ELSE quality_grade END,last_seen_at=?,rejection_reason=NULL WHERE host=?`).bind(state,finalId,enabled,now,row.host).run();
    await db.prepare(`UPDATE source_candidates SET state=?,promoted_source_id=?,quality_grade=CASE WHEN ?=1 AND quality_grade IN ('C','D') THEN 'B' ELSE quality_grade END,last_seen_at=?,rejection_reason=NULL WHERE host=?`).bind(state,finalId,enabled,now,row.host).run();
    decisions.push({host:row.host,source_id:finalId,enabled:Boolean(enabled),mode:state,evidence_count:evidence,pages_tested:Number(row.pages_tested||0),extracted_links:links,novel_links:novel,alive_links:alive,confidence:Number(row.confidence||0)});
  }
  return{promoted,created,activated,sandboxed,updated,considered:(rows.results||[]).length,decisions};
}
export async function sourceDiscoverySummary(db){const totals=await db.prepare(`SELECT COUNT(*) total,SUM(state IN ('candidate','testing','sandbox')) candidates,SUM(state='promoted') promoted,SUM(state='rejected') rejected,SUM(state='blocked') blocked,SUM(state='dormant') dormant,SUM(state='duplicate') duplicates,SUM(state='quarantined') quarantined FROM source_candidate_domains`).first();const recent=await db.prepare(`SELECT host,root_url,state,family,quality_grade,evidence_count,pages_tested,extracted_links,novel_links,alive_links,dead_links,unknown_links,duplicate_links,average_latency,confidence,last_seen_at,promoted_source_id,rejection_reason FROM source_candidate_domains ORDER BY last_seen_at DESC LIMIT 50`).all();return{total:Number(totals?.total||0),candidates:Number(totals?.candidates||0),promoted:Number(totals?.promoted||0),rejected:Number(totals?.rejected||0),blocked:Number(totals?.blocked||0),dormant:Number(totals?.dormant||0),duplicates:Number(totals?.duplicates||0),quarantined:Number(totals?.quarantined||0),recent:recent.results||[]};}
