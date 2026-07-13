const PROTECTED=/^(meawfy_api|meawfy_search|ofversedrops_search|ddg_rentry|reddit_search_json|reddit_comments_json)$/;
function n(value){const x=Number(value);return Number.isFinite(x)?x:0;}
function stableHash(text){let h=2166136261;for(const c of String(text)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}

export function intelligenceScore(row){
  const requests=n(row.requests), successes=n(row.successes), novel=n(row.novel_links), duplicates=n(row.duplicate_links);
  const latency=n(row.average_latency), failures=n(row.consecutive_failures), blocks=n(row.blocks), priority=n(row.priority), base=n(row.rank_score);
  const successRate=requests?successes/requests:0.5;
  const noveltyRate=requests?novel/requests:0;
  const duplicatePenalty=(novel+duplicates)?duplicates/(novel+duplicates):0;
  const latencyPenalty=Math.min(latency/2000,8);
  return base + priority/20 + successRate*35 + noveltyRate*80 - duplicatePenalty*30 - failures*10 - blocks*5 - latencyPenalty;
}

export function sourceState(row, now=Date.now()){
  if(PROTECTED.test(String(row.id||""))) {
    const requests=n(row.requests), novel=n(row.novel_links);
    if(requests<3)return "explore";
    if(novel>0)return "proven";
    return "observe";
  }
  if(row.cooldown_until && Date.parse(row.cooldown_until)>now)return "cooldown";
  const requests=n(row.requests), novel=n(row.novel_links), failures=n(row.consecutive_failures), zero=n(row.zero_yield_runs);
  if(requests>=8 && failures>=5)return "quarantined";
  if(requests>=8 && zero>=6 && novel===0)return "disabled";
  if(requests<3)return "explore";
  if(novel>0)return "proven";
  return "observe";
}

export function chooseSources(rows,{roundIndex=0,maxSources=24}={}){
  const usable=rows.filter((r)=>!["quarantined","disabled","cooldown"].includes(sourceState(r)));
  const scored=usable.map((r)=>({...r,intelligence_score:intelligenceScore(r),intelligence_state:sourceState(r)}));
  const proven=scored.filter(r=>r.intelligence_state==="proven").sort((a,b)=>b.intelligence_score-a.intelligence_score);
  const observe=scored.filter(r=>r.intelligence_state==="observe").sort((a,b)=>b.intelligence_score-a.intelligence_score);
  const explore=scored.filter(r=>r.intelligence_state==="explore").sort((a,b)=>(stableHash(`${a.id}:${roundIndex}`)%100000)-(stableHash(`${b.id}:${roundIndex}`)%100000));
  const target=Math.min(maxSources,scored.length);
  const counts={proven:Math.ceil(target*.7),observe:Math.ceil(target*.2)};
  const selected=[];
  const take=(bucket,count)=>{for(const row of bucket){if(selected.length>=target||count<=0)break;if(!selected.some(x=>x.id===row.id)){selected.push(row);count--;}}};
  take(proven,counts.proven);take(observe,counts.observe);take(explore,target-selected.length);
  take([...proven,...observe,...explore].sort((a,b)=>b.intelligence_score-a.intelligence_score),target-selected.length);
  return selected;
}
