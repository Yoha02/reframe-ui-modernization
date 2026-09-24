import { z } from 'zod';
import { IdSchema } from './common';
export const CanvasLayoutSchema = z.strictObject({
  rowVersion: z.number().int().nonnegative(),
  nodes: z.array(z.strictObject({ id: IdSchema,x: z.number().finite().min(-100000).max(100000),y: z.number().finite().min(-100000).max(100000) })).max(100),
  viewport: z.strictObject({ x: z.number().finite(),y: z.number().finite(),zoom: z.number().min(.25).max(1.8) }).nullable(),
}).superRefine((value,ctx) => { if (new Set(value.nodes.map(node => node.id)).size !== value.nodes.length) ctx.addIssue({ code: 'custom',message: 'Duplicate canvas nodes' }); });
export type CanvasLayout = z.infer<typeof CanvasLayoutSchema>;
