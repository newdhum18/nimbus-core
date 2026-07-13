import { decodeHtmlEntities, decodeRepeated, normalizeMegaUrl } from "./normalize.js";

const MODERN = /https?:\/\/(?:www\.)?mega\.(?:nz|io)\/folder\/[A-Za-z0-9_-]{8,16}#[A-Za-z0-9_-]{20,64}/gi;
const LEGACY = /https?:\/\/(?:www\.)?mega\.(?:nz|io)\/#F![A-Za-z0-9_-]{8,16}![A-Za-z0-9_-]{20,64}/gi;
const BASE64_TOKEN = /(?:^|[^A-Za-z0-9+/_-])([A-Za-z0-9+/_-]{40,684}={0,2})(?=$|[^A-Za-z0-9+/_=-])/g;

function decodeBase64(value){
  try{
    const normalized=String(value).replace(/-/g,"+").replace(/_/g,"/");
    const padded=normalized+"=".repeat((4-normalized.length%4)%4);
    const raw=atob(padded);
    const bytes=Uint8Array.from(raw,c=>c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }catch{return"";}
}

function decodedVariants(input){
  const raw=String(input??"").replace(/[\u200B-\u200D\uFEFF]/g,"");
  const slashFixed=raw
    .replaceAll("\\/","/")
    .replace(/\\u0*02f/gi,"/").replace(/\\u0*023/gi,"#").replace(/\\u0*03a/gi,":")
    .replace(/\\x2f/gi,"/").replace(/\\x23/gi,"#").replace(/\\x3a/gi,":");
  const percentFixed=slashFixed
    .replace(/%3A/gi,":").replace(/%2F/gi,"/").replace(/%23/gi,"#").replace(/%21/gi,"!")
    .replace(/%26amp%3B/gi,"&");
  const compact=percentFixed
    .replace(/https?\s*:\s*\/\s*\//gi,m=>m.replace(/\s/g,""))
    .replace(/mega\s*\.\s*(nz|io)/gi,"mega.$1")
    .replace(/\/\s*folder\s*\//gi,"/folder/")
    .replace(/\s*#\s*/g,"#");
  const variants=new Set([raw,slashFixed,percentFixed,compact,decodeHtmlEntities(raw),decodeRepeated(raw),decodeRepeated(percentFixed),decodeRepeated(compact)]);
  for(const source of [...variants]){
    for(const match of source.matchAll(BASE64_TOKEN)){
      const decoded=decodeBase64(match[1]);
      if(/mega\.(?:nz|io)/i.test(decoded))variants.add(decoded);
    }
  }
  return variants;
}

export function classifyMegaFolder(url,{allowLegacy=true}={}){
  const normalized=normalizeMegaUrl(url).replace(/^https:\/\/mega\.io/i,"https://mega.nz");
  if(/^https:\/\/mega\.nz\/file\//i.test(normalized))return{valid:false,type:"file",normalizedUrl:normalized,hasKey:false};
  if(/^https:\/\/mega\.nz\/folder\/[A-Za-z0-9_-]{8,16}#[A-Za-z0-9_-]{20,64}$/i.test(normalized))return{valid:true,type:"folder",normalizedUrl:normalized,hasKey:true};
  if(allowLegacy&&/^https:\/\/mega\.nz\/#F![A-Za-z0-9_-]{8,16}![A-Za-z0-9_-]{20,64}$/i.test(normalized))return{valid:true,type:"legacy_folder",normalizedUrl:normalized,hasKey:true};
  return{valid:false,type:null,normalizedUrl:normalized,hasKey:false};
}

export function extractMegaFolders(input,options={}){
  const candidates=[];
  for(const text of decodedVariants(input)){
    for(const regex of [MODERN,...(options.allowLegacy===false?[]:[LEGACY])]){
      regex.lastIndex=0;
      for(const match of text.matchAll(regex))candidates.push(match[0]);
    }
  }
  const unique=new Map();
  for(const candidate of candidates){const c=classifyMegaFolder(candidate,options);if(c.valid)unique.set(c.normalizedUrl,c);}
  return[...unique.values()];
}
