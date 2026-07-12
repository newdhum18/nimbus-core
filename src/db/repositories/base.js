export function requireDb(db) {
  if (!db || typeof db.prepare !== "function") {
    throw new TypeError("A valid D1 database binding is required");
  }
  return db;
}

export function pageLimit(value, { defaultValue = 50, maximum = 100 } = {}) {
  const parsed = Number(value ?? defaultValue);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new RangeError(`limit must be an integer between 1 and ${maximum}`);
  }
  return parsed;
}

export function encodeCursor(row) {
  if (!row) return null;
  return btoa(JSON.stringify(row));
}

export function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const value = JSON.parse(atob(cursor));
    if (!value || typeof value !== "object") throw new Error("invalid cursor");
    return value;
  } catch {
    throw new TypeError("cursor is invalid");
  }
}
