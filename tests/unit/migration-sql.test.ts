// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const sql = readFileSync(new URL('../../migrations/0001_initial_workflow.sql', import.meta.url), 'utf8');
describe('D1 migration scope', () => {
  it('defines the nine workflow tables without additional infrastructure', () => {
    expect([...sql.matchAll(/CREATE TABLE (\w+)/g)].map(match => match[1])).toEqual([
      'Projects', 'Pages', 'EvidenceObjects', 'GenerationRuns', 'Components', 'DesignSystemVersions', 'PageApprovals', 'Releases', 'ReleaseArtifacts',
    ]);
    expect(sql).not.toMatch(/Cloud Run|Firestore|Cloud Storage|local filesystem/i);
    expect(sql).not.toMatch(/DROP TABLE/i);
  });
});
