import { baseAdapterResult, buildSearchUrl } from "./template.js";
import { extractHttpTargets, contentVariants } from "../target-decoder.js";

const ASSET_RE = /\.(?:css|js|mjs|png|jpe?g|gif|svg|webp|woff2?|ttf|ico|mp4|mp3|zip|rar|7z|pdf)(?:$|\?)/i;
const BLOCKED_PATH_RE = /\/(?:wp-admin|wp-login\.php|login|logout|register|privacy|terms)(?:\/|$)/i;

function useful(url, baseUrl) {
  try {
    const parsed = new URL(url, baseUrl);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    if (ASSET_RE.test(parsed.pathname) || BLOCKED_PATH_RE.test(parsed.pathname)) return false;
    return true;
  } catch { return false; }
}

export function parseDirectSourceResults(body, baseUrl) {
  const targets = extractHttpTargets(body, baseUrl, { limit: 320 })
    .filter((url) => useful(url, baseUrl))
    .flatMap(contentVariants);
  return [...new Set(targets)];
}

export function createCustomAdapter() {
  return Object.freeze({
    id: "direct-source-crawler-v1",
    source_type: "custom",
    build(input) { return buildSearchUrl(input); },
    parse({ input, body }) {
      const built = buildSearchUrl(input);
      const targets = parseDirectSourceResults(body, built.url);
      return baseAdapterResult({
        adapter: "direct-source-crawler-v1",
        request: built.request,
        requestUrl: built.url,
        targets,
        metadata: { target_count: targets.length, family: "direct-public-source" }
      });
    }
  });
}
