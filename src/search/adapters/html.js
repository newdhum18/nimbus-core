import { baseAdapterResult, buildSearchUrl } from "./template.js";
import { extractHttpTargets } from "../target-decoder.js";

export function parseHtmlSearchResults(html, baseUrl) {
  const baseHost = new URL(baseUrl).hostname;
  return extractHttpTargets(html, baseUrl).filter((url) => {
    try { return new URL(url).hostname !== baseHost; } catch { return false; }
  });
}

export function createHtmlAdapter(id = "generic-html") {
  return Object.freeze({
    id,
    source_type: "html",
    build(input) { return buildSearchUrl(input); },
    parse({ input, body }) {
      const built = buildSearchUrl(input);
      const targets = parseHtmlSearchResults(body, built.url);
      return baseAdapterResult({ adapter: id, request: built.request, requestUrl: built.url, targets });
    }
  });
}
