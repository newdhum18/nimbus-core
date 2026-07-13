const BASE = ["","archive","collection","public","index","folder","shared","backup","resources","files"];
const AGE = ["","2026","2025","recent","latest"];
export const AUTOSCAN_QUERIES = Object.freeze(AGE.flatMap(age=>BASE.map(base=>[base,age].filter(Boolean).join(" "))));
export function autoscanQuery(round=0){const n=Math.max(0,Number(round)||0);return AUTOSCAN_QUERIES[n%AUTOSCAN_QUERIES.length];}
