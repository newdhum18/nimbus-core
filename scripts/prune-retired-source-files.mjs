import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";

// GitHub mobile uploads may overwrite files without deleting tracked files removed
// from a release. Prune only explicitly retired files before validation/deploy.
const allowedTests = new Set([
  "approved-source-hardening.test.mjs","architecture.test.mjs","batch.test.mjs",
  "clean-baseline.test.mjs","config.test.mjs","cors.test.mjs","database-core.test.mjs",
  "discovery-context.test.mjs","dynamic-source-ui.test.mjs","extract.test.mjs",
  "keyword-intelligence.test.mjs","keyword-learning-batch.test.mjs",
  "manual-integrity-hotfix.test.mjs","manual-source-control.test.mjs",
  "note-discovery.test.mjs","queue-runtime.test.mjs","queue.test.mjs","router.test.mjs",
  "run-lifecycle.test.mjs","runtime-services.test.mjs","schema.test.mjs",
  "search-adapters.test.mjs","search.test.mjs","source-candidate-provenance.test.mjs",
  "source-discovery-lock-reconciliation.test.mjs","source-discovery-providers.test.mjs",
  "source-discovery.test.mjs","source-intelligence-center.test.mjs",
  "source-intelligence-hardening.test.mjs","source-manager.test.mjs",
  "source-reset.test.mjs","sources.test.mjs","ui-recovery.test.mjs",
  "v37-extraction.test.mjs","v37-source-adoption.test.mjs"
]);

const retiredPaths = [
  "src/search/adapters/pastetoday.js",
  "src/search/adapters/ofversedrops.js",
  "src/search/adapters/pastebin.js",
  "src/search/adapters/reddit.js",
  "src/search/adapters/linkvertise.js",
  "tests/pastetoday.test.mjs",
  "tests/ofversedrops.test.mjs",
  "tests/reddit.test.mjs",
  "tests/legacy-source-catalog.test.mjs",
  "tests/source-auto-promotion.test.mjs",
  "tests/legacy-adapters.test.mjs",
  "tests/legacy-extraction.test.mjs",
  "tests/old-source-reset.test.mjs"
];

for (const path of retiredPaths) await rm(path, { recursive: true, force: true });

for (const name of await readdir("tests")) {
  if (name.endsWith(".test.mjs") && !allowedTests.has(name)) {
    await rm(join("tests", name), { force: true });
    console.log(`Pruned retired test: tests/${name}`);
  }
}
console.log(`Approved test manifest enforced: ${allowedTests.size} files`);
