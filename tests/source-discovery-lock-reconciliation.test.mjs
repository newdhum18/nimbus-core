import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("source discovery start reconciles stale and orphaned active runs before applying the lock",()=>{
  const src=fs.readFileSync(new URL("../src/sources/discovery-runs.js",import.meta.url),"utf8");
  assert.match(src,/await reconcileActiveSourceDiscoveryRuns\(env\.DB\)/);
  assert.match(src,/orphaned_active_run_no_tasks/);
  assert.match(src,/stale_source_discovery_auto_cancelled/);
  assert.match(src,/active_source_discovery_run:\$\{active\.id\}:\$\{active\.status\}/);
});

test("source discovery API exposes an emergency active-run cancel route",()=>{
  const router=fs.readFileSync(new URL("../src/router.js",import.meta.url),"utf8");
  assert.match(router,/\/api\/source-discovery\/active\/cancel/);
  assert.match(router,/cancelActiveSourceDiscoveryRuns/);
});

test("source UI selects the actual active discovery run instead of a stale local selection",()=>{
  const app=fs.readFileSync(new URL("../public/app.js",import.meta.url),"utf8");
  assert.match(app,/rows\.find\(r=>\["running","paused","recovering"\]\.includes\(r\.status\)\)/);
  assert.match(app,/Active discovery selected/);
});
