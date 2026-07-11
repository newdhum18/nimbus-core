import { decodeHtmlEntities, decodeRepeated, normalizeMegaUrl } from "./normalize.js";

const MODERN = /https?:\/\/(?:www\.)?mega\.nz\/folder\/([A-Za-z0-9_-]{8})#([A-Za-z0-9_-]{22,64})/gi;
const LEGACY = /https?:\/\/(?:www\.)?mega\.nz\/#F!([A-Za-z0-9_-]{8})!([A-Za-z0-9_-]{22,64})/gi;

export function classifyMegaFolder(url, { allowLegacy = true } = {}) {
  const normalized = normalizeMegaUrl(url);
  if (/^https:\/\/mega\.nz\/file\//i.test(normalized)) {
    return { valid: false, type: "file", normalizedUrl: normalized, hasKey: false };
  }

  const modern = /^https:\/\/mega\.nz\/folder\/([A-Za-z0-9_-]{8})#([A-Za-z0-9_-]{22,64})$/.exec(normalized);
  if (modern) {
    return { valid: true, type: "folder", normalizedUrl: normalized, hasKey: true };
  }

  if (allowLegacy) {
    const legacy = /^https:\/\/mega\.nz\/#F!([A-Za-z0-9_-]{8})!([A-Za-z0-9_-]{22,64})$/.exec(normalized);
    if (legacy) {
      return { valid: true, type: "legacy_folder", normalizedUrl: normalized, hasKey: true };
    }
  }

  return { valid: false, type: null, normalizedUrl: normalized, hasKey: false };
}

export function extractMegaFolders(input, options = {}) {
  const raw = String(input ?? "");
  const variants = new Set([
    raw,
    decodeHtmlEntities(raw),
    decodeRepeated(raw)
  ]);
  const candidates = [];

  for (const text of variants) {
    for (const regex of [MODERN, ...(options.allowLegacy === false ? [] : [LEGACY])]) {
      regex.lastIndex = 0;
      for (const match of text.matchAll(regex)) candidates.push(match[0]);
    }
  }

  const unique = new Map();
  for (const candidate of candidates) {
    const classified = classifyMegaFolder(candidate, options);
    if (classified.valid) unique.set(classified.normalizedUrl, classified);
  }
  return [...unique.values()];
}
