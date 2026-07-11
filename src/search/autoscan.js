export const AUTOSCAN_QUERIES = Object.freeze([
  "",
  "archive",
  "collection",
  "public"
]);

export function autoscanQuery(round = 0) {
  const index = Number.isInteger(Number(round)) ? Math.max(0, Number(round)) : 0;
  return AUTOSCAN_QUERIES[index % AUTOSCAN_QUERIES.length];
}
