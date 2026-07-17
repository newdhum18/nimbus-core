import { classifyMegaFolder } from "../extract/mega.js";
import { nowIso } from "../db/queries.js";

/**
 * V37.0 performs structural validation only. It deliberately does not fetch,
 * open, download, or inspect MEGA destinations. A separate, explicitly
 * approved future phase may add bounded availability checks.
 */
export async function validateMegaFolderUrl(value) {
  const shape = classifyMegaFolder(value);
  if (!shape.valid) {
    return { status: "invalid", reason: "invalid_link_shape", http_status: null };
  }
  return {
    status: "structurally_valid",
    reason: "structural_validation_only_v37_0",
    http_status: null
  };
}

export async function validateStoredLinks(db, { runId = null, limit = 20 } = {}) {
  const rows = await db.prepare(`
    SELECT id,normalized_url FROM links
    WHERE (? IS NULL OR run_id=?)
      AND validation_status IN ('structurally_valid','unchecked','unknown','pending','valid')
    ORDER BY discovered_at DESC LIMIT ?
  `).bind(runId, runId, limit).all();

  const results = [];
  for (const row of rows.results || []) {
    const verdict = await validateMegaFolderUrl(row.normalized_url);
    await db.prepare(`
      UPDATE links
      SET validation_status=?,validation_error=?,validation_http_status=?,validated_at=?
      WHERE id=?
    `).bind(verdict.status, verdict.reason, verdict.http_status, nowIso(), row.id).run();
    results.push({ id: row.id, url: row.normalized_url, ...verdict });
  }
  return { checked: results.length, results };
}
