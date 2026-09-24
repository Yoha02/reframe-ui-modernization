// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { buildEvidenceKey, buildGeneratedKey, buildReleaseArtifactKey, buildZipExportKey, FilesRepository, sha256 } from '../../src/worker/storage/filesRepository';
import { MemoryBucket } from '../fixtures/files/memoryBucket';
const bytes = new TextEncoder().encode('Example archive').buffer;
const metadata = { mediaType: 'text/html', artifactKind: 'html' as const };
describe('FILES repository boundaries', () => {
  it('creates deterministic scoped object keys', () => {
    expect(buildEvidenceKey('project-1','source/home.html')).toBe('projects/project-1/evidence/source/home.html');
    expect(buildReleaseArtifactKey('project-1','release-1','index.html')).toBe('projects/project-1/releases/release-1/site/index.html');
    expect(buildGeneratedKey('p','run','site.css')).toBe('projects/p/generated/run/site.css');
    expect(buildZipExportKey('p','export.zip')).toBe('projects/p/exports/export.zip');
  });
  it.each(['../secret.txt','/absolute','a\\b','%2e%2e/a','a//b','a/../b','a\u0000b',''])('rejects unsafe path %j before writing', unsafe => {
    const bucket = new MemoryBucket(); const put = vi.spyOn(bucket,'put'); const repo = new FilesRepository({ FILES: bucket });
    expect(() => repo.putEvidenceObject('p',unsafe,bytes,metadata)).toThrow(/relative/);
    expect(put).not.toHaveBeenCalled();
  });
  it('computes and preserves metadata and rejects invalid hashes and lengths', async () => {
    const bucket = new MemoryBucket(); const repo = new FilesRepository({ FILES: bucket });
    const hash = await sha256(bytes);
    const ref = await repo.putGeneratedArtifact('p','r','index.html',bytes,{ ...metadata, sha256: hash });
    expect(await repo.headObject(ref.objectKey)).toMatchObject({ customMetadata: { projectId: 'p', runId: 'r', sha256: hash, byteSize: String(bytes.byteLength), immutable: 'false', artifactKind: 'html' } });
    for (const extra of [{ sha256: 'invalid' }, { sha256: '0'.repeat(64) }, { byteSize: 999 }]) {
      await expect(repo.putEvidenceObject('p','bad.html',bytes,{ ...metadata, ...extra })).rejects.toMatchObject({ errorCode: 'invalid_object_metadata' });
    }
    await expect(repo.putEvidenceObject('p','empty',new ArrayBuffer(0),metadata)).rejects.toMatchObject({ errorCode: 'invalid_object_metadata' });
    expect((await repo.putEvidenceObject('p','empty',new ArrayBuffer(0),{ ...metadata, byteSize: 0 })).byteSize).toBe(0);
  });
  it('rejects existing and concurrent immutable release writes, even with identical bytes', async () => {
    const bucket = new MemoryBucket(); const repo = new FilesRepository({ FILES: bucket });
    await repo.putReleaseArtifact('p','release','index.html',bytes,metadata);
    await expect(repo.putReleaseArtifact('p','release','index.html',bytes,metadata)).rejects.toMatchObject({ errorCode: 'release_artifact_exists' });
    const results = await Promise.allSettled([1,2].map(() => repo.putReleaseArtifact('p','release','racing.html',bytes,metadata)));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.find(result => result.status === 'rejected')).toMatchObject({ reason: { errorCode: 'release_artifact_exists' } });
  });
  it('reports missing bindings and objects honestly', async () => {
    expect(() => new FilesRepository({})).toThrow(expect.objectContaining({ errorCode: 'files_binding_missing' }));
    const repo = new FilesRepository({ FILES: new MemoryBucket() });
    expect(await repo.headObject('missing')).toBeNull();
    await expect(repo.getObject('missing')).rejects.toMatchObject({ errorCode: 'object_not_found' });
  });
});
