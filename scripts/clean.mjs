import { rm } from "node:fs/promises";

for (const path of ["dist", ".wrangler", ".validation.cloudflare.json", ".validation.runtime.json"]) {
  await rm(path, { recursive: true, force: true });
}

console.log("Cleaned generated directories");
