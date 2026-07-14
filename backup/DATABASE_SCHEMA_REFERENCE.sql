-- Nimbus Core V36 schema reference generated from the clean baseline database.

CREATE INDEX idx_candidate_domains_promotion ON source_candidate_domains(state,successful_fetches,pages_tested,confidence,blocked_fetches,last_seen_at DESC);

CREATE INDEX idx_candidate_domains_state ON source_candidate_domains(state,quality_grade,confidence DESC,last_seen_at DESC);

CREATE INDEX idx_dead_tasks_run ON dead_tasks(run_id, created_at DESC, id DESC);

CREATE INDEX idx_events_recent ON events(created_at DESC, id DESC);

CREATE INDEX idx_events_run ON events(run_id, created_at DESC, id DESC);

CREATE INDEX idx_events_task ON events(task_id, created_at DESC);

CREATE INDEX idx_links_normalized ON links(normalized_url);

CREATE INDEX idx_links_run ON links(run_id,discovered_at DESC,id DESC);

CREATE INDEX idx_links_validation ON links(validation_status,validated_at);

CREATE INDEX idx_pages_run ON pages(run_id, fetched_at DESC, id DESC);

CREATE INDEX idx_pages_source ON pages(source_id, fetched_at DESC);

CREATE INDEX idx_runs_created_at ON runs(created_at DESC, id DESC);

CREATE UNIQUE INDEX idx_runs_single_active
ON runs((1)) WHERE status IN ('running','paused','recovering');

CREATE INDEX idx_runs_status_updated ON runs(status, updated_at DESC);

CREATE INDEX idx_search_terms_category_score ON search_terms(category,enabled,score DESC,hits DESC);

CREATE INDEX idx_source_candidates_autoscan_run ON source_candidates(discovered_from_autoscan_run_id,last_seen_at DESC);

CREATE INDEX idx_source_candidates_discovery_run ON source_candidates(discovered_from_discovery_run_id,last_seen_at DESC);

CREATE INDEX idx_source_candidates_host ON source_candidates(host,state);

CREATE INDEX idx_source_candidates_state ON source_candidates(state,confidence DESC,last_seen_at DESC);

CREATE INDEX idx_source_discovery_dispatch ON source_discovery_tasks(run_id,status,lease_until,priority DESC,created_at ASC);

CREATE INDEX idx_source_discovery_fingerprint ON source_discovery_tasks(input_fingerprint,run_id);

CREATE INDEX idx_source_discovery_runs_recent ON source_discovery_runs(created_at DESC);

CREATE UNIQUE INDEX idx_source_discovery_single_active
ON source_discovery_runs((1)) WHERE status IN ('running','paused','recovering');

CREATE INDEX idx_source_discovery_tasks_run ON source_discovery_tasks(run_id,status,priority DESC,created_at ASC);

CREATE INDEX idx_source_graph_fingerprint ON source_graph_edges(mega_fingerprint,evidence_count DESC,last_seen_at DESC);

CREATE INDEX idx_source_graph_from_source ON source_graph_edges(from_source_id,last_seen_at DESC);

CREATE INDEX idx_source_graph_host ON source_graph_edges(to_host,evidence_count DESC,last_seen_at DESC);

CREATE INDEX idx_source_metrics_intelligence ON source_metrics(intelligence_state,novel_links DESC,updated_at DESC);

CREATE INDEX idx_sources_enabled_priority ON sources(enabled, priority DESC, id ASC);

CREATE UNIQUE INDEX idx_sources_template_url ON sources(template_url);

CREATE UNIQUE INDEX idx_tasks_identity
ON run_tasks(run_id, COALESCE(source_id, ''), url, task_type);

CREATE INDEX idx_tasks_lease ON run_tasks(status, lease_until);

CREATE INDEX idx_tasks_run_status ON run_tasks(run_id, status, priority DESC, created_at ASC);

CREATE INDEX idx_tasks_status_updated ON run_tasks(status, updated_at ASC);

CREATE INDEX idx_visited_last_seen ON visited_urls(last_seen_at DESC, normalized_url ASC);

CREATE TABLE dead_tasks (
  id TEXT PRIMARY KEY,
  original_task_id TEXT NOT NULL UNIQUE,
  run_id TEXT REFERENCES runs(id) ON DELETE CASCADE,
  payload_json TEXT NOT NULL,
  attempts INTEGER NOT NULL CHECK(attempts >= 0),
  final_error TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  run_id TEXT REFERENCES runs(id) ON DELETE CASCADE,
  task_id TEXT REFERENCES run_tasks(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  level TEXT NOT NULL CHECK(level IN ('debug','info','warning','error')),
  message TEXT NOT NULL,
  details_json TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE "links" (
  id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  page_id TEXT REFERENCES pages(id) ON DELETE SET NULL, source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
  url TEXT NOT NULL, normalized_url TEXT NOT NULL, link_type TEXT NOT NULL CHECK(link_type IN ('folder','legacy_folder')),
  has_key INTEGER NOT NULL CHECK(has_key IN (0,1)),
  validation_status TEXT NOT NULL CHECK(validation_status IN ('structurally_valid','valid','invalid','unchecked','unknown','dead','pending')),
  is_complete INTEGER NOT NULL CHECK(is_complete IN (0,1)), discovered_at TEXT NOT NULL, checked_at TEXT,
  validation_error TEXT, validated_at TEXT, validation_http_status INTEGER, UNIQUE(run_id,normalized_url)
);

CREATE TABLE pages (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  normalized_url TEXT NOT NULL,
  title TEXT,
  status_code INTEGER,
  content_type TEXT,
  crawl_depth INTEGER NOT NULL DEFAULT 0 CHECK(crawl_depth >= 0),
  fetched_at TEXT NOT NULL,
  error_message TEXT,
  UNIQUE(run_id, normalized_url)
);

CREATE TABLE queue_usage (
  day TEXT PRIMARY KEY,
  writes INTEGER NOT NULL DEFAULT 0,
  reads INTEGER NOT NULL DEFAULT 0,
  deletes INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE run_tasks (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  source_id TEXT REFERENCES sources(id) ON DELETE SET NULL,
  url TEXT NOT NULL,
  task_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','dispatching','queued','running','completed','failed','cancelled','dead')),
  attempts INTEGER NOT NULL DEFAULT 0 CHECK(attempts >= 0),
  priority INTEGER NOT NULL DEFAULT 50,
  lease_until TEXT,
  queued_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  last_error TEXT,
  UNIQUE(run_id, source_id, url, task_type)
);

CREATE TABLE runs (
  id TEXT PRIMARY KEY,
  mode TEXT NOT NULL CHECK(mode IN ('autoscan','keyword')),
  keyword TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK(status IN ('created','running','paused','completed','failed','cancelled','recovering')),
  total_tasks INTEGER NOT NULL DEFAULT 0 CHECK(total_tasks >= 0),
  completed_tasks INTEGER NOT NULL DEFAULT 0 CHECK(completed_tasks >= 0),
  failed_tasks INTEGER NOT NULL DEFAULT 0 CHECK(failed_tasks >= 0),
  links_found INTEGER NOT NULL DEFAULT 0 CHECK(links_found >= 0),
  progress REAL NOT NULL DEFAULT 0 CHECK(progress >= 0 AND progress <= 100),
  created_at TEXT NOT NULL,
  started_at TEXT,
  paused_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL,
  error_message TEXT
);

CREATE TABLE schema_migrations(version INTEGER PRIMARY KEY,name TEXT NOT NULL UNIQUE,checksum TEXT NOT NULL,applied_at TEXT NOT NULL);

CREATE TABLE search_terms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category TEXT NOT NULL,
  term TEXT NOT NULL,
  score REAL NOT NULL DEFAULT 1,
  hits INTEGER NOT NULL DEFAULT 1,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  UNIQUE(category,term)
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE source_candidate_domains (
  host TEXT PRIMARY KEY,
  root_url TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'candidate' CHECK(state IN ('candidate','testing','sandbox','promoted','rejected','blocked','duplicate','dormant','quarantined')),
  family TEXT NOT NULL DEFAULT 'unknown',
  quality_grade TEXT NOT NULL DEFAULT 'C' CHECK(quality_grade IN ('A','B','C','D')),
  evidence_count INTEGER NOT NULL DEFAULT 0,
  pages_tested INTEGER NOT NULL DEFAULT 0,
  extracted_links INTEGER NOT NULL DEFAULT 0,
  novel_links INTEGER NOT NULL DEFAULT 0,
  alive_links INTEGER NOT NULL DEFAULT 0,
  dead_links INTEGER NOT NULL DEFAULT 0,
  unknown_links INTEGER NOT NULL DEFAULT 0,
  duplicate_links INTEGER NOT NULL DEFAULT 0,
  successful_fetches INTEGER NOT NULL DEFAULT 0,
  failed_fetches INTEGER NOT NULL DEFAULT 0,
  blocked_fetches INTEGER NOT NULL DEFAULT 0,
  average_latency REAL NOT NULL DEFAULT 0,
  confidence REAL NOT NULL DEFAULT 0,
  promoted_source_id TEXT,
  rejection_reason TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  last_tested_at TEXT
);

CREATE TABLE "source_candidates" (
  id TEXT PRIMARY KEY, normalized_url TEXT NOT NULL UNIQUE, host TEXT NOT NULL,
  discovered_from_source_id TEXT, discovered_from_autoscan_run_id TEXT, discovered_from_discovery_run_id TEXT,
  evidence_count INTEGER NOT NULL DEFAULT 0 CHECK(evidence_count >= 0), mega_links_found INTEGER NOT NULL DEFAULT 0 CHECK(mega_links_found >= 0),
  successful_fetches INTEGER NOT NULL DEFAULT 0 CHECK(successful_fetches >= 0), failed_fetches INTEGER NOT NULL DEFAULT 0 CHECK(failed_fetches >= 0),
  confidence REAL NOT NULL DEFAULT 0, state TEXT NOT NULL DEFAULT 'candidate', promoted_source_id TEXT,
  first_seen_at TEXT NOT NULL, last_seen_at TEXT NOT NULL, last_error TEXT, pages_tested INTEGER NOT NULL DEFAULT 0,
  novel_links_found INTEGER NOT NULL DEFAULT 0, alive_links_found INTEGER NOT NULL DEFAULT 0, duplicate_links_found INTEGER NOT NULL DEFAULT 0,
  average_latency REAL NOT NULL DEFAULT 0, quality_grade TEXT NOT NULL DEFAULT 'C', family TEXT NOT NULL DEFAULT 'unknown', rejection_reason TEXT,
  FOREIGN KEY(discovered_from_source_id) REFERENCES sources(id) ON DELETE SET NULL,
  FOREIGN KEY(discovered_from_autoscan_run_id) REFERENCES runs(id) ON DELETE SET NULL,
  FOREIGN KEY(discovered_from_discovery_run_id) REFERENCES source_discovery_runs(id) ON DELETE SET NULL,
  FOREIGN KEY(promoted_source_id) REFERENCES sources(id) ON DELETE SET NULL
);

CREATE TABLE source_discovery_runs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK(status IN ('created','running','paused','completed','failed','cancelled','recovering')),
  profile TEXT NOT NULL DEFAULT 'normal',
  rounds INTEGER NOT NULL DEFAULT 1 CHECK(rounds BETWEEN 1 AND 100),
  total_tasks INTEGER NOT NULL DEFAULT 0,
  completed_tasks INTEGER NOT NULL DEFAULT 0,
  failed_tasks INTEGER NOT NULL DEFAULT 0,
  domains_discovered INTEGER NOT NULL DEFAULT 0,
  candidates_created INTEGER NOT NULL DEFAULT 0,
  sources_tested INTEGER NOT NULL DEFAULT 0,
  promoted_sources INTEGER NOT NULL DEFAULT 0,
  rejected_sources INTEGER NOT NULL DEFAULT 0,
  progress REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  updated_at TEXT NOT NULL,
  error_message TEXT
, queue_messages INTEGER NOT NULL DEFAULT 0, current_strategy TEXT, outcome TEXT NOT NULL DEFAULT 'pending' CHECK(outcome IN ('pending','success','partial','failure')));

CREATE TABLE source_discovery_tasks (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES source_discovery_runs(id) ON DELETE CASCADE,
  strategy TEXT NOT NULL,
  seed_value TEXT,
  url TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('pending','dispatching','queued','running','completed','failed','cancelled','dead')),
  attempts INTEGER NOT NULL DEFAULT 0,
  priority INTEGER NOT NULL DEFAULT 50,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  last_error TEXT, message_id TEXT, queued_at TEXT, lease_until TEXT, result_json TEXT, origin_source_id TEXT, origin_host TEXT, input_fingerprint TEXT, evidence_url TEXT,
  UNIQUE(run_id,url,strategy)
);

CREATE TABLE source_graph_edges (
  id TEXT PRIMARY KEY,
  mega_fingerprint TEXT,
  from_host TEXT,
  to_host TEXT NOT NULL,
  discovery_method TEXT NOT NULL,
  evidence_url TEXT,
  evidence_count INTEGER NOT NULL DEFAULT 1,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL, from_source_id TEXT,
  UNIQUE(mega_fingerprint,to_host,discovery_method)
);

CREATE TABLE source_metrics (
  source_id TEXT PRIMARY KEY REFERENCES sources(id) ON DELETE CASCADE,
  requests INTEGER NOT NULL DEFAULT 0 CHECK(requests >= 0),
  successes INTEGER NOT NULL DEFAULT 0 CHECK(successes >= 0),
  failures INTEGER NOT NULL DEFAULT 0 CHECK(failures >= 0),
  timeouts INTEGER NOT NULL DEFAULT 0 CHECK(timeouts >= 0),
  blocks INTEGER NOT NULL DEFAULT 0 CHECK(blocks >= 0),
  links_found INTEGER NOT NULL DEFAULT 0 CHECK(links_found >= 0),
  valid_links INTEGER NOT NULL DEFAULT 0 CHECK(valid_links >= 0),
  yield_rate REAL NOT NULL DEFAULT 0 CHECK(yield_rate >= 0),
  average_latency REAL NOT NULL DEFAULT 0 CHECK(average_latency >= 0),
  consecutive_failures INTEGER NOT NULL DEFAULT 0 CHECK(consecutive_failures >= 0),
  last_success_at TEXT,
  last_failure_at TEXT,
  updated_at TEXT NOT NULL
, novel_links INTEGER NOT NULL DEFAULT 0 CHECK(novel_links >= 0), duplicate_links INTEGER NOT NULL DEFAULT 0 CHECK(duplicate_links >= 0), zero_yield_runs INTEGER NOT NULL DEFAULT 0 CHECK(zero_yield_runs >= 0), last_novel_at TEXT, cooldown_until TEXT, intelligence_state TEXT NOT NULL DEFAULT 'explore');

CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  source_type TEXT NOT NULL CHECK(source_type IN ('html','rss','json','custom')),
  template_url TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 0 CHECK(enabled IN (0,1)),
  default_enabled INTEGER NOT NULL DEFAULT 0 CHECK(default_enabled IN (0,1)),
  priority INTEGER NOT NULL DEFAULT 50,
  rank_score REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE visited_urls (
  normalized_url TEXT PRIMARY KEY,
  first_run_id TEXT REFERENCES runs(id) ON DELETE SET NULL,
  last_run_id TEXT REFERENCES runs(id) ON DELETE SET NULL,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  visit_count INTEGER NOT NULL DEFAULT 1 CHECK(visit_count >= 1)
);
