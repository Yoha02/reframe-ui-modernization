import { z } from 'zod';
import { ArtifactKindSchema, HttpUrlSchema, IdSchema, ObjectReferenceSchema, ReleaseStateSchema, RouteSchema, SafePathSchema, Sha256Schema, TimestampSchema } from './common';

export const ReleaseManifestSchema = z.strictObject({
  schemaVersion: z.literal(1), releaseId: IdSchema, projectId: IdSchema, designSystemVersionId: IdSchema,
  immutable: z.literal(true), createdAt: TimestampSchema, previousReleaseId: IdSchema.optional(),
  routes: z.array(z.strictObject({ pageId: IdSchema, route: RouteSchema, artifactKey: SafePathSchema, approvalId: IdSchema })).min(1).max(3),
  artifacts: z.array(ObjectReferenceSchema.extend({ kind: ArtifactKindSchema, immutable: z.literal(true) })).min(1).max(500),
  hashes: z.record(SafePathSchema, Sha256Schema), zipArtifactKey: SafePathSchema,
  publicState: ReleaseStateSchema, publicUrl: HttpUrlSchema.optional(), verifiedAt: TimestampSchema.optional(),
}).superRefine((release, ctx) => {
  if (release.publicState === 'published' && (!release.publicUrl || !release.verifiedAt)) ctx.addIssue({ code: 'custom', message: 'Published releases require a verified public URL' });
  const keys = new Set(release.artifacts.map(a => a.objectKey));
  if (keys.size !== release.artifacts.length) ctx.addIssue({ code: 'custom', message: 'Duplicate release artifact keys' });
  if (new Set(release.routes.map(r => r.route)).size !== release.routes.length) ctx.addIssue({ code: 'custom', message: 'Duplicate release routes' });
  for (const route of release.routes) if (!keys.has(route.artifactKey)) ctx.addIssue({ code: 'custom', message: 'Route points to a missing release artifact' });
  for (const artifact of release.artifacts) if (release.hashes[artifact.objectKey] !== artifact.sha256) ctx.addIssue({ code: 'custom', message: 'Artifact hash does not match the release manifest' });
  if (!release.artifacts.some(a => a.objectKey === release.zipArtifactKey && a.kind === 'zip')) ctx.addIssue({ code: 'custom', message: 'ZIP artifact is missing' });
});
export type ReleaseManifest = z.infer<typeof ReleaseManifestSchema>;
