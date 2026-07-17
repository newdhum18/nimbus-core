import { decodeHtmlEntities, decodeRepeated, decodeUnicodeEscapes, normalizeMegaUrl } from "./normalize.js";

const MODERN_CANDIDATE = /https?:\/\/(?:www\.)?mega\.(?:nz|io)\/folder\/[A-Za-z0-9_-]+(?:#[A-Za-z0-9_\\-]{22})?(?:\/folder\/[A-Za-z0-9_-]+)?/gi;
const FILE_CANDIDATE = /https?:\/\/(?:www\.)?mega\.(?:nz|io)\/file\/[A-Za-z0-9_-]+(?:#[A-Za-z0-9_\\-]+)?/gi;
const LEGACY_SIGNAL = /https?:\/\/(?:www\.)?mega\.(?:nz|io)\/#F![A-Za-z0-9_-]+![A-Za-z0-9_\\-]+/gi;
const BASE64_TOKEN = /(?:^|[^A-Za-z0-9+/_-])([A-Za-z0-9+/_-]{32,684}={0,2})(?=$|[^A-Za-z0-9+/_=-])/g;
const MAX_VARIANTS = 48;
const MAX_BASE64_ROUNDS = 2;

function decodeBase64(value) {
  try {
    const normalized = String(value).replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
    const raw = atob(padded);
    const bytes = Uint8Array.from(raw, (char) => char.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch { return ""; }
}

function addVariant(set, value) {
  if (set.size >= MAX_VARIANTS) return;
  const text = String(value ?? "");
  if (text && text.length <= 2_000_000) set.add(text);
}

function decodedVariants(input) {
  const raw = String(input ?? "").replace(/[\u200B-\u200D\u2060\uFEFF]/g, "");
  const variants = new Set();
  addVariant(variants, raw);
  addVariant(variants, decodeHtmlEntities(raw));
  addVariant(variants, decodeUnicodeEscapes(raw));
  addVariant(variants, decodeRepeated(raw));

  for (const source of [...variants]) {
    const compact = source
      .replaceAll("\\/", "/")
      .replaceAll("\\_", "_")
      .replace(/<[^>]{0,160}>/g, "")
      .replace(/https?\s*:\s*\/\s*\//gi, (match) => match.replace(/\s/g, ""))
      .replace(/mega\s*\.\s*(nz|io)/gi, "mega.$1")
      .replace(/\/\s*folder\s*\//gi, "/folder/")
      .replace(/\s*#\s*/g, "#");
    addVariant(variants, compact);
    addVariant(variants, decodeRepeated(compact));
  }

  for (let round = 0; round < MAX_BASE64_ROUNDS; round += 1) {
    const before = variants.size;
    for (const source of [...variants]) {
      BASE64_TOKEN.lastIndex = 0;
      for (const match of source.matchAll(BASE64_TOKEN)) {
        const decoded = decodeBase64(match[1]);
        if (/mega\.(?:nz|io)|https?:\/\//i.test(decoded)) {
          addVariant(variants, decoded);
          addVariant(variants, decodeRepeated(decoded));
        }
        if (variants.size >= MAX_VARIANTS) break;
      }
      if (variants.size >= MAX_VARIANTS) break;
    }
    if (variants.size === before) break;
  }
  return variants;
}

function splitModernCandidate(value) {
  const normalized = normalizeMegaUrl(value);
  const match = normalized.match(/^https:\/\/mega\.nz\/folder\/([A-Za-z0-9_-]+)#([A-Za-z0-9_-]{22})(?:\/folder\/([A-Za-z0-9_-]+))?$/);
  if (!match) return null;
  const [, folderId, key, subfolderId] = match;
  if (folderId.length < 8 || folderId.length > 16 || key.length !== 22) return null;
  return {
    valid: true,
    type: "folder",
    normalizedUrl: `https://mega.nz/folder/${folderId}#${key}`,
    folderId,
    key,
    subfolderId: subfolderId || null,
    hasKey: true
  };
}

export function classifyMegaFolder(url) {
  const normalized = normalizeMegaUrl(url);
  if (/^https:\/\/mega\.nz\/file\//i.test(normalized)) return { valid: false, type: "file", normalizedUrl: normalized, hasKey: /#.+/.test(normalized) };
  if (/^https:\/\/mega\.nz\/#F!/i.test(normalized)) return { valid: false, type: "legacy_folder", normalizedUrl: normalized, hasKey: true };
  const modern = splitModernCandidate(normalized);
  if (modern) return modern;
  const missingKey = normalized.match(/^https:\/\/mega\.nz\/folder\/([A-Za-z0-9_-]+)$/i);
  return { valid: false, type: missingKey ? "missing_key" : null, normalizedUrl: normalized, hasKey: false };
}

export function extractMegaFolders(input) {
  const accepted = new Map();
  for (const text of decodedVariants(input)) {
    MODERN_CANDIDATE.lastIndex = 0;
    for (const match of text.matchAll(MODERN_CANDIDATE)) {
      const result = classifyMegaFolder(match[0]);
      if (result.valid && !accepted.has(result.normalizedUrl)) accepted.set(result.normalizedUrl, result);
    }
  }
  return [...accepted.values()];
}

export function inspectMegaSignals(input) {
  let fileSignals = 0;
  let legacySignals = 0;
  for (const text of decodedVariants(input)) {
    FILE_CANDIDATE.lastIndex = 0;
    LEGACY_SIGNAL.lastIndex = 0;
    fileSignals += [...text.matchAll(FILE_CANDIDATE)].length;
    legacySignals += [...text.matchAll(LEGACY_SIGNAL)].length;
  }
  return { accepted: extractMegaFolders(input), fileSignals, legacySignals };
}
