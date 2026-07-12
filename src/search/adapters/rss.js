import { baseAdapterResult, buildSearchUrl } from "./template.js";
import { dedupeTargets } from "../normalization.js";

const LINK_RE = /<link(?:\s[^>]*)?>(?:<!\[CDATA\[)?\s*([^<\]]+)\s*(?:\]\]>)?<\/link>/gi;

export function parseRssSearchResults(xml, baseUrl) {
  const baseHost = new URL(baseUrl).hostname;
  const values = [];
  for (const match of String(xml || "").matchAll(LINK_RE)) values.push(match[1].trim());
  return dedupeTargets(values).filter((url) => new URL(url).hostname !== baseHost);
}

export function createRssAdapter(id = "generic-rss") {
  return Object.freeze({
    id,
    source_type: "rss",
    build(input) { return buildSearchUrl(input); },
    parse({ input, body }) {
      const built = buildSearchUrl(input);
      const targets = parseRssSearchResults(body, built.url);
      return baseAdapterResult({ adapter: id, request: built.request, requestUrl: built.url, targets });
    }
  });
}
