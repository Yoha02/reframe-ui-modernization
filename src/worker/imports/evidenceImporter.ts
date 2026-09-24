import { Inflate } from 'fflate';
import { EvidenceManifestSchema, type EvidenceManifest } from '../../shared/schemas/evidenceManifest';
import { SafePathSchema } from '../../shared/schemas/common';
import { ApiError } from '../db/bindings';
import { sha256 } from '../storage/filesRepository';
export const importLimits = { maxUploadBytes: 20 * 1024 * 1024,maxExpandedBytes: 60 * 1024 * 1024,maxFileBytes: 10 * 1024 * 1024,maxFileCount: 500 };
export function validateBundlePath(name: string) {
  if (!SafePathSchema.safeParse(name).success) throw new ApiError('IMPORT_PATH_TRAVERSAL',400,'Archive paths must stay inside the evidence bundle.',{ path: name.slice(0,512) });
}
export function readBoundedZip(bytes: Uint8Array, limits = importLimits): Map<string,Uint8Array> {
  if (bytes.byteLength > limits.maxUploadBytes) throw new ApiError('IMPORT_UPLOAD_TOO_LARGE',413,'The evidence ZIP exceeds the upload limit.');
  const invalid = () => new ApiError('IMPORT_INVALID_ARCHIVE',400,'Use a standard, unencrypted ZIP archive.');
  const view = new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const u16 = (offset: number) => { if (offset < 0 || offset + 2 > bytes.length) throw invalid(); return view.getUint16(offset,true); };
  const u32 = (offset: number) => { if (offset < 0 || offset + 4 > bytes.length) throw invalid(); return view.getUint32(offset,true); };
  let end = bytes.length - 22;
  while (end >= Math.max(0,bytes.length - 65557) && u32(end) !== 0x06054b50) end--;
  if (end < 0 || u32(end) !== 0x06054b50 || end + 22 + u16(end + 20) !== bytes.length || u16(end + 4) || u16(end + 6)) throw invalid();
  const count = u16(end + 10); if (count !== u16(end + 8)) throw invalid();
  if (count > limits.maxFileCount) throw new ApiError('IMPORT_TOO_MANY_FILES',400,'The bundle contains too many files.');
  let offset = u32(end + 16); const directoryEnd = offset + u32(end + 12);
  if (directoryEnd !== end) throw invalid();
  let expanded = 0; const names = new Set<string>();
  const entries: { name: string; start: number; compressed: number; size: number; method: number }[] = [];
  const decoder = new TextDecoder('utf-8',{ fatal: true });
  for (let i = 0; i < count; i++) {
    if (u32(offset) !== 0x02014b50 || u16(offset + 8) & 1) throw invalid();
    const method = u16(offset + 10), compressed = u32(offset + 20), size = u32(offset + 24), nameLength = u16(offset + 28);
    const name = decoder.decode(bytes.subarray(offset + 46,offset + 46 + nameLength));
    const directory = name.endsWith('/'); validateBundlePath(directory ? name.slice(0,-1) : name);
    if (names.has(name.toLowerCase())) throw new ApiError('IMPORT_DUPLICATE_PATH',400,'Archive paths must be unique, including casing.');
    names.add(name.toLowerCase());
    if (size > limits.maxFileBytes) throw new ApiError('IMPORT_FILE_TOO_LARGE',400,'A file exceeds the evidence limit.',{ path: name });
    expanded += size; if (expanded > limits.maxExpandedBytes) throw new ApiError('IMPORT_EXPANSION_LIMIT',413,'The expanded bundle exceeds the evidence limit.');
    if (![0,8].includes(method) || (u32(offset + 38) >>> 16 & 0xf000) === 0xa000) throw invalid();
    const local = u32(offset + 42);
    if (u32(local) !== 0x04034b50 || u16(local + 8) !== method || u16(local + 6) & 1) throw invalid();
    const localNameLength = u16(local + 26);
    if (decoder.decode(bytes.subarray(local + 30,local + 30 + localNameLength)) !== name) throw invalid();
    const start = local + 30 + localNameLength + u16(local + 28);
    if (start + compressed > u32(end + 16) || start < local) throw invalid();
    if (!directory) entries.push({ name,start,compressed,size,method });
    offset += 46 + nameLength + u16(offset + 30) + u16(offset + 32);
  }
  if (offset !== directoryEnd) throw invalid();
  const files = new Map<string,Uint8Array>();
  for (const entry of entries) {
    const compressed = bytes.subarray(entry.start,entry.start + entry.compressed);
    let result: Uint8Array;
    if (entry.method === 0) result = compressed.slice();
    else {
      const chunks: Uint8Array[] = []; let total = 0;
      const inflate = new Inflate(chunk => {
        total += chunk.length;
        if (total > entry.size || total > limits.maxFileBytes) throw new ApiError('IMPORT_EXPANSION_LIMIT',413,'Archive expansion does not match its declared size.');
        chunks.push(chunk);
      });
      // Incremental input bounds each output allocation even when a ZIP lies about its size.
      for (let position = 0; position < compressed.length; position += 1024) inflate.push(compressed.subarray(position,position + 1024),position + 1024 >= compressed.length);
      result = new Uint8Array(total); let position = 0; for (const chunk of chunks) { result.set(chunk,position); position += chunk.length; }
    }
    if (result.length !== entry.size) throw invalid();
    files.set(entry.name,result);
  }
  return files;
}
export async function validateEvidenceBundle(bytes: Uint8Array): Promise<{ manifest: EvidenceManifest; files: Map<string,Uint8Array>; warnings: string[] }> {
  let files: Map<string,Uint8Array>;
  try { files = readBoundedZip(bytes); } catch (error) { if (error instanceof ApiError) throw error; throw new ApiError('IMPORT_INVALID_ARCHIVE',400,'The evidence archive could not be read.'); }
  let raw: unknown;
  try { raw = JSON.parse(new TextDecoder().decode(files.get('evidence-manifest.json'))); }
  catch { throw new ApiError('IMPORT_INCOMPATIBLE_MANIFEST',400,'A valid evidence-manifest.json is required.'); }
  const parsed = EvidenceManifestSchema.safeParse(raw);
  if (!parsed.success) throw new ApiError('IMPORT_INCOMPATIBLE_MANIFEST',400,'The evidence manifest does not match the supported format.',parsed.error.issues.map(issue => ({ path: issue.path.join('.'),message: issue.message })));
  const manifest = parsed.data; const warnings: string[] = [];
  const refs = [...manifest.assets.map(asset => asset.file),...manifest.pages.flatMap(page => [page.html,page.screenshot])];
  for (const ref of refs) {
    const file = files.get(ref.objectKey);
    if (!file) throw new ApiError('IMPORT_REQUIRED_FILE_MISSING',400,'A referenced evidence file is missing.',{ path: ref.objectKey });
    if (file.byteLength !== ref.byteSize || await sha256(Uint8Array.from(file).buffer) !== ref.sha256) throw new ApiError('IMPORT_HASH_MISMATCH',400,'An evidence file does not match its recorded hash.',{ path: ref.objectKey });
  }
  for (const page of manifest.pages) {
    if (!['image/jpeg','image/png','image/webp'].includes(page.screenshot.mediaType)) throw new ApiError('IMPORT_INCOMPATIBLE_MANIFEST',400,'Use a PNG, JPEG or WebP screenshot.');
    const ids = new Set(page.content.map(block => block.id));
    if (ids.size !== page.content.length || new Set(page.regions.map(region => region.id)).size !== page.regions.length) throw new ApiError('IMPORT_DUPLICATE_ID',400,'Evidence identifiers must be unique within each page.');
    if (page.regions.some(region => region.sourceIds.some(id => !ids.has(id)))) throw new ApiError('IMPORT_INVALID_REFERENCE',400,'A crop references missing source content.');
    const html = new TextDecoder().decode(files.get(page.html.objectKey));
    if (/<script\b|\bon\w+\s*=|javascript:/i.test(html)) warnings.push(`${page.title}: executable legacy behavior retained only as inert source text.`);
    const parents = new Map(page.frames.map(frame => [frame.sourceUrl,frame.parentUrl]));
    for (const frame of page.frames) { const seen = new Set<string>(); let url: string | undefined = frame.sourceUrl;
      while (url) { if (seen.has(url)) throw new ApiError('IMPORT_FRAME_CYCLE',400,'Frame ancestry must not contain a cycle.'); seen.add(url); url = parents.get(url); }
    }
  }
  for (const asset of manifest.assets) if (!['image/png','image/jpeg','image/webp','image/gif'].includes(asset.file.mediaType)) throw new ApiError('IMPORT_UNSUPPORTED_ASSET',400,'Only raster image assets are supported for this demo.');
  return { manifest,files,warnings };
}
