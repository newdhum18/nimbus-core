import { AppError } from "../api/errors.js";
import { deterministicPick, keywordSuggestions, normalizeCategory, safeKeyword } from "./keyword-intelligence.js";

const QUERY_MODIFIERS = Object.freeze([
  "collection", "archive", "pack", "bundle", "folder", "resources",
  "shared folder", "mega folder", "complete", "library", "index", "backup"
]);

const QUERY_QUALIFIERS = Object.freeze([
  "latest", "updated", "public", "download", "mirror", "catalog",
  "database", "repository", "2024", "2025", "2026", "english"
]);

export function buildQuery(keyword) {
  const clean = safeKeyword(keyword);
  if (!clean) throw new AppError("KEYWORD_REQUIRED", "Keyword is required", "search", 400);
  return clean;
}

function uniqueQueryPool(baseTerms) {
  const out = [];
  const seen = new Set();
  const add = (value) => {
    const clean = String(value || "").trim().replace(/\s+/g, " ");
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) return;
    seen.add(key);
    out.push(clean);
  };

  for (const term of baseTerms) {
    add(term);
    for (const modifier of QUERY_MODIFIERS) add(`${term} ${modifier}`);
    for (const qualifier of QUERY_QUALIFIERS) add(`${qualifier} ${term}`);
    for (const modifier of QUERY_MODIFIERS.slice(0, 8)) {
      for (const qualifier of QUERY_QUALIFIERS.slice(0, 8)) {
        add(`${term} ${modifier} ${qualifier}`);
      }
    }
  }
  return out;
}

function exactDeterministicQueries(pool, seed, count) {
  const selected = deterministicPick(pool, seed, Math.min(count, pool.length));
  if (selected.length >= count) return selected.slice(0, count);

  // Defensive fallback: always return exactly the requested number of valid,
  // unique queries even when a future category has very few seed terms.
  const result = [...selected];
  const seen = new Set(result.map((q) => q.toLowerCase()));
  let index = 1;
  while (result.length < count) {
    const base = pool[index % Math.max(1, pool.length)] || "public resources";
    const candidate = `${base} discovery ${String(index).padStart(3, "0")}`;
    const key = candidate.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      result.push(candidate);
    }
    index += 1;
  }
  return result;
}

export async function buildAdaptiveQueries(db,{keyword="",category="tools",rounds=1,seed="nimbus"}={}){
  const count=Math.max(1,Math.min(100,Number(rounds)||1));
  const explicit=safeKeyword(keyword);

  if(explicit){
    const pool=uniqueQueryPool([explicit]);
    return exactDeterministicQueries(pool,`${seed}:manual:${explicit}`,count);
  }

  const selectedCategory=normalizeCategory(category);
  const data=await keywordSuggestions(db,{category:selectedCategory,limit:30,seed});
  if(!data.suggestions.length)throw new AppError("NO_KEYWORD_SUGGESTIONS","No keyword suggestions are available","search",409);
  const pool=uniqueQueryPool(data.suggestions);
  return exactDeterministicQueries(pool,`${seed}:category:${selectedCategory}`,count);
}
