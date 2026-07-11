import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const workerText = await readFile("wrangler.worker.jsonc", "utf8");
assert.doesNotMatch(workerText, /REPLACE_WITH_APPROVED_D1_DATABASE_ID/);
const worker = JSON.parse(workerText);
assert.match(
  worker.d1_databases[0].database_id,
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
);
console.log("Release configuration PASS");
