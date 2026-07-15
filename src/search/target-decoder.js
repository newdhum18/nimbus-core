import { dedupeTargets } from "./normalization.js";

const ABSOLUTE_URL_RE = /https?:\\?\/\\?\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+/gi;
const ATTR_URL_RE = /\b(?:href|src|action|data-url|data-href|data-target|data-destination|data-redirect|content)\s*=\s*["']([^"']+)["']/gi;
const META_REFRESH_RE = /<meta\b[^>]*http-equiv=["']?refresh["']?[^>]*content=["'][^"']*?url\s*=\s*([^"';>]+)["']/gi;
const ENCODED_BLOB_RE = /(?:^|[^A-Za-z0-9+/_-])([A-Za-z0-9+/_-]{24,2048}={0,2})(?=$|[^A-Za-z0-9+/_=-])/g;
const REDIRECT_KEYS = ["uddg", "url", "target", "dest", "destination", "redirect", "redirect_url", "continue", "link", "r", "o", "u", "q"];

function decodeBase64Url(value) {
  try {
    const normalized = String(value || "").replace(/^a1/i, "").replace(/-/g, "+").replace(/_/g, "/");
    if (!normalized || normalized.length % 4 === 1) return "";
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

function repeatedDecode(value, rounds = 5) {
  let current = String(value || "")
    .replace(/&amp;/gi, "&")
    .replaceAll("\\/", "/")
    .trim();
  for (let index = 0; index < rounds; index += 1) {
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) break;
      current = decoded;
    } catch { break; }
  }
  return current;
}

function absoluteCandidate(value) {
  const decoded = repeatedDecode(value);
  if (/^https?:\/\//i.test(decoded)) return decoded;
  const base64Decoded = repeatedDecode(decodeBase64Url(decoded));
  if (/^https?:\/\//i.test(base64Decoded)) return base64Decoded;
  return "";
}

export function decodeSearchTarget(value, baseUrl) {
  const absolute = new URL(String(value || ""), baseUrl);
  const host = absolute.hostname.toLowerCase();

  for (const key of REDIRECT_KEYS) {
    const candidate = absolute.searchParams.get(key);
    const resolved = candidate ? absoluteCandidate(candidate) : "";
    if (resolved) return resolved;
  }

  if (/google\./i.test(host) && absolute.pathname === "/url") {
    const resolved = absoluteCandidate(absolute.searchParams.get("q") || absolute.searchParams.get("url") || "");
    if (resolved) return resolved;
  }

  if (/(^|\.)bing\.com$/i.test(host) && /\/ck\/a$/i.test(absolute.pathname)) {
    const resolved = absoluteCandidate(absolute.searchParams.get("u") || "");
    if (resolved) return resolved;
  }

  return absolute.toString();
}

export function contentVariants(value) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const variants = [url.toString()];

  if (host === "pastebin.com") {
    const id = url.pathname.match(/^\/(?:raw\/)?([A-Za-z0-9]+)\/?$/)?.[1];
    if (id) variants.unshift(`https://pastebin.com/raw/${id}`);
  }
  if (host === "rentry.co") {
    const slug = url.pathname.match(/^\/(?:raw\/)?([^/?#]+)\/?$/)?.[1];
    if (slug && !["register", "login", "what"].includes(slug.toLowerCase())) variants.unshift(`https://rentry.co/raw/${slug}`);
  }
  if (host === "paste.ee") {
    const id = url.pathname.match(/^\/p\/([^/?#]+)/)?.[1];
    if (id) variants.unshift(`https://paste.ee/r/${id}`);
  }
  if (host === "pastetoday.com") variants.unshift(url.toString().replace(/\/$/, ""));
  if (host === "gist.github.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length >= 2) variants.unshift(`https://gist.githubusercontent.com/${parts[0]}/${parts[1]}/raw`);
  }
  if ((host === "reddit.com" || host === "old.reddit.com" || host === "www.reddit.com") && /\/comments\//.test(url.pathname)) {
    const cleanPath = url.pathname.replace(/\/$/, "");
    variants.unshift(`https://www.reddit.com${cleanPath}.json?raw_json=1`);
  }
  return dedupeTargets(variants);
}

function extractEmbeddedUrls(text) {
  const values = [];
  const raw = String(text || "")
    .replace(/\\u0*02f/gi, "/")
    .replace(/\\u0*03a/gi, ":")
    .replace(/\\x2f/gi, "/")
    .replace(/\\x3a/gi, ":")
    .replaceAll("\\/", "/");
  for (const match of raw.matchAll(ABSOLUTE_URL_RE)) values.push(match[0]);
  for (const match of raw.matchAll(ENCODED_BLOB_RE)) {
    const decoded = decodeBase64Url(match[1]);
    if (/https?:\/\//i.test(decoded)) {
      for (const nested of decoded.matchAll(ABSOLUTE_URL_RE)) values.push(nested[0]);
      if (/^https?:\/\//i.test(decoded.trim())) values.push(decoded.trim());
    }
  }
  return values;
}

export function targetPriority(value, baseUrl = "https://example.invalid/") {
  try {
    const url = new URL(value, baseUrl);
    const host = url.hostname.toLowerCase();
    const path = `${url.pathname}${url.search}`.toLowerCase();
    let score = 0;
    if (/(paste|rentry|telegra|controlc|justpaste|pastetoday|dpaste|note|gist)/i.test(host)) score += 80;
    if (/(linkvertise|speedy-links|work\.ink|loot-link|short|redirect)/i.test(host)) score += 70;
    if (/\b(raw|note|paste|post|view|entry|article|archive|recent|feed|rss)\b/i.test(path)) score += 30;
    if (/mega\.(?:nz|io)/i.test(value)) score += 100;
    if (/(googletagmanager|google-analytics|doubleclick|facebook|twitter|instagram|tiktok)/i.test(host)) score -= 100;
    if (/\.(?:css|js|png|jpe?g|gif|svg|webp|woff2?|ttf|ico)(?:$|\?)/i.test(path)) score -= 90;
    if (/\b(login|register|privacy|terms|contact)\b/i.test(path)) score -= 40;
    return score;
  } catch { return -999; }
}

export function extractHttpTargets(text, baseUrl) {
  const candidates = [];
  const add = (value) => {
    try { candidates.push(decodeSearchTarget(value, baseUrl)); } catch {}
  };
  const raw = String(text || "");
  for (const match of raw.matchAll(ATTR_URL_RE)) add(match[1]);
  for (const match of raw.matchAll(META_REFRESH_RE)) add(match[1]);
  for (const value of extractEmbeddedUrls(raw)) add(value);

  const expanded = dedupeTargets(candidates.flatMap((value) => {
    try { return contentVariants(value); } catch { return [value]; }
  }));
  return expanded.sort((a, b) => targetPriority(b, baseUrl) - targetPriority(a, baseUrl));
}
