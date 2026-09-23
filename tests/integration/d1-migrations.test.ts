// @vitest-environment node
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
const migration = readFileSync(new URL('../../migrations/0001_initial_workflow.sql', import.meta.url), 'utf8');
const seed = readFileSync(new URL('../fixtures/db/seed-workflow.sql', import.meta.url), 'utf8');
let db: DatabaseSync;
beforeEach(() => { db = new DatabaseSync(':memory:'); db.exec('PRAGMA foreign_keys = ON'); db.exec(migration); db.exec(seed); });
afterEach(() => db.close());
describe('workflow migration in D1-compatible SQLite', () => {
  it('creates project, evidence, indexes and the complete release trace', () => {
    const columns = (table: string) => db.prepare(`PRAGMA table_info(${table})`).all().map(row => row.name);
    expect(columns('Projects')).toEqual(expect.arrayContaining(['id','name','status','active_stage','created_at','updated_at']));
    expect(columns('EvidenceObjects')).toEqual(expect.arrayContaining(['object_key','sha256','media_type','byte_size','provenance_json','page_id']));
    expect(db.prepare('SELECT name FROM sqlite_master WHERE type = ?').all('index').length).toBeGreaterThan(10);
    const trace = db.prepare(`SELECT p.name, a.object_key, a.immutable, g.status FROM Projects p
      JOIN Pages page ON page.project_id = p.id JOIN GenerationRuns g ON g.page_id = page.id
      JOIN Releases r ON r.project_id = p.id JOIN ReleaseArtifacts a ON a.release_id = r.id`).get();
    expect(trace).toMatchObject({ name: 'Example archive', status: 'completed', immutable: 1,
      object_key: 'projects/sample-project/releases/sample-release/site/index.html' });
  });
  it.each(['started','completed','failed','retryable','cached'])('accepts the real run state %s', status => {
    db.prepare(`UPDATE GenerationRuns SET status = ?, failed_at = '2026-09-23T12:00:01Z'`).run(status);
    expect(db.prepare('SELECT status FROM GenerationRuns').get()?.status).toBe(status);
  });
  it('rejects invented status and incomplete completion', () => {
    expect(() => db.exec("UPDATE GenerationRuns SET status = 'almost_done'")).toThrow();
    expect(() => db.exec('UPDATE GenerationRuns SET completed_at = NULL')).toThrow();
  });
  it('blocks orphaned and cross-project workflow records', () => {
    expect(() => db.exec("DELETE FROM Projects WHERE id = 'sample-project'")).toThrow(/FOREIGN KEY/);
    expect(() => db.exec("UPDATE PageApprovals SET page_id = 'missing'")).toThrow(/FOREIGN KEY/);
    expect(() => db.exec("UPDATE PageApprovals SET design_system_version_id = 'missing'")).toThrow(/FOREIGN KEY/);
    db.exec("INSERT INTO Projects (id,name) VALUES ('other','Other'); INSERT INTO Pages (id,project_id,title,route,source_url) VALUES ('other-page','other','Other','/','https://example.com')");
    expect(() => db.exec("UPDATE PageApprovals SET page_id = 'other-page'")).toThrow(/FOREIGN KEY/);
    expect(() => db.exec(`INSERT INTO ReleaseArtifacts (id,project_id,release_id,object_key,kind,sha256,media_type,byte_size)
      VALUES ('orphan','sample-project','missing','projects/sample-project/releases/missing/site/index.html','html',printf('%064d',0),'text/html',1)`)).toThrow(/FOREIGN KEY/);
  });
  it('allows only one active approved design and prevents rewriting approved tokens', () => {
    const insert = `INSERT INTO DesignSystemVersions (id,project_id,version,status,active,immutable,source_fingerprint,tokens_json,manifest_json,approved_at,approved_by)
      VALUES ('second','sample-project',2,'approved',1,1,'fingerprint','{}','{}','2026-09-23T12:03:00Z','fixture-owner')`;
    expect(() => db.exec(insert)).toThrow(/UNIQUE/);
    expect(() => db.exec(`UPDATE DesignSystemVersions SET tokens_json = '{"changed":true}'`)).toThrow(/immutable/);
    db.exec('UPDATE DesignSystemVersions SET active = 0'); db.exec(insert);
    expect(db.prepare('SELECT COUNT(*) AS n FROM DesignSystemVersions WHERE active = 1').get()?.n).toBe(1);
  });
  it('protects release artifact metadata and requires proof before published status', () => {
    expect(() => db.exec("UPDATE ReleaseArtifacts SET object_key = 'other'")).toThrow(/immutable/);
    expect(() => db.exec('DELETE FROM ReleaseArtifacts')).toThrow(/immutable/);
    expect(() => db.exec("UPDATE Releases SET public_state = 'published'")).toThrow(/CHECK/);
  });
});
