export const MIGRATIONS = Object.freeze([
  {
    "version": 1,
    "name": "initial_database_core",
    "file": "src/db/migrations/0001_initial.sql",
    "checksum": "ff9ecdf2d4aac215977721b3357bab5ab81dfa9257702d3518a13e02c9da3953"
  },
  {
    "version": 2,
    "name": "task_identity_null_safe",
    "file": "src/db/migrations/0002_task_identity.sql",
    "checksum": "8e26cad2244058d8b979941e815b86f98a9882ecadeeccd1d0d0bb1354c0d316"
  },
  {
    "version": 3,
    "name": "deterministic_source_seed",
    "file": "src/db/migrations/0003_source_seed.sql",
    "checksum": "c9bdfb94788ea22577cf6dfb61c315199c9d6b6321c17d93dac8e48bf2ff70d4"
  },
  {
    "version": 4,
    "name": "autonomous_source_intelligence",
    "file": "src/db/migrations/0004_source_intelligence.sql",
    "checksum": "e77100a405e8998a9347331dc7b6a7839dbfb17feb07f26e914221dbf8af4f83"
  },
  {
    "version": 5,
    "name": "adaptive_keyword_intelligence",
    "file": "src/db/migrations/0005_keyword_intelligence.sql",
    "checksum": "545d92d4c4ae66dd0867e304d8fd7779df7fe09b614ec88c8506eb6770778e2e"
  }
].map(Object.freeze));
export const EXPECTED_SCHEMA_VERSION = MIGRATIONS.at(-1)?.version ?? 0;
