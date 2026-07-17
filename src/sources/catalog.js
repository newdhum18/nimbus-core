/**
 * Nimbus Core V37.1 approved source catalog.
 *
 * Policy: this catalog contains only the six note/paste domains that were
 * manually verified and approved. Every row is one real discovery surface;
 * obsolete indexes, archives, aggregators, code hosts and unverified paste
 * services were intentionally removed.
 */
const S = (id, name, domain, priority, rankScore) => ({
  id,
  name,
  domain,
  category: "approved-note",
  sourceType: "html",
  templateUrl: `https://lite.duckduckgo.com/lite/?q=site%3A${encodeURIComponent(domain)}%20{q}%20%22mega.nz%2Ffolder%2F%22`,
  enabled: true,
  defaultEnabled: true,
  priority,
  rankScore,
  access: {
    discovery: "search-index",
    fetch: "direct-http",
    extraction: "visible-text+href+html",
    loginRequired: false,
    javascriptRequired: false,
    followIntermediates: false
  }
});

const CATALOG = Object.freeze([
  S("approved_rentry", "Rentry", "rentry.co", 1600, 100),
  S("approved_controlc", "ControlC", "controlc.com", 1590, 98),
  S("approved_justpaste", "JustPaste.it", "justpaste.it", 1580, 96),
  S("approved_telegra", "Telegraph", "telegra.ph", 1570, 94),
  S("approved_pastemode", "Pastemode", "pastemode.com", 1560, 92),
  S("approved_pastelink", "Pastelink", "pastelink.net", 1550, 90)
]);

export const APPROVED_NOTE_DOMAINS = Object.freeze(CATALOG.map((row) => row.domain));

export function sourceCatalog() {
  const rows = CATALOG.map((row) => ({ ...row, access: { ...row.access } }));
  const ids = new Set(rows.map((row) => row.id));
  const templates = new Set(rows.map((row) => row.templateUrl));
  const domains = new Set(rows.map((row) => row.domain));
  if (ids.size !== rows.length) throw new Error("Duplicate source IDs in approved catalog");
  if (templates.size !== rows.length) throw new Error("Duplicate source templates in approved catalog");
  if (domains.size !== rows.length) throw new Error("Duplicate domains in approved catalog");
  if (rows.some((row) => !row.enabled || !row.defaultEnabled)) throw new Error("Approved source disabled unexpectedly");
  return rows;
}
