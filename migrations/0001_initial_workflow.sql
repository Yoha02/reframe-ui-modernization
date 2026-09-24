-- D1 enables foreign keys. Local SQLite runners must enable PRAGMA foreign_keys = ON.
-- Binary content lives in FILES; JSON columns contain validated workflow metadata.
CREATE TABLE Projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','published','failed')),
  active_stage TEXT NOT NULL DEFAULT 'import' CHECK (active_stage IN ('import','evaluate','decompose','design_system','rebuild','review','publish')),
  manifest_json TEXT CHECK (manifest_json IS NULL OR json_valid(manifest_json)),
  findings_json TEXT CHECK (findings_json IS NULL OR json_valid(findings_json)),
  canvas_json TEXT CHECK (canvas_json IS NULL OR json_valid(canvas_json)),
  source_fingerprint TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE Pages (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES Projects(id) ON DELETE RESTRICT,
  title TEXT NOT NULL,
  route TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'imported' CHECK (status IN ('imported','draft','approved','stale','failed')),
  source_url TEXT NOT NULL,
  specification_json TEXT CHECK (specification_json IS NULL OR json_valid(specification_json)),
  specification_hash TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (project_id, route), UNIQUE (id, project_id)
);
CREATE TABLE EvidenceObjects (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES Projects(id),
  page_id TEXT,
  object_key TEXT NOT NULL UNIQUE,
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64 AND sha256 NOT GLOB '*[^0-9a-f]*'),
  media_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  provenance_json TEXT NOT NULL CHECK (json_valid(provenance_json)),
  FOREIGN KEY (page_id, project_id) REFERENCES Pages(id, project_id)
);
CREATE INDEX evidence_project_page ON EvidenceObjects(project_id, page_id);
CREATE TABLE GenerationRuns (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES Projects(id),
  page_id TEXT,
  stage TEXT NOT NULL CHECK (stage IN ('import','evaluate','decompose','design_system','rebuild','review','publish')),
  status TEXT NOT NULL CHECK (status IN ('started','completed','failed','retryable','cached')),
  dependency_fingerprint TEXT NOT NULL,
  cache_key TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count BETWEEN 0 AND 1),
  started_at TEXT NOT NULL,
  completed_at TEXT,
  failed_at TEXT,
  result_json TEXT CHECK (result_json IS NULL OR json_valid(result_json)),
  error_json TEXT CHECK (error_json IS NULL OR json_valid(error_json)),
  usage_json TEXT CHECK (usage_json IS NULL OR json_valid(usage_json)),
  FOREIGN KEY (page_id, project_id) REFERENCES Pages(id, project_id),
  CHECK (status NOT IN ('completed','cached') OR completed_at IS NOT NULL),
  CHECK (status NOT IN ('failed','retryable') OR failed_at IS NOT NULL)
);
CREATE INDEX runs_project_status ON GenerationRuns(project_id, status);
CREATE INDEX runs_page ON GenerationRuns(page_id);
CREATE INDEX runs_cache ON GenerationRuns(project_id, cache_key, dependency_fingerprint);
CREATE TABLE Components (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES Projects(id),
  page_id TEXT NOT NULL,
  run_id TEXT REFERENCES GenerationRuns(id),
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  evidence_json TEXT NOT NULL CHECK (json_valid(evidence_json)),
  decision_json TEXT CHECK (decision_json IS NULL OR json_valid(decision_json)),
  FOREIGN KEY (page_id, project_id) REFERENCES Pages(id, project_id)
);
CREATE INDEX components_project_page ON Components(project_id, page_id);
CREATE INDEX components_run ON Components(run_id);
CREATE TABLE DesignSystemVersions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES Projects(id),
  version INTEGER NOT NULL CHECK (version > 0),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','approved')),
  active INTEGER NOT NULL DEFAULT 0 CHECK (active IN (0,1)),
  immutable INTEGER NOT NULL DEFAULT 0 CHECK (immutable IN (0,1)),
  source_fingerprint TEXT NOT NULL,
  tokens_json TEXT NOT NULL CHECK (json_valid(tokens_json)),
  manifest_json TEXT NOT NULL CHECK (json_valid(manifest_json)),
  approved_at TEXT,
  approved_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (project_id, version), UNIQUE (id, project_id),
  CHECK (status != 'approved' OR (immutable = 1 AND approved_at IS NOT NULL AND approved_by IS NOT NULL)),
  CHECK (active = 0 OR status = 'approved')
);
CREATE UNIQUE INDEX one_active_approved_design ON DesignSystemVersions(project_id) WHERE status = 'approved' AND active = 1;
-- An approved version can be superseded (active changes), never rewritten.
CREATE TRIGGER immutable_approved_design BEFORE UPDATE ON DesignSystemVersions
WHEN OLD.immutable = 1 AND (
 NEW.id IS NOT OLD.id OR NEW.project_id IS NOT OLD.project_id OR NEW.version IS NOT OLD.version OR
 NEW.status IS NOT OLD.status OR NEW.immutable != 1 OR NEW.tokens_json IS NOT OLD.tokens_json OR
 NEW.manifest_json IS NOT OLD.manifest_json OR NEW.source_fingerprint IS NOT OLD.source_fingerprint OR
 NEW.approved_at IS NOT OLD.approved_at OR NEW.approved_by IS NOT OLD.approved_by OR NEW.created_at IS NOT OLD.created_at)
BEGIN SELECT RAISE(ABORT, 'approved_design_is_immutable'); END;
CREATE TRIGGER no_delete_approved_design BEFORE DELETE ON DesignSystemVersions WHEN OLD.immutable = 1
BEGIN SELECT RAISE(ABORT, 'approved_design_is_immutable'); END;
CREATE TABLE PageApprovals (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES Projects(id),
  page_id TEXT NOT NULL,
  design_system_version_id TEXT NOT NULL,
  specification_hash TEXT NOT NULL,
  approved_at TEXT NOT NULL,
  approved_by TEXT NOT NULL,
  FOREIGN KEY (page_id, project_id) REFERENCES Pages(id, project_id),
  FOREIGN KEY (design_system_version_id, project_id) REFERENCES DesignSystemVersions(id, project_id)
);
CREATE INDEX approvals_page_design ON PageApprovals(page_id, design_system_version_id);
CREATE TABLE Releases (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES Projects(id),
  design_system_version_id TEXT NOT NULL,
  previous_release_id TEXT,
  public_state TEXT NOT NULL DEFAULT 'pending' CHECK (public_state IN ('pending','publishing','published','failed','compatibility_error')),
  routes_json TEXT NOT NULL CHECK (json_valid(routes_json)),
  hashes_json TEXT NOT NULL CHECK (json_valid(hashes_json)),
  artifact_manifest_json TEXT NOT NULL CHECK (json_valid(artifact_manifest_json)),
  zip_object_key TEXT NOT NULL,
  public_url TEXT,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (id, project_id),
  FOREIGN KEY (design_system_version_id, project_id) REFERENCES DesignSystemVersions(id, project_id),
  FOREIGN KEY (previous_release_id, project_id) REFERENCES Releases(id, project_id),
  CHECK (public_state != 'published' OR (public_url IS NOT NULL AND verified_at IS NOT NULL))
);
CREATE INDEX releases_project_state ON Releases(project_id, public_state);
CREATE TABLE ReleaseArtifacts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  release_id TEXT NOT NULL,
  object_key TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('html','css','image','screenshot','text','manifest','zip','font')),
  sha256 TEXT NOT NULL CHECK (length(sha256) = 64 AND sha256 NOT GLOB '*[^0-9a-f]*'),
  media_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL CHECK (byte_size >= 0),
  immutable INTEGER NOT NULL DEFAULT 1 CHECK (immutable = 1),
  FOREIGN KEY (release_id, project_id) REFERENCES Releases(id, project_id),
  CHECK (substr(object_key, 1, length('projects/' || project_id || '/releases/' || release_id || '/')) = 'projects/' || project_id || '/releases/' || release_id || '/')
);
CREATE INDEX artifacts_release ON ReleaseArtifacts(release_id);
CREATE TRIGGER no_update_release_artifact BEFORE UPDATE ON ReleaseArtifacts
BEGIN SELECT RAISE(ABORT, 'release_artifact_is_immutable'); END;
CREATE TRIGGER no_delete_release_artifact BEFORE DELETE ON ReleaseArtifacts
BEGIN SELECT RAISE(ABORT, 'release_artifact_is_immutable'); END;
