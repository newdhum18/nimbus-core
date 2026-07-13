import { AppError } from "../api/errors.js";

export const KEYWORD_CATEGORIES = Object.freeze({
  games: ["pc games", "game collection", "portable games", "retro games", "game backup", "game archive"],
  series: ["tv series", "complete season", "series collection", "episode pack", "season pack", "web series"],
  movies: ["movie collection", "film archive", "documentary collection", "cinema pack", "movie bundle"],
  tools: ["software tools", "portable apps", "developer tools", "utilities pack", "toolkit", "software archive"],
  sports: ["sports archive", "football highlights", "basketball collection", "training videos", "sports documentary"],
  courses: ["course bundle", "tutorial collection", "training course", "learning pack", "masterclass", "study resources"],
  books: ["ebook collection", "pdf library", "book archive", "magazine collection", "manuals pack"],
  music: ["music collection", "album archive", "discography", "audio pack", "sound library"],
  datasets: ["dataset collection", "research data", "machine learning dataset", "data archive", "sample data"],
  adult: ["adult collection", "nsfw archive", "18+ collection", "mature content", "sëx collection", "s3x archive"]
});

const BLOCKED_MINOR_TERMS = /\b(child|children|kid|kids|minor|teen(?:ager)?|underage|schoolgirl|schoolboy|loli|shota)\b/i;
const GENERIC_STOP = new Set(["mega","folder","download","files","file","link","links","collection","archive","pack","bundle","full","complete","public","shared"]);

export function normalizeCategory(value) {
  const category = String(value || "tools").trim().toLowerCase();
  if (!Object.hasOwn(KEYWORD_CATEGORIES, category)) throw new AppError("INVALID_CATEGORY", "Unknown keyword category", "search", 400);
  return category;
}

export function safeKeyword(value) {
  const term = String(value || "").trim().replace(/\s+/g, " ").slice(0, 120);
  if (!term) return "";
  if (BLOCKED_MINOR_TERMS.test(term)) throw new AppError("UNSAFE_KEYWORD", "Keywords involving minors are not allowed", "search", 400);
  return term;
}

function stableHash(text) { let h=2166136261; for (const c of String(text)) { h^=c.charCodeAt(0); h=Math.imul(h,16777619); } return h>>>0; }

export function deterministicPick(values, seed, limit=1) {
  const rows=[...new Set(values.filter(Boolean))];
  return rows.sort((a,b)=>(stableHash(`${a}:${seed}`)%100000)-(stableHash(`${b}:${seed}`)%100000)).slice(0,limit);
}

export async function keywordSuggestions(db, { category="tools", limit=12, seed=Date.now() }={}) {
  const selectedCategory=normalizeCategory(category);
  const learned = db ? await db.prepare(`
    SELECT term,score,hits FROM search_terms
    WHERE category=? AND enabled=1
    ORDER BY score DESC,hits DESC,last_seen_at DESC
    LIMIT 100
  `).bind(selectedCategory).all().catch(()=>({results:[]})) : {results:[]};
  const pool=[...(learned.results||[]).map(r=>r.term),...KEYWORD_CATEGORIES[selectedCategory]];
  return {
    category:selectedCategory,
    suggestions:deterministicPick(pool,seed,Math.max(1,Math.min(30,Number(limit)||12))),
    learned_count:(learned.results||[]).length
  };
}

export function inferCategory(text) {
  const value=String(text||"").toLowerCase();
  const rules=[
    ["adult",/\b(adult|nsfw|18\+|mature|s[eë3]x|xxx)\b/i],
    ["games",/\b(game|gaming|steam|xbox|playstation|switch|roms?)\b/i],
    ["series",/\b(series|season|episode|tv show|web series)\b/i],
    ["movies",/\b(movie|film|cinema|documentary)\b/i],
    ["sports",/\b(sport|football|soccer|basketball|ufc|wrestling|fitness)\b/i],
    ["courses",/\b(course|tutorial|training|masterclass|lesson)\b/i],
    ["books",/\b(book|ebook|pdf|magazine|manual)\b/i],
    ["music",/\b(music|album|discography|audio|soundtrack)\b/i],
    ["datasets",/\b(dataset|research data|machine learning|csv|corpus)\b/i]
  ];
  return rules.find(([,re])=>re.test(value))?.[0] || "tools";
}

export function extractLearnableTerms(text) {
  const clean=String(text||"").replace(/<[^>]+>/g," ").replace(/[^\p{L}\p{N}+._ -]+/gu," ").replace(/\s+/g," ").trim();
  if (!clean || BLOCKED_MINOR_TERMS.test(clean)) return [];
  const words=clean.split(" ").filter(w=>w.length>=3 && w.length<=28 && !GENERIC_STOP.has(w.toLowerCase()));
  const candidates=[];
  for (let size=1;size<=3;size++) for(let i=0;i+size<=words.length;i++) {
    const term=words.slice(i,i+size).join(" ");
    if(term.length>=4&&term.length<=70&&!BLOCKED_MINOR_TERMS.test(term)) candidates.push(term);
  }
  return [...new Set(candidates)].slice(0,40);
}

export async function learnSearchTerms(db, text, weight=1) {
  // Keep learning lightweight so extraction throughput is never reduced.
  // Rank candidates by occurrence order, cap the write set, and commit in one D1 batch.
  const terms=extractLearnableTerms(text).slice(0,12);
  if (!terms.length) return 0;
  const now=new Date().toISOString();
  const score=Math.max(1,Number(weight)||1);
  const statements=terms.map((term)=>{
    const category=inferCategory(term);
    return db.prepare(`
      INSERT INTO search_terms(category,term,score,hits,enabled,created_at,last_seen_at)
      VALUES(?,?,?,1,1,?,?)
      ON CONFLICT(category,term) DO UPDATE SET
        score=MIN(1000,search_terms.score+excluded.score),
        hits=search_terms.hits+1,
        last_seen_at=excluded.last_seen_at
    `).bind(category,term,score,now,now);
  });
  await db.batch(statements);
  return terms.length;
}
