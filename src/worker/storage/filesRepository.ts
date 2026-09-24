import { IdSchema, SafePathSchema, Sha256Schema } from '../../shared/schemas/common';

export type StorageErrorCode = 'files_binding_missing' | 'invalid_object_path' | 'object_not_found' | 'release_artifact_exists' | 'invalid_object_metadata' | 'object_write_failed';
export class StorageError extends Error {
  constructor(public readonly errorCode: StorageErrorCode, message: string) { super(message); this.name = 'StorageError'; }
}
export interface StoredObject {
  key: string; size: number; etag: string;
  customMetadata?: Record<string, string>;
  httpMetadata?: { contentType?: string };
}
export interface ObjectBody extends StoredObject { arrayBuffer(): Promise<ArrayBuffer>; }
export interface FilesBinding {
  put(key: string, value: ArrayBuffer, options: { httpMetadata: { contentType: string }; customMetadata: Record<string, string>; onlyIf?: { etagDoesNotMatch: string } }): Promise<StoredObject | null>;
  get(key: string): Promise<ObjectBody | null>;
  head(key: string): Promise<StoredObject | null>;
}
export interface FilesEnvironment { FILES?: FilesBinding; }
export interface WriteMetadata {
  mediaType: string; artifactKind: 'html' | 'css' | 'image' | 'screenshot' | 'text' | 'manifest' | 'zip' | 'font';
  sha256?: string; byteSize?: number;
}
export interface ObjectReference { objectKey: string; sha256: string; mediaType: string; byteSize: number; immutable: boolean; }
function path(value: string) {
  if (!SafePathSchema.safeParse(value).success) throw new StorageError('invalid_object_path', 'Use a safe relative object path.');
  return value;
}
function id(value: string) {
  if (!IdSchema.safeParse(value).success) throw new StorageError('invalid_object_path', 'Invalid storage identifier.');
  return value;
}
export const buildEvidenceKey = (projectId: string, logicalPath: string) => `projects/${id(projectId)}/evidence/${path(logicalPath)}`;
export const buildGeneratedKey = (projectId: string, runId: string, logicalPath: string) => `projects/${id(projectId)}/generated/${id(runId)}/${path(logicalPath)}`;
export const buildZipExportKey = (projectId: string, zipName: string) => `projects/${id(projectId)}/exports/${path(zipName)}`;
export const buildReleaseArtifactKey = (projectId: string, releaseId: string, logicalPath: string) => `projects/${id(projectId)}/releases/${id(releaseId)}/site/${path(logicalPath)}`;
export async function sha256(bytes: ArrayBuffer): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)), byte => byte.toString(16).padStart(2, '0')).join('');
}

export class FilesRepository {
  private readonly files: FilesBinding;
  constructor(env: FilesEnvironment) {
    if (!env.FILES) throw new StorageError('files_binding_missing', 'The FILES storage binding is not configured.');
    this.files = env.FILES;
  }
  async headObject(objectKey: string): Promise<StoredObject | null> { return this.files.head(path(objectKey)); }
  async getObject(objectKey: string): Promise<ObjectBody> {
    const object = await this.files.get(path(objectKey));
    if (!object) throw new StorageError('object_not_found', 'The requested stored object does not exist.');
    return object;
  }
  putEvidenceObject(projectId: string, logicalPath: string, bytes: ArrayBuffer, metadata: WriteMetadata) {
    return this.put(buildEvidenceKey(projectId, logicalPath), bytes, metadata, { projectId }, false);
  }
  putGeneratedArtifact(projectId: string, runId: string, logicalPath: string, bytes: ArrayBuffer, metadata: WriteMetadata) {
    return this.put(buildGeneratedKey(projectId, runId, logicalPath), bytes, metadata, { projectId, runId }, false);
  }
  putZipExport(projectId: string, zipName: string, bytes: ArrayBuffer, metadata: Omit<WriteMetadata, 'artifactKind' | 'mediaType'> = {}) {
    return this.put(buildZipExportKey(projectId, zipName), bytes, { ...metadata, artifactKind: 'zip', mediaType: 'application/zip' }, { projectId }, false);
  }
  async putReleaseArtifact(projectId: string, releaseId: string, logicalPath: string, bytes: ArrayBuffer, metadata: WriteMetadata) {
    const key = buildReleaseArtifactKey(projectId, releaseId, logicalPath);
    if (await this.headObject(key)) throw new StorageError('release_artifact_exists', 'Release artifacts cannot be overwritten.');
    return this.put(key, bytes, metadata, { projectId, releaseId }, true);
  }
  private async put(key: string, bytes: ArrayBuffer, metadata: WriteMetadata, context: Record<string, string>, immutable: boolean): Promise<ObjectReference> {
    if (!metadata.mediaType || /[\r\n]/.test(metadata.mediaType) || metadata.mediaType.length > 100 ||
      bytes.byteLength > 60 * 1024 * 1024 || (bytes.byteLength === 0 && metadata.byteSize !== 0) ||
      (metadata.byteSize !== undefined && metadata.byteSize !== bytes.byteLength) ||
      (metadata.sha256 !== undefined && !Sha256Schema.safeParse(metadata.sha256).success)) {
      throw new StorageError('invalid_object_metadata', 'File length, hash, or media type is invalid.');
    }
    const hash = await sha256(bytes);
    if (metadata.sha256 !== undefined && hash !== metadata.sha256) throw new StorageError('invalid_object_metadata', 'File SHA-256 does not match the supplied hash.');
    const reference = { objectKey: key, sha256: hash, mediaType: metadata.mediaType, byteSize: bytes.byteLength, immutable };
    const result = await this.files.put(key, bytes, {
      httpMetadata: { contentType: metadata.mediaType },
      customMetadata: { ...context, sha256: hash, mediaType: metadata.mediaType, byteSize: String(bytes.byteLength), artifactKind: metadata.artifactKind, immutable: String(immutable) },
      // The head check gives a useful error; this condition also prevents racing writers.
      ...(immutable ? { onlyIf: { etagDoesNotMatch: '*' } } : {}),
    });
    if (!result) throw new StorageError(immutable ? 'release_artifact_exists' : 'object_write_failed', 'The object storage write was not accepted.');
    return reference;
  }
}
