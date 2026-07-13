import { dedupeTargets } from "./normalization.js";

const ABSOLUTE_URL_RE = /https?:\\?\/\\?\/[A-Za-z0-9._~:/?#\[\]@!$&'()*+,;=%-]+/gi;
const HREF_RE = /<a\b[^>]*?href\s*=\s*["']([^"']+)["'][^>]*>/gi;

function decodeBase64Url(value) {
  try {
    const normalized = String(value || "").replace(/^a1/i, "").replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

function repeatedDecode(value, rounds = 3) {
  let current = String(value || "");
  for (let index = 0; index < rounds; index += 1) {
    try {
      const decoded = decodeURIComponent(current);
      if (decoded === current) break;
      current = decoded;
    } catch { break; }
  }
  return current;
}

export function decodeSearchTarget(value, baseUrl) {
  const absolute = new URL(String(value || ""), baseUrl);
  const host = absolute.hostname.toLowerCase();

  // DuckDuckGo and common wrappers.
  for (const key of ["uddg", "url", "target", "dest", "destination"]) {
    const candidate = absolute.searchParams.get(key);
    if (candidate) {
      const decoded = repeatedDecode(candidate);
      if (/^https?:\/\//i.test(decoded)) return decoded;
    }
  }

  // Google /url?q= and other q-based redirect pages only.
  if (/google\./i.test(host) && absolute.pathname === "/url") {
    const candidate = repeatedDecode(absolute.searchParams.get("q") || absolute.searchParams.get("url") || "");
    if (/^https?:\/\//i.test(candidate)) return candidate;
  }

  // Bing ck/a?u=a1<base64url>.
  if (/(^|\.)bing\.com$/i.test(host) && /\/ck\/a$/i.test(absolute.pathname)) {
    const encoded = absolute.searchParams.get("u") || "";
    const decoded = decodeBase64Url(encoded);
    if (/^https?:\/\//i.test(decoded)) return decoded;
    const plain = repeatedDecode(encoded);
    if (/^https?:\/\//i.test(plain)) return plain;
  }

  // Generic wrappers using u= only when it is already an absolute URL.
  const generic = repeatedDecode(absolute.searchParams.get("u") || "");
  if (/^https?:\/\//i.test(generic)) return generic;
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
    if (slug && !["register", "login", "what"].includes(slug.toLowerCase())) {
      variants.unshift(`https://rentry.co/raw/${slug}`);
    }
  }

  if ((host === "reddit.com" || host === "old.reddit.com") && /\/comments\//.test(url.pathname)) {
    const cleanPath = url.pathname.replace(/\/$/, "");
    variants.unshift(`https://www.reddit.com${cleanPath}.json?raw_json=1`);
  }

  return dedupeTargets(variants);
}

export function extractHttpTargets(text, baseUrl) {
  const candidates = [];
  for (const match of String(text || "").matchAll(HREF_RE)) {
    try { candidates.push(decodeSearchTarget(match[1], baseUrl)); } catch {}
  }
  for (const match of String(text || "").matchAll(ABSOLUTE_URL_RE)) {
    try {
      const cleaned = match[0].replaceAll("\\/", "/").replace(/[),.;'\"]+$/g, "");
      candidates.push(decodeSearchTarget(cleaned, baseUrl));
    } catch {}
  }
  return dedupeTargets(candidates.flatMap(contentVariants));
}
