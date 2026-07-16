import { baseAdapterResult, buildSearchUrl } from "./template.js";
import { extractHttpTargets, pastetodayContentVariants } from "../target-decoder.js";
import { extractMegaFolders } from "../../extract/mega.js";

const PASTETODAY_HOST = "pastetoday.com";
const SLUG_RE = /^[A-Za-z0-9_-]{4,80}$/;
const STRING_LITERAL_RE = /["'`]((?:https?:\\?\/\\?\/|\/embed\/|\/api\/|\/raw\/|\/paste\/|\/note\/)[^"'`\\\s<]{3,500})["'`]/gi;
const JSON_URL_RE = /(?:url|href|src|endpoint|api|raw|content|embed)\s*["']?\s*[:=]\s*["']([^"']{3,500})["']/gi;

function isPastetodayUrl(value) {
  try {
    return new URL(value).hostname.toLowerCase().replace(/^www\./, "") === PASTETODAY_HOST;
  } catch {
    return false;
  }
}

function safeAbsolute(value, baseUrl) {
  try {
    const clean = String(value || "")
      .replaceAll("\\/", "/")
      .replace(/\\u002f/gi, "/")
      .replace(/&amp;/gi, "&")
      .trim();
    const url = new URL(clean, baseUrl);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function noteSlug(value) {
  try {
    const url = new URL(value);
    if (url.hostname.toLowerCase().replace(/^www\./, "") !== PASTETODAY_HOST) return "";
    const parts = url.pathname.split("/").filter(Boolean);
    const slug = parts[0] === "embed" ? parts[1] : parts.length === 1 ? parts[0] : "";
    return SLUG_RE.test(slug || "") ? slug : "";
  } catch {
    return "";
  }
}

export function parsePastetodaySearchResults(body, baseUrl) {
  const found = extractHttpTargets(body, baseUrl, { limit: 240 })
    .filter(isPastetodayUrl)
    .flatMap(pastetodayContentVariants);
  return [...new Set(found)];
}

export function createPastetodayAdapter() {
  return Object.freeze({
    id: "pastetoday-note-v2",
    source_type: "pastetoday",
    build(input) {
      return buildSearchUrl(input);
    },
    parse({ input, body }) {
      const built = buildSearchUrl(input);
      const targets = parsePastetodaySearchResults(body, built.url);
      return baseAdapterResult({
        adapter: "pastetoday-note-v2",
        request: built.request,
        requestUrl: built.url,
        targets,
        metadata: { target_count: targets.length, family: "paste-note" }
      });
    }
  });
}

export function inspectPastetodayDocument(text = "", url = "") {
  const raw = String(text || "");
  const lower = raw.toLowerCase();
  const discovered = new Set(extractHttpTargets(raw, url, { limit: 240 }));
  const endpointCandidates = new Set();

  for (const regex of [STRING_LITERAL_RE, JSON_URL_RE]) {
    regex.lastIndex = 0;
    for (const match of raw.matchAll(regex)) {
      const absolute = safeAbsolute(match[1], url);
      if (!absolute) continue;
      discovered.add(absolute);
      if (/\/(?:api|raw|embed|paste|note|content)\//i.test(new URL(absolute).pathname)) endpointCandidates.add(absolute);
    }
  }

  const slug = noteSlug(url);
  if (slug) {
    discovered.add(`https://pastetoday.com/${slug}`);
    discovered.add(`https://pastetoday.com/embed/${slug}`);
  }

  const targets = [...new Set([...discovered].flatMap(pastetodayContentVariants))];
  const dynamicMarkers = [
    "loading please wait",
    "__next_data__",
    "application/ld+json",
    "fetch(",
    "xmlhttprequest",
    "axios.",
    "window.__",
    "document.write",
    "/embed/"
  ].filter((marker) => lower.includes(marker));
  const megaLinks = extractMegaFolders(raw);
  const encodedTargetDetected = /(?:[?&](?:r|url|target|destination)=)[a-z0-9_-]{20,}/i.test(raw)
    || /aHR0cHM6Ly9wYXN0ZXRvZGF5LmNvbS8/i.test(raw);
  const hasEmbed = targets.some((target) => {
    try { return isPastetodayUrl(target) && /\/embed\//i.test(new URL(target).pathname); }
    catch { return false; }
  });

  let reason = "static_document";
  if (megaLinks.length) reason = "mega_extracted";
  else if (dynamicMarkers.length) reason = "dynamic_content_without_mega";
  else if (hasEmbed) reason = "embed_requires_followup";
  else if (endpointCandidates.size) reason = "public_content_endpoint_requires_followup";
  else reason = "no_mega_signal_in_initial_html";

  return {
    adapter: "pastetoday-note-v2",
    slug,
    targets,
    endpoints: [...endpointCandidates],
    dynamic: dynamicMarkers.length > 0,
    dynamicMarkers,
    hasEmbed,
    encodedTargetDetected,
    megaLinks,
    reason,
    evidence: {
      source_url: url,
      slug,
      target_count: targets.length,
      endpoint_count: endpointCandidates.size,
      mega_count: megaLinks.length
    }
  };
}
