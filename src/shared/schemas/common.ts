import { z } from 'zod';

export const IdSchema = z.string().min(1).max(120).regex(/^[a-zA-Z0-9_-]+$/);
export const SafePathSchema = z.string().min(1).max(512).refine(path =>
  !/^[\\/]/.test(path) && !/[\\:%?#]/.test(path) && ![...path].some(char => char.charCodeAt(0) < 32) &&
  path.split('/').every(part => part !== '' && part !== '.' && part !== '..'), 'A relative path without traversal or encoded separators is required');
export const RouteSchema = z.string().max(256).refine(route => route === '/' ||
  (route.startsWith('/') && !route.startsWith('//') && SafePathSchema.safeParse(route.slice(1).replace(/\/$/, '')).success), 'Invalid site route');
export const HttpUrlSchema = z.url().refine(value => /^https?:\/\//i.test(value), 'HTTP or HTTPS URL required');
export const SafeHrefSchema = z.string().min(1).max(2000).refine(value =>
  !/[<>"'`]/.test(value) && ![...value].some(char => char.charCodeAt(0) <= 32) &&
  (/^https?:\/\//i.test(value) ? HttpUrlSchema.safeParse(value).success :
    /^(mailto:|tel:|#)/i.test(value) || RouteSchema.safeParse(value).success || SafePathSchema.safeParse(value).success), 'Unsafe link destination');
export const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/);
export const TimestampSchema = z.iso.datetime();
export const WorkflowStageSchema = z.enum(['import', 'evaluate', 'decompose', 'design_system', 'rebuild', 'review', 'publish']);
export const RunStatusSchema = z.enum(['started', 'completed', 'failed', 'retryable', 'cached']);
export const ApprovalStatusSchema = z.enum(['draft', 'approved']);
export const ArtifactKindSchema = z.enum(['html', 'css', 'image', 'screenshot', 'text', 'manifest', 'zip', 'font']);
export const ReleaseStateSchema = z.enum(['pending', 'publishing', 'published', 'failed', 'compatibility_error']);
export const ObjectReferenceSchema = z.strictObject({
  objectKey: SafePathSchema, sha256: Sha256Schema, mediaType: z.string().min(1).max(100),
  byteSize: z.number().int().nonnegative().max(60 * 1024 * 1024), immutable: z.boolean(),
});
export const EvidenceReferenceSchema = z.strictObject({ pageId: IdSchema, regionId: IdSchema.optional(), sourceId: IdSchema.optional() });
export const SourceContentSchema = z.strictObject({
  id: IdSchema, kind: z.enum(['heading', 'paragraph', 'link', 'image', 'copyright']),
  text: z.string().max(12000), href: SafeHrefSchema.optional(), assetId: IdSchema.optional(),
  level: z.number().int().min(1).max(6).optional(),
});
