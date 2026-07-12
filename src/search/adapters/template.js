import { autoscanQuery } from "../autoscan.js";
import { normalizeSearchRequest, SEARCH_ADAPTER_SCHEMA } from "../contracts/adapter.js";

function encodeFacet(value) {
  return encodeURIComponent(String(value || "").trim());
}

export function buildSearchUrl(input) {
  const request = normalizeSearchRequest(input);
  const effectiveQuery = request.mode === "autoscan" ? autoscanQuery(request.round) : request.query;
  const rendered = request.template_url
    .replaceAll("{q}", encodeURIComponent(effectiveQuery))
    .replaceAll("{query}", encodeURIComponent(effectiveQuery))
    .replaceAll("{facet}", encodeFacet(input.facet || ""));
  const url = new URL(rendered);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("search_adapter_protocol_invalid");
  return Object.freeze({ request, effective_query: effectiveQuery, url: url.toString() });
}

export function baseAdapterResult({ adapter, request, requestUrl, targets = [], warnings = [], metadata = {} }) {
  return Object.freeze({
    schema: SEARCH_ADAPTER_SCHEMA,
    adapter,
    source_id: request.source_id,
    mode: request.mode,
    request_url: requestUrl,
    targets,
    warnings,
    metadata
  });
}
