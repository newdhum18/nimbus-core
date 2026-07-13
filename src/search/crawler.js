import { extractMegaFolders } from "../extract/mega.js";
import { SYSTEM } from "../config.js";

const PRIVATE_HOST_PATTERNS = [
  /^localhost$/i,
  /\.localhost$/i,
  /\.local$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^198\.18\./,
  /^198\.19\./,
  /^224\./,
  /^24[0-9]\./,
  /^25[0-5]\./,
  /^\[?::1\]?$/i,
  /^\[?fc[0-9a-f]{2}:/i,
  /^\[?fd[0-9a-f]{2}:/i,
  /^\[?fe[89ab][0-9a-f]:/i
];

const ALLOWED_PORTS = new Set(["", "80", "443"]);
const MAX_REDIRECTS = 5;

export function assertPublicHttpUrl(value) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("unsupported_protocol");
  if (url.username || url.password) throw new Error("credentials_not_allowed");
  if (!ALLOWED_PORTS.has(url.port)) throw new Error("unsupported_port");
  if (PRIVATE_HOST_PATTERNS.some((pattern) => pattern.test(url.hostname))) {
    throw new Error("private_or_local_host");
  }
  return url;
}

async function readTextLimited(response, maxBytes) {
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > maxBytes) throw new Error("response_too_large");

  if (!response.body?.getReader) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > maxBytes) {
      throw new Error("response_too_large");
    }
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let total = 0;
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      throw new Error("response_too_large");
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();
  return text;
}

async function fetchWithValidatedRedirects(initialUrl, options) {
  let current = assertPublicHttpUrl(initialUrl);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const response = await fetch(current, { ...options, redirect: "manual" });
    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return { response, finalUrl: current.toString() };
    }

    const location = response.headers.get("location");
    if (!location) throw new Error("redirect_without_location");
    if (redirectCount === MAX_REDIRECTS) throw new Error("too_many_redirects");
    current = assertPublicHttpUrl(new URL(location, current).toString());
  }

  throw new Error("too_many_redirects");
}

export async function fetchPage(
  value,
  { timeoutMs = 8000, maxBytes = SYSTEM.maxResponseBytes } = {}
) {
  const url = assertPublicHttpUrl(value);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort("timeout"), timeoutMs);
  const started = Date.now();

  try {
    const { response, finalUrl } = await fetchWithValidatedRedirects(url, {
      headers: {
        "user-agent": "NimbusCore/36.0",
        "accept": "text/html,text/plain,application/json,application/rss+xml,application/xml;q=0.9,*/*;q=0.1"
      },
      signal: controller.signal
    });

    const contentType = response.headers.get("content-type") || "";
    if (!/text\/(html|plain)|application\/(json|rss\+xml|xml)/i.test(contentType)) {
      return { ok:false,status:response.status,contentType,finalUrl,text:"",latency:Date.now()-started,error:"unsupported_content_type" };
    }

    const text = await readTextLimited(response, maxBytes);
    return { ok:response.ok,status:response.status,contentType,finalUrl,text,latency:Date.now()-started,error:response.ok?null:`http_${response.status}` };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      status: 0,
      contentType: "",
      finalUrl: url.toString(),
      text: "",
      latency: Date.now() - started,
      error: message.includes("abort") ? "timeout" : message
    };
  } finally {
    clearTimeout(timer);
  }
}


export async function fetchAndExtract(value, options = {}) {
  const page = await fetchPage(value, options);
  return { ...page, links: extractMegaFolders(page.text || "", { allowLegacy: options.allowLegacy !== false }) };
}
