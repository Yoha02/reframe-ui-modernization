import { z } from 'zod';
import { IdSchema, ObjectReferenceSchema, RouteSchema, SafeHrefSchema, SourceContentSchema } from './common';

export const ComponentKindSchema = z.enum(['header', 'hero', 'section_heading', 'text', 'image', 'card_grid', 'profile_card', 'gallery', 'cta', 'footer']);
export const PageSchema = z.strictObject({
  schemaVersion: z.literal(1), id: IdSchema, projectId: IdSchema, pageId: IdSchema,
  designSystemVersionId: IdSchema, title: z.string().min(1).max(200), route: RouteSchema,
  description: z.string().max(500), preservedContent: z.array(SourceContentSchema).min(1).max(500),
  sections: z.array(z.strictObject({
    id: IdSchema, kind: ComponentKindSchema, sourceIds: z.array(IdSchema).min(1).max(100),
    heading: z.string().max(300).optional(), text: z.string().max(12000).optional(), assetIds: z.array(IdSchema).max(50),
    links: z.array(z.strictObject({ label: z.string().min(1).max(300), href: SafeHrefSchema })).max(100),
    layout: z.enum(['stack', 'split', 'grid', 'wide']), emphasis: z.enum(['normal', 'quiet', 'accent']),
  })).min(1).max(50),
  artifactReferences: z.array(ObjectReferenceSchema).max(500),
}).superRefine((page, ctx) => {
  const ids = new Set(page.preservedContent.map(c => c.id));
  if (ids.size !== page.preservedContent.length) ctx.addIssue({ code: 'custom', message: 'Duplicate source content IDs' });
  if (new Set(page.sections.map(s => s.id)).size !== page.sections.length) ctx.addIssue({ code: 'custom', message: 'Duplicate section IDs' });
  for (const section of page.sections) {
    if (section.sourceIds.some(id => !ids.has(id))) ctx.addIssue({ code: 'custom', message: 'Section references unknown source content' });
  }
});
export type PageSpecification = z.infer<typeof PageSchema>;
