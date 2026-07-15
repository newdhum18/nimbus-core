import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("source discovery start reconciles stale active runs before applying the lock",()=>{
  const src=fs.readFileSync(new URL("../src/sources/discovery-runs.js",import.meta.url),"utf8");
  assert.match(src,/await sourceDiscoveryRun\(env\.DB,active\.id\)/);
  assert.match(src,/active_source_discovery_run:\$\{active\.id\}:\$\{active\.status\}/);
  assert.match(src,/ORDER BY updated_at DESC LIMIT 1/);
});
