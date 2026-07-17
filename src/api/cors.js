const PRODUCTION_ORIGIN = "https://nimbus-core-v36-web.pages.dev";
const PREVIEW_SUFFIX = ".nimbus-core-v36-web.pages.dev";

export function isAllowedOrigin(origin) {
  if (!origin) return false;
  try {
    const url = new URL(origin);
    return url.protocol === "https:" && (
      url.origin === PRODUCTION_ORIGIN ||
      url.hostname.endsWith(PREVIEW_SUFFIX)
    );
  } catch {
    return false;
  }
}

export function corsHeaders(request) {
  const origin = request.headers.get("origin") || "";
  const headers = {
    "access-control-allow-methods": "GET,POST,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    "vary": "Origin"
  };

  if (isAllowedOrigin(origin)) {
    headers["access-control-allow-origin"] = origin;
  }

  return headers;
}
