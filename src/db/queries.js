export async function first(db, sql, params = []) {
  return db.prepare(sql).bind(...params).first();
}

export async function all(db, sql, params = []) {
  return db.prepare(sql).bind(...params).all();
}

export async function run(db, sql, params = []) {
  return db.prepare(sql).bind(...params).run();
}

export function nowIso() {
  return new Date().toISOString();
}

export function uid(prefix) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "")}`;
}
