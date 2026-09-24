// @vitest-environment node
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { FilesRepository } from '../../src/worker/storage/filesRepository';
import { MemoryBucket } from '../fixtures/files/memoryBucket';
it('round-trips evidence, generated files, exports and releases through the local R2-compatible fixture', async () => {
  const evidence = Uint8Array.from(readFileSync(new URL('../fixtures/files/sample-evidence.html',import.meta.url))).buffer;
  const release = Uint8Array.from(readFileSync(new URL('../fixtures/files/sample-release-index.html',import.meta.url))).buffer;
  const bucket = new MemoryBucket(); const repo = new FilesRepository({ FILES: bucket });
  const meta = { mediaType: 'text/html', artifactKind: 'html' as const };
  const source = await repo.putEvidenceObject('p','source/home.html',evidence,meta);
  expect(await (await repo.getObject(source.objectKey)).arrayBuffer()).toEqual(evidence);
  const artifact = await repo.putReleaseArtifact('p','release','index.html',release,meta);
  expect(await (await repo.getObject(artifact.objectKey)).arrayBuffer()).toEqual(release);
  expect(await repo.headObject(artifact.objectKey)).toMatchObject({ size: release.byteLength, customMetadata: { releaseId: 'release', immutable: 'true' } });
  await repo.putGeneratedArtifact('p','run','index.html',release,meta);
  const zip = await repo.putZipExport('p','export.zip',new Uint8Array([80,75,5,6]).buffer);
  expect(await repo.headObject(zip.objectKey)).toMatchObject({ httpMetadata: { contentType: 'application/zip' }, customMetadata: { artifactKind: 'zip' } });
  expect(bucket.objects.size).toBe(4);
});
