import { classifyMegaFolder } from "../extract/mega.js";
import { nowIso } from "../db/queries.js";

const DEAD_MARKERS=[/link.{0,30}(?:unavailable|removed|deleted|invalid)/i,/folder.{0,30}(?:unavailable|removed|deleted)/i,/this\s+(?:folder|link)\s+(?:is\s+)?(?:unavailable|removed|deleted)/i];

export async function validateMegaFolderUrl(value,{timeoutMs=7000}={}){
  const shape=classifyMegaFolder(value,{allowLegacy:true});
  if(!shape.valid)return{status:"invalid",reason:"invalid_link_shape",http_status:null};
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(shape.normalizedUrl,{redirect:"follow",signal:controller.signal,headers:{"user-agent":"Mozilla/5.0 NimbusCoreLinkValidator/1.0","accept":"text/html,*/*;q=0.1"}});
    const text=(await response.text()).slice(0,200000);
    if(response.status===404||response.status===410||DEAD_MARKERS.some(r=>r.test(text)))return{status:"dead",reason:`http_or_page_marker_${response.status}`,http_status:response.status};
    // MEGA is a client-side application. A generic HTTP 200 does not prove that
    // the encrypted folder exists, so do not mislabel it alive.
    return{status:"unknown",reason:"reachable_but_not_cryptographically_verified",http_status:response.status};
  }catch(error){
    return{status:"unknown",reason:String(error?.name==='AbortError'?'timeout':error?.message||error),http_status:null};
  }finally{clearTimeout(timer);}
}

export async function validateStoredLinks(db,{runId=null,limit=20}={}){
  const rows=await db.prepare(`SELECT id,normalized_url FROM links WHERE (? IS NULL OR run_id=?) AND validation_status IN ('structurally_valid','unchecked','unknown','pending','valid') ORDER BY discovered_at DESC LIMIT ?`).bind(runId,runId,limit).all();
  const results=[];
  for(const row of rows.results||[]){
    const verdict=await validateMegaFolderUrl(row.normalized_url);
    await db.prepare(`UPDATE links SET validation_status=?,validation_error=?,validation_http_status=?,validated_at=? WHERE id=?`).bind(verdict.status,verdict.reason,verdict.http_status,nowIso(),row.id).run();
    results.push({id:row.id,url:row.normalized_url,...verdict});
  }
  return{checked:results.length,results};
}
