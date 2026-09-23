import { z } from 'zod';
import { IdSchema,SafePathSchema,Sha256Schema } from './common';
export const ReleaseTransferSchema = z.strictObject({
  releaseId: IdSchema,files: z.array(z.strictObject({ path: SafePathSchema,sha256: Sha256Schema,mediaType: z.enum(['text/html','text/css','image/jpeg','image/png','image/webp','image/gif']),byteSize: z.number().int().positive().max(10 * 1024 * 1024) })).min(2).max(100),
}).superRefine((value,ctx) => { if (new Set(value.files.map(f => f.path.toLowerCase())).size !== value.files.length || !value.files.some(f => f.path === 'index.html' && f.mediaType === 'text/html')) ctx.addIssue({ code: 'custom',message: 'A unique home page is required.' }); });
export type ReleaseTransfer = z.infer<typeof ReleaseTransferSchema>;
