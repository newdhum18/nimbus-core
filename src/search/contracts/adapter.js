import { AppError } from "../../api/errors.js";

export const SEARCH_ADAPTER_SCHEMA = "nimbus.search-adapter.v1";
export const SEARCH_MODES = Object.freeze(["autoscan", "keyword"]);

export function normalizeSearchRequest(input = {}) {
  const mode = String(input.mode || "").trim();
  if (!SEARCH_MODES.includes(mode)) {
    throw new AppError("SEARCH_MODE_INVALID", "Search mode must be autoscan or keyword", "search", 400);
  }

  const query = String(input.query ?? "").trim().replace(/\s+/g, " ");
  if (mode === "keyword" && !query) {
    throw new AppError("KEYWORD_REQUIRED", "Keyword is required", "search", 400);
  }

  const sourceId = String(input.source_id || "").trim();
  const templateUrl = String(input.template_url || "").trim();
  if (!sourceId || !templateUrl) {
    throw new AppError("SEARCH_SOURCE_INVALID", "source_id and template_url are required", "search", 400);
  }

  const round = Number.isInteger(Number(input.round)) ? Math.max(0, Number(input.round)) : 0;
  return Object.freeze({
    schema: SEARCH_ADAPTER_SCHEMA,
    mode,
    query,
    round,
    source_id: sourceId,
    template_url: templateUrl
  });
}

export function validateAdapterResult(result) {
  if (!result || result.schema !== SEARCH_ADAPTER_SCHEMA) throw new Error("adapter_result_schema_invalid");
  if (!Array.isArray(result.targets)) throw new Error("adapter_targets_invalid");
  if (!Array.isArray(result.warnings)) throw new Error("adapter_warnings_invalid");
  return result;
}
