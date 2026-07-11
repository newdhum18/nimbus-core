import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import net from "node:net";

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: options.stdio || "inherit" });
    child.on("error", reject);
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`${command} exited with ${code}`)));
  });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function waitFor(url, attempts = 40) {
  let lastError;
  for (let index = 0; index < attempts; index += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return response;
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw lastError || new Error(`Timed out waiting for ${url}`);
}

await rm(".wrangler", { recursive: true, force: true });
await mkdir(".wrangler", { recursive: true });
const config = JSON.parse(await readFile("wrangler.worker.jsonc", "utf8"));
config.d1_databases[0].database_id = "00000000-0000-0000-0000-000000000000";
const configPath = ".validation.runtime.json";
await writeFile(configPath, JSON.stringify(config, null, 2));

const port = await freePort();
let worker;

try {
  await run("npx", [
    "wrangler", "d1", "execute", "nimbus-core-v36-db", "--local",
    "--persist-to", ".wrangler/state", "--file=src/db/schema.sql", "--config", configPath
  ]);

  worker = spawn(process.execPath, [
    "node_modules/wrangler/bin/wrangler.js", "dev", "--local",
    "--persist-to", ".wrangler/state", "--port", String(port), "--config", configPath
  ], { stdio: "ignore", detached: true });

  const base = `http://127.0.0.1:${port}`;
  const healthResponse = await waitFor(`${base}/health`);
  const health = await healthResponse.json();
  if (!health.ok || health.service !== "nimbus-core-v36-worker") throw new Error("health validation failed");

  const bindings = await (await fetch(`${base}/bindings`)).json();
  if (!bindings.ok || !bindings.db || !bindings.queue) throw new Error("bindings validation failed");

  const dbTest = await (await fetch(`${base}/api/foundation/db-test`)).json();
  if (!dbTest.ok || dbTest.value !== 1) throw new Error("D1 runtime validation failed");

  const reset = await (await fetch(`${base}/api/sources/reset`, { method: "POST" })).json();
  if (!reset.ok || reset.total !== 300 || reset.enabled !== 80) throw new Error("source seed validation failed");

  const diagnostics = await (await fetch(`${base}/api/diagnostics`)).json();
  if (!diagnostics.ok || diagnostics.sources?.total !== 300 || diagnostics.sources?.enabled !== 80) {
    throw new Error("diagnostics validation failed");
  }

  console.log("Local Worker runtime validation PASS");
} finally {
  if (worker && !worker.killed) {
    try { process.kill(-worker.pid, "SIGTERM"); } catch {}
  }
  await new Promise((resolve) => setTimeout(resolve, 300));
  await rm(configPath, { force: true });
  await rm(".wrangler", { recursive: true, force: true });
}
