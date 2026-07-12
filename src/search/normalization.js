const TRACKING_PARAMS = new Set(["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "fbclid", "gclid"]);

export function normalizeTargetUrl(value) {
  const url = new URL(String(value));
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("unsupported_target_protocol");
  url.hash = "";
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.has(key.toLowerCase())) url.searchParams.delete(key);
  }
  return url.toString();
}

export function dedupeTargets(values) {
  const seen = new Set();
  const output = [];
  for (const value of values) {
    try {
      const normalized = normalizeTargetUrl(value);
      if (!seen.has(normalized)) {
        seen.add(normalized);
        output.push(normalized);
      }
    } catch {
      // Invalid or non-http targets are intentionally ignored.
    }
  }
  return output;
}
