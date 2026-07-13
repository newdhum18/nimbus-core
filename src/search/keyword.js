import { AppError } from "../api/errors.js";
import { keywordSuggestions, normalizeCategory, safeKeyword } from "./keyword-intelligence.js";

const QUERY_MODIFIERS = Object.freeze([
  "collection", "archive", "pack", "bundle", "folder", "resources",
  "shared folder", "mega folder", "complete", "library", "index", "backup"
]);

const QUERY_QUALIFIERS = Object.freeze([
  "latest", "updated", "public", "mirror", "catalog",
  "database", "repository", "english", "1080p", "4k", "portable"
]);

export function buildQuery(keyword) {
  const clean = safeKeyword(keyword);
  if (!clean) throw new AppError("KEYWORD_REQUIRED", "Keyword is required", "search", 400);
  return clean;
}

function addUnique(out, seen, value) {
  const clean = String(value || "").trim().replace(/\s+/g, " ");
  const key = clean.toLowerCase();
  if (!clean || seen.has(key)) return;
  seen.add(key);
  out.push(clean);
}

function buildMeaningfulPool(baseTerms) {
  const out = [];
  const seen = new Set();

  for (const rawTerm of baseTerms) {
    const term = safeKeyword(rawTerm);
    if (!term) continue;

    // Preserve the strongest legacy behavior first: search the exact term.
    addUnique(out, seen, term);

    for (const modifier of QUERY_MODIFIERS) {
      addUnique(out, seen, `${term} ${modifier}`);
    }
    for (const qualifier of QUERY_QUALIFIERS) {
      addUnique(out, seen, `${qualifier} ${term}`);
    }

    // Meaningful combinations only. Avoid artificial "discovery 001" queries,
    // which previously reduced search relevance.
    for (const modifier of QUERY_MODIFIERS) {
      for (const qualifier of QUERY_QUALIFIERS) {
        addUnique(out, seen, `${term} ${modifier} ${qualifier}`);
        addUnique(out, seen, `${qualifier} ${term} ${modifier}`);
      }
    }
  }
  return out;
}

function rotatePool(pool, seed, count) {
  if (!pool.length) return [];
  let hash = 2166136261;
  for (const c of String(seed || "nimbus")) {
    hash ^= c.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const offset = Math.abs(hash >>> 0) % pool.length;
  return Array.from({ length: Math.min(count, pool.length) }, (_, index) => pool[(offset + index) % pool.length]);
}

export async function buildAdaptiveQueries(db, { keyword = "", category = "tools", rounds = 1, seed = "nimbus" } = {}) {
  const count = Math.max(1, Math.min(100, Number(rounds) || 1));
  const explicit = safeKeyword(keyword);

  if (explicit) {
    const pool = buildMeaningfulPool([explicit]);
    const rotated = rotatePool(pool, `${seed}:manual:${explicit}`, count);
    // Exact keyword is always first to preserve the stronger legacy search path.
    const withoutExact = rotated.filter((query) => query.toLowerCase() !== explicit.toLowerCase());
    return [explicit, ...withoutExact].slice(0, count);
  }

  const selectedCategory = normalizeCategory(category);
  const data = await keywordSuggestions(db, { category: selectedCategory, limit: 30, seed });
  if (!data.suggestions.length) {
    throw new AppError("NO_KEYWORD_SUGGESTIONS", "No keyword suggestions are available", "search", 409);
  }

  const pool = buildMeaningfulPool(data.suggestions);
  const selected = rotatePool(pool, `${seed}:category:${selectedCategory}`, count);
  if (selected.length !== count) {
    throw new AppError("QUERY_POOL_EXHAUSTED", "Not enough meaningful search queries are available", "search", 409);
  }
  return selected;
}
