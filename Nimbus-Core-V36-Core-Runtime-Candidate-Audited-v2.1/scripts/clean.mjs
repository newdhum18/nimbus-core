import { rm } from "node:fs/promises";

for (const path of ["dist", ".wrangler"]) {
  await rm(path, { recursive: true, force: true });
}

console.log("Cleaned generated directories");
