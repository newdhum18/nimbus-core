import { readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
  });
}

await rm(".wrangler", { recursive: true, force: true });
const config = JSON.parse(await readFile("wrangler.worker.jsonc", "utf8"));
config.d1_databases[0].database_id = "00000000-0000-0000-0000-000000000000";
const validationConfig = ".validation.cloudflare.json";
await writeFile(validationConfig, JSON.stringify(config, null, 2));

try {
  await run("npx", ["wrangler", "deploy", "--dry-run", "--outdir", ".wrangler/dry-run", "--config", validationConfig]);
  await run("npx", ["wrangler", "d1", "execute", "nimbus-core-v36-db", "--local", "--persist-to", ".wrangler/state", "--file=src/db/schema.sql", "--config", validationConfig]);
  await run("npx", ["wrangler", "d1", "execute", "nimbus-core-v36-db", "--local", "--persist-to", ".wrangler/state", "--file=src/db/schema.sql", "--config", validationConfig]);
  console.log("Cloudflare dry-run and D1 idempotency validation PASS");
} finally {
  await rm(validationConfig, { force: true });
  await rm(".wrangler", { recursive: true, force: true });
}
