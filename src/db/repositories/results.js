import { first, all, run, nowIso, uid } from "../queries.js";
import { requireDb, pageLimit } from "./base.js";

export async function upsertPage(db, page) {
  requireDb(db);
  const id = page.id || uid("page");
  await run(db, `
    INSERT INTO pages(id,run_id,source_id,url,normalized_url,title,status_code,content_type,crawl_depth,fetched_at,error_message)
    VALUES(?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(run_id,normalized_url) DO UPDATE SET
      source_id=excluded.source_id,url=excluded.url,title=excluded.title,status_code=excluded.status_code,
      content_type=excluded.content_type,crawl_depth=excluded.crawl_depth,fetched_at=excluded.fetched_at,
      error_message=excluded.error_message
  `, [id,page.run_id,page.source_id ?? null,page.url,page.normalized_url,page.title ?? null,page.status_code ?? null,page.content_type ?? null,page.crawl_depth ?? 0,page.fetched_at ?? nowIso(),page.error_message ?? null]);
  return first(db, "SELECT * FROM pages WHERE run_id=? AND normalized_url=?", [page.run_id,page.normalized_url]);
}

export async function upsertLink(db, link) {
  requireDb(db);
  const id = link.id || uid("link");
  await run(db, `
    INSERT INTO links(id,run_id,page_id,source_id,url,normalized_url,link_type,has_key,validation_status,is_complete,discovered_at,checked_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(run_id,normalized_url) DO UPDATE SET
      page_id=COALESCE(excluded.page_id,links.page_id),source_id=COALESCE(excluded.source_id,links.source_id),
      url=excluded.url,link_type=excluded.link_type,has_key=excluded.has_key,
      validation_status=excluded.validation_status,is_complete=excluded.is_complete,
      checked_at=COALESCE(excluded.checked_at,links.checked_at)
  `, [id,link.run_id,link.page_id ?? null,link.source_id ?? null,link.url,link.normalized_url,link.link_type,link.has_key ? 1 : 0,link.validation_status ?? "unchecked",link.is_complete ? 1 : 0,link.discovered_at ?? nowIso(),link.checked_at ?? null]);
  return first(db, "SELECT * FROM links WHERE run_id=? AND normalized_url=?", [link.run_id,link.normalized_url]);
}

export async function listLinks(db, { runId, limit = 50, offset = 0 } = {}) {
  requireDb(db);
  limit = pageLimit(limit);
  if (!Number.isInteger(offset) || offset < 0) throw new RangeError("offset must be a non-negative integer");
  if (runId) return (await all(db, "SELECT * FROM links WHERE run_id=? ORDER BY discovered_at DESC,id DESC LIMIT ? OFFSET ?", [runId,limit,offset])).results || [];
  return (await all(db, "SELECT * FROM links ORDER BY discovered_at DESC,id DESC LIMIT ? OFFSET ?", [limit,offset])).results || [];
}
