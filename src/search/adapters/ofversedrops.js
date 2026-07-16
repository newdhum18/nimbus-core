import { baseAdapterResult, buildSearchUrl } from "./template.js";
import { extractHttpTargets, contentVariants } from "../target-decoder.js";

const HOST = "ofversedrops.com";
const ASSET_RE = /\.(?:css|js|mjs|png|jpe?g|gif|svg|webp|woff2?|ttf|ico|mp4|mp3|zip|rar)(?:$|\?)/i;

function normalizeHost(value) {
  try { return new URL(value).hostname.toLowerCase().replace(/^www\./, ""); }
  catch { return ""; }
}

function usefulOfversePath(value) {
  try {
    const url = new URL(value);
    if (normalizeHost(value) !== HOST) return false;
    if (ASSET_RE.test(url.pathname)) return false;
    if (["/", "/wp-admin/", "/wp-login.php"].includes(url.pathname)) return false;
    if (/\/(?:feed|author|tag|category)\/?$/i.test(url.pathname)) return false;
    return true;
  } catch { return false; }
}

export function parseOfversedropsResults(body, baseUrl) {
  const targets = extractHttpTargets(body, baseUrl, { limit: 240 });
  const ranked = [];
  for (const target of targets) {
    const host = normalizeHost(target);
    if (host === HOST) {
      if (usefulOfversePath(target)) ranked.push(target);
      continue;
    }
    // Preserve public note/paste destinations and redirect surfaces. The target
    // decoder already resolves visible base64url destinations such as the
    // Linkvertise `r=` parameter without interacting with ads or protections.
    if (/pastetoday\.com|paste|rentry|telegra|controlc|justpaste|linkvertise/i.test(target)) {
      ranked.push(...contentVariants(target));
    }
  }
  return [...new Set(ranked)];
}

export function createOfversedropsAdapter() {
  return Object.freeze({
    id: "ofversedrops-public-v1",
    source_type: "ofversedrops",
    build(input) { return buildSearchUrl(input); },
    parse({ input, body }) {
      const built = buildSearchUrl(input);
      const targets = parseOfversedropsResults(body, built.url);
      return baseAdapterResult({
        adapter: "ofversedrops-public-v1",
        request: built.request,
        requestUrl: built.url,
        targets,
        metadata: { target_count: targets.length, family: "public-content-hub" }
      });
    }
  });
}
