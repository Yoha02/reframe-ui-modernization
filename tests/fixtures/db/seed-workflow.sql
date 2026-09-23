INSERT INTO Projects (id,name,status,active_stage) VALUES ('sample-project','Example archive','active','publish');
INSERT INTO Pages (id,project_id,title,route,source_url) VALUES ('sample-page','sample-project','Home','/','https://example.com/');
INSERT INTO EvidenceObjects (id,project_id,page_id,object_key,sha256,media_type,byte_size,provenance_json)
VALUES ('sample-evidence','sample-project','sample-page','projects/sample-project/evidence/source/home.html',printf('%064d',0),'text/html',42,'{"method":"fixture"}');
INSERT INTO GenerationRuns (id,project_id,page_id,stage,status,dependency_fingerprint,cache_key,started_at,completed_at)
VALUES ('sample-run','sample-project','sample-page','evaluate','completed',printf('%064d',0),'fixture-evaluation','2026-09-23T12:00:00Z','2026-09-23T12:00:01Z');
INSERT INTO DesignSystemVersions (id,project_id,version,status,active,immutable,source_fingerprint,tokens_json,manifest_json,approved_at,approved_by)
VALUES ('sample-design','sample-project',1,'approved',1,1,printf('%064d',0),'{}','{}','2026-09-23T12:01:00Z','fixture-owner');
INSERT INTO PageApprovals (id,project_id,page_id,design_system_version_id,specification_hash,approved_at,approved_by)
VALUES ('sample-approval','sample-project','sample-page','sample-design',printf('%064d',0),'2026-09-23T12:02:00Z','fixture-owner');
INSERT INTO Releases (id,project_id,design_system_version_id,routes_json,hashes_json,artifact_manifest_json,zip_object_key)
VALUES ('sample-release','sample-project','sample-design','[{"route":"/","pageId":"sample-page"}]','{}','[]','projects/sample-project/releases/sample-release/export.zip');
INSERT INTO ReleaseArtifacts (id,project_id,release_id,object_key,kind,sha256,media_type,byte_size)
VALUES ('sample-artifact','sample-project','sample-release','projects/sample-project/releases/sample-release/site/index.html','html',printf('%064d',0),'text/html',48);
