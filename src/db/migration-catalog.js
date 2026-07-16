export const MIGRATIONS = Object.freeze([
  {
    "version": 1,
    "name": "initial_database_core",
    "file": "src/db/migrations/0001_initial.sql",
    "checksum": "fd4418507ca134441918b49648505fc59d3389d2e2fe067a7f2b2f46ddf712c4"
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
  }  ,{
    "version": 6,
    "name": "autonomous_source_discovery",
    "file": "src/db/migrations/0006_source_discovery.sql",
    "checksum": "92a5e90dadf95bc5834b6cf7ab3a79a4c915eda73000227529c7d946d051952d"
  },
  {
    "version": 7,
    "name": "queue_optimizer_and_link_validation",
    "file": "src/db/migrations/0007_queue_and_validation.sql",
    "checksum": "6219671f3d8508ccd70a7cd5ad91fa59d4a8e7ac56450bbc0216a932297d3b85"
  },
  {
    "version": 8,
    "name": "source_intelligence_center",
    "file": "src/db/migrations/0008_source_intelligence_center.sql",
    "checksum": "5174e1a94ead46a2291e7cf1b86263bb4602b9d1f4cc1e20c5649b1f96e91328"
  }  ,{
    "version": 9,
    "name": "source_discovery_background_runtime",
    "file": "src/db/migrations/0009_source_discovery_runtime.sql",
    "checksum": "49ec1dd8498487d82b647b3d20f691322375fd8612286cb0d19084397283baac"
  },
  {
    "version": 10,
    "name": "zero_foundation_hardening",
    "file": "src/db/migrations/0010_zero_foundation_hardening.sql",
    "checksum": "cdffe6acf6b44f34fecef3e5571d325fff1bacd635c1c7942305e2952f0082cc"
  }
  ,{
    "version": 11,
    "name": "source_candidate_provenance_fix",
    "file": "src/db/migrations/0011_source_candidate_provenance_fix.sql",
    "checksum": "8cd43787a33ac17309eac3de99a59086141046b96891c2003ae506ba60bb4b1d"
  }
  ,{
    "version": 12,
    "name": "source_auto_promotion",
    "file": "src/db/migrations/0012_source_auto_promotion.sql",
    "checksum": "3d0626c9967ee3d43046da8582bd9a52c8104211117448f22eded9b1dee2f6ed"
  }
  ,{
    "version": 13,
    "name": "pastetoday_extraction_runtime",
    "file": "src/db/migrations/0013_pastetoday_extraction_runtime.sql",
    "checksum": "4def322cd1556cc403f5e3d488adf1d6208838a7c564595e2ca49f3bd4612ce9"
  }
].map(Object.freeze));
export const EXPECTED_SCHEMA_VERSION = MIGRATIONS.at(-1)?.version ?? 0;
