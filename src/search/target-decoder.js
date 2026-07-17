import { dedupeTargets } from "./normalization.js";

const ABSOLUTE_URL_RE = /https?:\\?\/\\?\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+/gi;
const HREF_RE = /<(?:a|iframe|form|link|script)\b[^>]*?(?:href|src|action)\s*=\s*["']([^"']+)["'][^>]*>/gi;
const META_REFRESH_RE = /<meta\b[^>]*http-equiv=["']?refresh["']?[^>]*content=["'][^"']*?url\s*=\s*([^"';>]+)["']/gi;
const REDIRECT_KEYS = ["uddg", "url", "target", "dest", "destination", "redirect", "redirect_url", "continue", "link", "r", "o", "u", "to", "out", "go"];
const BASE64_URL_TOKEN_RE = /(?:^|[^A-Za-z0-9_-])([A-Za-z0-9_-]{24,684})(?=$|[^A-Za-z0-9_-])/g;

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&#0*38;/gi, "&")
    .replace(/&#x0*26;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#0*39;|&apos;/gi, "'")
    .replace(/&#x0*2f;/gi, "/");
}

function decodeJsEscapes(value) {
  return String(value || "")
    .replace(/\\u002[fF]/g, "/")
    .replace(/\\u003[aA]/g, ":")
    .replace(/\\u002[eE]/g, ".")
    .replace(/\\x2[fF]/g, "/")
    .replace(/\\x3[aA]/g, ":")
    .replace(/\\x2[eE]/g, ".")
    .replaceAll("\\/", "/");
}

function decodeBase64Url(value) {
  try {
    const normalized = String(value || "").replace(/^a1/i, "").replace(/-/g, "+").replace(/_/g, "/");
    if (!/^[A-Za-z0-9+/=]{12,}$/.test(normalized)) return "";
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

function repeatedDecode(value, rounds = 5) {
  let current = decodeJsEscapes(decodeHtmlEntities(value));
  for (let index = 0; index < rounds; index += 1) {
    try {
      const decoded = decodeJsEscapes(decodeHtmlEntities(decodeURIComponent(current)));
      if (decoded === current) break;
      current = decoded;
    } catch { break; }
  }
  return current.trim();
}

function unwrapOnce(value, baseUrl) {
  const absolute = new URL(repeatedDecode(value), baseUrl);
  const host = absolute.hostname.toLowerCase();

  for (const key of REDIRECT_KEYS) {
    const candidate = absolute.searchParams.get(key);
    if (!candidate) continue;
    const decoded = repeatedDecode(candidate);
    if (/^https?:\/\//i.test(decoded)) return decoded;
    const base64Decoded = repeatedDecode(decodeBase64Url(decoded));
    if (/^https?:\/\//i.test(base64Decoded)) return base64Decoded;
  }

  if (/google\./i.test(host) && absolute.pathname === "/url") {
    const candidate = repeatedDecode(absolute.searchParams.get("q") || absolute.searchParams.get("url") || "");
    if (/^https?:\/\//i.test(candidate)) return candidate;
  }

  if (/(^|\.)bing\.com$/i.test(host) && /\/ck\/a$/i.test(absolute.pathname)) {
    const encoded = absolute.searchParams.get("u") || "";
    const decoded = repeatedDecode(decodeBase64Url(encoded));
    if (/^https?:\/\//i.test(decoded)) return decoded;
  }

  return absolute.toString();
}

export function decodeSearchTarget(value, baseUrl, { maxDepth = 6 } = {}) {
  let current = new URL(repeatedDecode(value), baseUrl).toString();
  const seen = new Set();
  for (let depth = 0; depth < maxDepth; depth += 1) {
    if (seen.has(current)) break;
    seen.add(current);
    const next = unwrapOnce(current, baseUrl);
    if (next === current) break;
    current = new URL(next, current).toString();
  }
  return current;
}


export function contentVariants(value) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  const variants = [url.toString()];

  if (host === "rentry.co") {
    const slug = url.pathname.match(/^\/(?:raw\/)?([^/?#]+)\/?$/)?.[1];
    if (slug && !["register", "login", "what"].includes(slug.toLowerCase())) {
      variants.unshift(`https://rentry.co/raw/${slug}`);
    }
  }

  if (["justpaste.it", "controlc.com", "telegra.ph", "pastemode.com", "pastelink.net"].includes(host)) {
    variants.unshift(url.toString().replace(/\/$/, ""));
  }

  return dedupeTargets(variants);
}

function targetPriority(value, baseUrl) {
  try {
    const url = new URL(value, baseUrl);
    const host = url.hostname.toLowerCase();
    const full = `${host}${url.pathname}`.toLowerCase();
    if (/\.(?:css|js|mjs|png|jpe?g|gif|svg|webp|woff2?|ttf|ico|mp4|mp3|zip|rar)(?:$|\?)/i.test(url.pathname)) return -100;
    if (/google-analytics|googletagmanager|doubleclick|facebook\.com\/tr|hotjar|cloudflareinsights/.test(host)) return -100;
    let score = 0;
    if (/paste|rentry|telegra|controlc|note|justpaste|pastemode|pastelink/.test(full)) score += 60;
    if (/linkvertise|speedy-links|redirect|out|go\//.test(full)) score += 45;
    if (/raw|download|view|post|article|entry|share/.test(full)) score += 25;
    if (url.hostname === new URL(baseUrl).hostname) score += 15;
    if ([...url.searchParams.keys()].some((key) => REDIRECT_KEYS.includes(key.toLowerCase()))) score += 35;
    return score;
  } catch { return -100; }
}

export function extractHttpTargets(text, baseUrl, { limit = 80 } = {}) {
  const candidates = [];
  const raw = decodeJsEscapes(decodeHtmlEntities(String(text || "")));
  for (const match of raw.matchAll(HREF_RE)) {
    try { candidates.push(decodeSearchTarget(match[1], baseUrl)); } catch {}
  }
  for (const match of raw.matchAll(META_REFRESH_RE)) {
    try { candidates.push(decodeSearchTarget(match[1], baseUrl)); } catch {}
  }
  for (const match of raw.matchAll(ABSOLUTE_URL_RE)) {
    try {
      const cleaned = match[0].replaceAll("\\/", "/").replace(/[),.;'\"]+$/g, "");
      candidates.push(decodeSearchTarget(cleaned, baseUrl));
    } catch {}
  }
  // Redirect platforms sometimes expose the final public target as a bare
  // base64url token inside JSON or inline JavaScript rather than an href.
  for (const match of raw.matchAll(BASE64_URL_TOKEN_RE)) {
    try {
      const decoded = repeatedDecode(decodeBase64Url(match[1]));
      if (/^https?:\/\//i.test(decoded)) candidates.push(decodeSearchTarget(decoded, baseUrl));
    } catch {}
  }
  return dedupeTargets(candidates.flatMap(contentVariants))
    .map((url, index) => ({ url, index, score: targetPriority(url, baseUrl) }))
    .filter((item) => item.score > -100)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((item) => item.url);
}
