import type { FilesBinding, ObjectBody, StoredObject } from '../../../src/worker/storage/filesRepository';
// Test-only R2-compatible fixture, not a production storage substitute.
export class MemoryBucket implements FilesBinding {
  readonly objects = new Map<string, { bytes: ArrayBuffer; metadata: StoredObject }>();
  async put(key: string, bytes: ArrayBuffer, options: Parameters<FilesBinding['put']>[2]) {
    if (options.onlyIf?.etagDoesNotMatch === '*' && this.objects.has(key)) return null;
    const metadata = { key, size: bytes.byteLength, etag: `fixture-${this.objects.size}`, customMetadata: { ...options.customMetadata }, httpMetadata: { ...options.httpMetadata } };
    this.objects.set(key, { bytes: bytes.slice(0), metadata });
    return metadata;
  }
  async head(key: string) { return this.objects.get(key)?.metadata ?? null; }
  async get(key: string): Promise<ObjectBody | null> {
    const object = this.objects.get(key);
    return object ? { ...object.metadata, arrayBuffer: async () => object.bytes.slice(0) } : null;
  }
}
