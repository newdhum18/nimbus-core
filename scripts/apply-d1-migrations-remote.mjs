import { spawnSync } from 'node:child_process';

const MAX_ATTEMPTS = Number(process.env.D1_MIGRATION_MAX_ATTEMPTS || 5);
const BASE_DELAY_MS = Number(process.env.D1_MIGRATION_RETRY_DELAY_MS || 8000);
const args = [
  'wrangler', 'd1', 'migrations', 'apply', 'nimbus-core-v36-db',
  '--remote', '--config', 'wrangler.worker.jsonc'
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
  console.log(`D1 migration attempt ${attempt}/${MAX_ATTEMPTS}`);
  const result = spawnSync('npx', args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: process.env
  });

  if (result.status === 0) {
    console.log('Remote D1 migrations completed successfully.');
    process.exit(0);
  }

  if (attempt === MAX_ATTEMPTS) {
    console.error(`Remote D1 migrations failed after ${MAX_ATTEMPTS} attempts.`);
    process.exit(result.status || 1);
  }

  const delay = BASE_DELAY_MS * attempt;
  console.warn(`Remote D1 migration command failed (exit ${result.status ?? 'unknown'}). Retrying in ${delay / 1000}s...`);
  await sleep(delay);
}
