import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import net from "node:net";

const sleep = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: options.stdio || "inherit",
      env: { ...process.env, ...(options.env || {}) }
    });

    child.once("error", reject);

    child.once("exit", (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `${command} exited with code ${code ?? "null"}${
            signal ? ` and signal ${signal}` : ""
          }`
        )
      );
    });
  });
}

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once("error", reject);

    server.listen(0, "127.0.0.1", () => {
      const address = server.address();

      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Unable to allocate a local TCP port"));
        return;
      }

      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(address.port);
      });
    });
  });
}

async function waitForWorker({
  url,
  processState,
  attempts = 60,
  delayMs = 500
}) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    if (processState.exited) {
      throw new Error(
        [
          "Wrangler exited before the local Worker became ready.",
          `Exit code: ${processState.code ?? "null"}`,
          `Signal: ${processState.signal ?? "none"}`,
          "",
          "Wrangler output:",
          processState.output || "(no output captured)"
        ].join("\n")
      );
    }

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(2000)
      });

      if (response.ok) return response;

      lastError = new Error(
        `Worker returned HTTP ${response.status} while waiting for ${url}`
      );
    } catch (error) {
      lastError = error;
    }

    await sleep(delayMs);
  }

  throw new Error(
    [
      `Timed out waiting for local Worker at ${url}.`,
      `Last error: ${lastError?.message || "unknown error"}`,
      "",
      "Wrangler output:",
      processState.output || "(no output captured)"
    ].join("\n")
  );
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    signal: AbortSignal.timeout(5000)
  });

  const text = await response.text();

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(
      `Expected JSON from ${url}, received HTTP ${response.status}: ${text}`
    );
  }

  if (!response.ok) {
    throw new Error(
      `Request to ${url} failed with HTTP ${response.status}: ${text}`
    );
  }

  return payload;
}

async function stopProcessGroup(worker, processState) {
  if (!worker || processState.exited) return;

  try {
    process.kill(-worker.pid, "SIGTERM");
  } catch {
    try {
      worker.kill("SIGTERM");
    } catch {}
  }

  await Promise.race([
    new Promise((resolve) => worker.once("exit", resolve)),
    sleep(5000)
  ]);

  if (!processState.exited) {
    try {
      process.kill(-worker.pid, "SIGKILL");
    } catch {
      try {
        worker.kill("SIGKILL");
      } catch {}
    }

    await Promise.race([
      new Promise((resolve) => worker.once("exit", resolve)),
      sleep(3000)
    ]);
  }

  await sleep(1000);
}

await rm(".wrangler", { recursive: true, force: true });
await mkdir(".wrangler", { recursive: true });

const originalConfig = await readFile("wrangler.worker.jsonc", "utf8");
const config = JSON.parse(originalConfig);

config.d1_databases[0].database_id =
  "00000000-0000-0000-0000-000000000000";

const configPath = ".validation.runtime.json";
await writeFile(configPath, JSON.stringify(config, null, 2));

const port = await freePort();

const processState = {
  exited: false,
  code: null,
  signal: null,
  output: ""
};

let worker;

try {
  await run("wrangler", [
    "d1",
    "execute",
    "nimbus-core-v36-db",
    "--local",
    "--persist-to",
    ".wrangler/state",
    "--file=src/db/schema.sql",
    "--config",
    configPath
  ]);

  worker = spawn(
    "wrangler",
    [
      "dev",
      "--local",
      "--ip",
      "127.0.0.1",
      "--port",
      String(port),
      "--persist-to",
      ".wrangler/state",
      "--config",
      configPath
    ],
    {
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        CI: "true"
      },
      detached: true
    }
  );

  const captureOutput = (chunk) => {
    const text = chunk.toString();
    processState.output += text;
    process.stdout.write(text);
  };

  worker.stdout.on("data", captureOutput);
  worker.stderr.on("data", captureOutput);

  worker.once("error", (error) => {
    processState.exited = true;
    processState.output += `\nWorker process error: ${error.message}\n`;
  });

  worker.once("exit", (code, signal) => {
    processState.exited = true;
    processState.code = code;
    processState.signal = signal;
  });

  const base = `http://127.0.0.1:${port}`;

  const healthResponse = await waitForWorker({
    url: `${base}/health`,
    processState
  });

  const health = await healthResponse.json();

  if (!health.ok || health.service !== "nimbus-core-v36-worker") {
    throw new Error(
      `Health validation failed: ${JSON.stringify(health)}`
    );
  }

  const bindings = await fetchJson(`${base}/bindings`);

  if (!bindings.ok || !bindings.db || !bindings.queue) {
    throw new Error(
      `Bindings validation failed: ${JSON.stringify(bindings)}`
    );
  }

  const dbTest = await fetchJson(`${base}/api/foundation/db-test`);

  if (!dbTest.ok || dbTest.value !== 1) {
    throw new Error(
      `D1 runtime validation failed: ${JSON.stringify(dbTest)}`
    );
  }

  const reset = await fetchJson(`${base}/api/sources/reset`, {
    method: "POST"
  });

  if (!reset.ok || reset.total !== 300 || reset.enabled !== 80) {
    throw new Error(
      `Source seed validation failed: ${JSON.stringify(reset)}`
    );
  }

  const diagnostics = await fetchJson(`${base}/api/diagnostics`);

  if (
    !diagnostics.ok ||
    diagnostics.sources?.total !== 300 ||
    diagnostics.sources?.enabled !== 80
  ) {
    throw new Error(
      `Diagnostics validation failed: ${JSON.stringify(diagnostics)}`
    );
  }

  console.log("Local Worker runtime validation PASS");
} finally {
  await stopProcessGroup(worker, processState);

  await rm(configPath, { force: true });

  // لا نحذف .wrangler هنا فورًا؛ لأن Wrangler قد يكمل إغلاق
  // عمليات داخلية قصيرة بعد توقف الخادم.
  await sleep(1500);
  await rm(".wrangler", { recursive: true, force: true });
}
