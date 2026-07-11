import { AppError } from "../api/errors.js";

function escapeCsv(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export async function listResults(db, runId, { limit = 100, offset = 0 } = {}) {
  const run = await db.prepare("SELECT id,status FROM runs WHERE id=?").bind(runId).first();
  if (!run) throw new AppError("RUN_NOT_FOUND", "Run was not found", "results", 404, { run_id: runId });

  const rows = await db.prepare(`
    SELECT l.id,l.url,l.normalized_url,l.link_type,l.validation_status,
           l.is_complete,l.discovered_at,l.checked_at,
           p.url source_page_url,s.name source_name
    FROM links l
    LEFT JOIN pages p ON p.id=l.page_id
    LEFT JOIN sources s ON s.id=l.source_id
    WHERE l.run_id=?
    ORDER BY l.discovered_at DESC
    LIMIT ? OFFSET ?
  `).bind(runId, limit, offset).all();

  const count = await db.prepare("SELECT COUNT(*) count FROM links WHERE run_id=?").bind(runId).first();
  return { run_id: runId, run_status: run.status, total: Number(count?.count || 0), results: rows.results || [] };
}

export function resultsToCsv(results) {
  const headers = [
    "url","link_type","validation_status","is_complete","source_name","source_page_url","discovered_at","checked_at"
  ];
  const lines = [headers.join(",")];
  for (const row of results) {
    lines.push(headers.map((key) => escapeCsv(row[key])).join(","));
  }
  return `${lines.join("\n")}\n`;
}
