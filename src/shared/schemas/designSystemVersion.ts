import { z } from 'zod';
import { ApprovalStatusSchema, EvidenceReferenceSchema, IdSchema, Sha256Schema, TimestampSchema } from './common';

const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const font = z.enum(['DM Sans', 'Manrope', 'Inter', 'Space Grotesk', 'Georgia', 'Arial', 'system-ui']);
export const DesignTokensSchema = z.strictObject({
  colors: z.strictObject({ background: color, surface: color, text: color, muted: color, primary: color, accent: color, border: color }),
  typography: z.strictObject({ headingFont: font, bodyFont: font, baseSize: z.number().int().min(14).max(24), headingScale: z.number().min(1.1).max(1.6) }),
  spacing: z.array(z.number().int().min(0).max(128)).min(3).max(12),
  radius: z.number().int().min(0).max(40), maxWidth: z.number().int().min(800).max(1600),
});
export const DesignSystemVersionSchema = z.strictObject({
  id: IdSchema, projectId: IdSchema, version: z.number().int().positive(), name: z.string().min(1).max(150),
  status: ApprovalStatusSchema, immutable: z.boolean(), sourceFingerprint: Sha256Schema,
  tokens: DesignTokensSchema,
  componentStyles: z.array(z.strictObject({ name: z.string().min(1).max(100), recipe: z.enum(['solid', 'outline', 'quiet', 'elevated']), rationale: z.string().max(1500) })).min(1).max(20),
  rationale: z.array(z.strictObject({ decision: z.string().min(1).max(1500), evidence: z.array(EvidenceReferenceSchema).min(1).max(30) })).min(1).max(30),
  createdAt: TimestampSchema, approvedAt: TimestampSchema.optional(), approvedBy: z.string().min(1).max(200).optional(),
}).superRefine((system, ctx) => {
  if (system.status === 'approved' && (!system.approvedAt || !system.approvedBy || !system.immutable)) ctx.addIssue({ code: 'custom', message: 'Approved design systems require immutable approval metadata' });
  if (system.status === 'draft' && (system.approvedAt || system.approvedBy || system.immutable)) ctx.addIssue({ code: 'custom', message: 'Drafts cannot carry approval metadata' });
});
export type DesignTokens = z.infer<typeof DesignTokensSchema>;
export type DesignSystemVersion = z.infer<typeof DesignSystemVersionSchema>;
