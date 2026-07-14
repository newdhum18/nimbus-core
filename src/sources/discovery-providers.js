import { assertPublicHttpUrl } from "../search/crawler.js";

function unique(values, limit=50){
  const out=[];const seen=new Set();
  for(const value of values||[]){
    try{
      const url=assertPublicHttpUrl(value).toString();
      if(seen.has(url))continue;
      seen.add(url);out.push(url);
      if(out.length>=limit)break;
    }catch{}
  }
  return out;
}

async function readJson(response){
  try{return await response.json();}catch{return null;}
}

async function braveSearch(env,query,{count=20}={}){
  const token=String(env?.BRAVE_SEARCH_API_KEY||"").trim();
  if(!token)return {provider:"brave",configured:false,ok:false,status:0,error:"not_configured",urls:[]};
  const url=new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q",query);
  url.searchParams.set("count",String(Math.max(1,Math.min(20,count))));
  url.searchParams.set("search_lang","en");
  url.searchParams.set("ui_lang","en-US");
  const started=Date.now();
  try{
    const response=await fetch(url,{headers:{accept:"application/json","x-subscription-token":token}});
    const data=await readJson(response);
    const urls=unique(data?.web?.results?.map(item=>item?.url).filter(Boolean)||[],count);
    return {provider:"brave",configured:true,ok:response.ok&&urls.length>0,status:response.status,error:response.ok?(urls.length?null:"empty_results"):`http_${response.status}`,urls,latency:Date.now()-started};
  }catch(error){return {provider:"brave",configured:true,ok:false,status:0,error:error instanceof Error?error.message:String(error),urls:[],latency:Date.now()-started};}
}

async function searxngSearch(env,query,{count=20}={}){
  const base=String(env?.SEARXNG_BASE_URL||"").trim();
  if(!base)return {provider:"searxng",configured:false,ok:false,status:0,error:"not_configured",urls:[]};
  const started=Date.now();
  try{
    const url=new URL("/search",assertPublicHttpUrl(base));
    url.searchParams.set("q",query);
    url.searchParams.set("format","json");
    url.searchParams.set("language","en-US");
    const response=await fetch(url,{headers:{accept:"application/json"}});
    const data=await readJson(response);
    const urls=unique(data?.results?.map(item=>item?.url).filter(Boolean)||[],count);
    return {provider:"searxng",configured:true,ok:response.ok&&urls.length>0,status:response.status,error:response.ok?(urls.length?null:"empty_results"):`http_${response.status}`,urls,latency:Date.now()-started};
  }catch(error){return {provider:"searxng",configured:true,ok:false,status:0,error:error instanceof Error?error.message:String(error),urls:[],latency:Date.now()-started};}
}

export function discoveryProviderStatus(env){
  return {
    brave:{configured:Boolean(String(env?.BRAVE_SEARCH_API_KEY||"").trim()),secret:"BRAVE_SEARCH_API_KEY"},
    searxng:{configured:Boolean(String(env?.SEARXNG_BASE_URL||"").trim()),variable:"SEARXNG_BASE_URL"},
    html_fallback:{configured:true,note:"Best effort only; public search pages may block Cloudflare Worker requests."}
  };
}

export async function searchDiscoveryProviders(env,query,{count=20}={}){
  const attempts=[];
  for(const provider of [braveSearch,searxngSearch]){
    const result=await provider(env,query,{count});
    attempts.push(result);
    if(result.ok&&result.urls.length)return {ok:true,provider:result.provider,urls:result.urls,attempts};
  }
  return {ok:false,provider:null,urls:[],attempts};
}
