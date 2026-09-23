import { describe, expect, it } from 'vitest';
import { DesignSystemVersionSchema, EvidenceManifestSchema, GenerationRunSchema, PageSchema, ReleaseManifestSchema, SafeHrefSchema, SafePathSchema } from '../../src/shared/schemas';
import evidence from '../fixtures/schemas/evidence-manifest.valid.json';
import badEvidence from '../fixtures/schemas/evidence-manifest.invalid.json';
import run from '../fixtures/schemas/generation-run.valid.json';
import badRun from '../fixtures/schemas/generation-run.invalid.json';
import design from '../fixtures/schemas/design-system-version.valid.json';
import badDesign from '../fixtures/schemas/design-system-version.invalid.json';
import page from '../fixtures/schemas/page-schema.valid.json';
import badPage from '../fixtures/schemas/page-schema.invalid.json';
import release from '../fixtures/schemas/release-manifest.valid.json';
import badRelease from '../fixtures/schemas/release-manifest.invalid.json';

describe('shared workflow contracts', () => {
  for (const [name, schema, valid, invalid] of [
    ['evidence', EvidenceManifestSchema, evidence, badEvidence],
    ['run', GenerationRunSchema, run, badRun],
    ['design', DesignSystemVersionSchema, design, badDesign],
    ['page', PageSchema, page, badPage],
    ['release', ReleaseManifestSchema, release, badRelease],
  ] as const) {
    it(`${name} accepts its valid fixture and rejects its invalid fixture with issues`, () => {
      expect(schema.safeParse(valid).success).toBe(true);
      const result = schema.safeParse(invalid);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.issues.length).toBeGreaterThan(0);
    });
  }
  it.each(['started', 'completed', 'failed', 'retryable', 'cached'])('represents the %s run state with appropriate provenance', status => {
    const value = { ...run, status, ...(status === 'completed' || status === 'cached' ? { completedAt: run.startedAt } : {}), ...(status === 'failed' || status === 'retryable' ? { failedAt: run.startedAt, errorCode: 'PROVIDER_TIMEOUT' } : {}), ...(status === 'cached' ? { cachedFromRunId: 'earlier-run' } : {}) };
    expect(GenerationRunSchema.safeParse(value).success).toBe(true);
  });
  it('cannot promise another retry after exhausting the request limit', () => {
    expect(GenerationRunSchema.safeParse({ ...run, status: 'retryable', retryCount: 1, failedAt: run.startedAt, errorCode: 'TIMEOUT' }).success).toBe(false);
  });
  it('requires complete immutable design approval and excludes draft-only fields', () => {
    const missingDate: Record<string, unknown> = { ...design };
    delete missingDate.approvedAt;
    expect(DesignSystemVersionSchema.safeParse(missingDate).success).toBe(false);
    expect(DesignSystemVersionSchema.safeParse({ ...design, immutable: false }).success).toBe(false);
    expect(DesignSystemVersionSchema.safeParse({ ...design, draftEdits: {} }).success).toBe(false);
    expect(DesignSystemVersionSchema.safeParse({ ...design, status: 'draft' }).success).toBe(false);
  });
  it('round-trips the page specification without changing semantic section order', () => {
    const parsed = PageSchema.parse(page);
    expect(JSON.stringify(PageSchema.parse(JSON.parse(JSON.stringify(parsed))))).toBe(JSON.stringify(parsed));
    expect(parsed.sections.map(s => s.id)).toEqual(page.sections.map(s => s.id));
  });
  it.each(['../secret', '/absolute', 'C:/secret', 'assets/../../secret', 'assets\\secret', '%2e%2e/secret', '%252e%252e/secret', 'a//b'])('rejects unsafe storage path %s', path => {
    expect(SafePathSchema.safeParse(path).success).toBe(false);
    expect(EvidenceManifestSchema.safeParse({ ...evidence, pages: [{ ...evidence.pages[0], html: { ...evidence.pages[0].html, objectKey: path } }] }).success).toBe(false);
  });
  it.each(['javascript:alert(1)', 'data:text/html,test', '//evil.test', ' java\nscript:evil'])('rejects active or ambiguous link %s', href => {
    expect(SafeHrefSchema.safeParse(href).success).toBe(false);
  });
  it('rejects duplicate routes and source crops outside screenshot bounds', () => {
    expect(EvidenceManifestSchema.safeParse({ ...evidence, pages: [evidence.pages[0], { ...evidence.pages[0], id: 'other' }] }).success).toBe(false);
    expect(EvidenceManifestSchema.safeParse({ ...evidence, pages: [{ ...evidence.pages[0], regions: [{ ...evidence.pages[0].regions[0], x: 2000 }] }] }).success).toBe(false);
  });
  it('requires all mandatory release fields', () => {
    for (const key of ['releaseId', 'projectId', 'routes', 'artifacts', 'hashes', 'zipArtifactKey', 'immutable']) {
      const candidate = { ...release } as Record<string, unknown>;
      delete candidate[key];
      expect(ReleaseManifestSchema.safeParse(candidate).success, key).toBe(false);
    }
  });
  it('rejects mutable artifacts, broken routes, mismatched hashes, and unverified publication', () => {
    expect(ReleaseManifestSchema.safeParse({ ...release, artifacts: [{ ...release.artifacts[0], immutable: false }, release.artifacts[1]] }).success).toBe(false);
    expect(ReleaseManifestSchema.safeParse({ ...release, routes: [{ ...release.routes[0], artifactKey: 'missing.html' }] }).success).toBe(false);
    expect(ReleaseManifestSchema.safeParse({ ...release, hashes: {} }).success).toBe(false);
    expect(ReleaseManifestSchema.safeParse({ ...release, publicState: 'published' }).success).toBe(false);
  });
});
