import { createHtmlAdapter } from "./html.js";
import { createRssAdapter } from "./rss.js";
import { createCustomAdapter } from "./custom.js";

const htmlAdapter = createHtmlAdapter();
const ADAPTERS = new Map([
  ["html", htmlAdapter],
  ["json", htmlAdapter],
  ["custom", createCustomAdapter()],
  ["rss", createRssAdapter()]
]);

export function adapterForSource(source) {
  const type = String(source?.source_type || source?.sourceType || "").toLowerCase();
  const adapter = ADAPTERS.get(type);
  if (!adapter) throw new Error(`unsupported_search_adapter:${type || "unknown"}`);
  return adapter;
}

export function supportedAdapterTypes() {
  return [...ADAPTERS.keys()];
}
