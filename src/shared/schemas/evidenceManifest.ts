import { z } from 'zod';
import { HttpUrlSchema, IdSchema, ObjectReferenceSchema, RouteSchema, SafeHrefSchema, SafePathSchema, SourceContentSchema, TimestampSchema } from './common';

export const EvidenceManifestSchema = z.strictObject({
  schemaVersion: z.literal(1), title: z.string().min(1).max(200), sourceUrl: HttpUrlSchema,
  provenance: z.strictObject({ capturedAt: TimestampSchema, method: z.enum(['prepared_browser_capture', 'uploaded_evidence']), tool: z.string().min(1).max(100) }),
  assets: z.array(z.strictObject({ id: IdSchema, sourceUrl: HttpUrlSchema, originalPath: SafePathSchema, file: ObjectReferenceSchema, alt: z.string().max(500) })).max(500),
  pages: z.array(z.strictObject({
    id: IdSchema, title: z.string().min(1).max(200), route: RouteSchema, sourceUrl: HttpUrlSchema,
    html: ObjectReferenceSchema, screenshot: ObjectReferenceSchema, text: z.string().max(100000),
    viewport: z.strictObject({ width: z.number().int().positive().max(10000), height: z.number().int().positive().max(30000), screenshotWidth: z.number().int().positive().max(10000), screenshotHeight: z.number().int().positive().max(30000) }),
    content: z.array(SourceContentSchema).max(500),
    links: z.array(z.strictObject({ id: IdSchema, label: z.string().max(500), href: SafeHrefSchema, origin: z.enum(['anchor', 'image_map']) })).max(500),
    regions: z.array(z.strictObject({
      id: IdSchema, label: z.string().max(500), role: z.string().min(1).max(100),
      x: z.number().nonnegative(), y: z.number().nonnegative(), width: z.number().positive(), height: z.number().positive(),
      sourceIds: z.array(IdSchema).max(100), assetId: IdSchema.optional(),
    })).max(500),
    frames: z.array(z.strictObject({ sourceUrl: HttpUrlSchema, parentUrl: HttpUrlSchema.optional(), contentPageId: IdSchema.optional(), depth: z.number().int().min(0).max(3) })).max(30),
    warnings: z.array(z.string().max(1000)).max(100),
  })).min(1).max(3),
}).superRefine((manifest, ctx) => {
  for (const [key, values] of [['page IDs', manifest.pages.map(p => p.id)], ['routes', manifest.pages.map(p => p.route)], ['asset IDs', manifest.assets.map(a => a.id)]] as const) {
    if (new Set(values).size !== values.length) ctx.addIssue({ code: 'custom', message: `Duplicate ${key}` });
  }
  for (const [i, page] of manifest.pages.entries()) {
    for (const region of page.regions) {
      if (region.x + region.width > page.viewport.width + 1 || region.y + region.height > page.viewport.height + 1) {
        ctx.addIssue({ code: 'custom', path: ['pages', i, 'regions'], message: 'Source crop must stay inside the captured viewport' });
      }
    }
  }
});
export type EvidenceManifest = z.infer<typeof EvidenceManifestSchema>;
