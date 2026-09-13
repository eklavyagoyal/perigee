import { z } from 'zod';

const variant = z.object({
  prefix: z.string().regex(/^\/sequences\/[a-z0-9-]+\/(desktop|mobile)\/$/),
  count: z.number().int().min(2).max(600),
  width: z.number().int().min(1).max(1920),
  height: z.number().int().min(1).max(1920),
  fps: z.number().int().min(1).max(30),
}).strict();
export const frameManifestSchema = z.object({ version: z.literal(1), desktop: variant, mobile: variant.optional() }).strict();
export type FrameVariant = z.infer<typeof variant>;
export function frameIndex(progress: number, count: number) {
  return Math.round(Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0)) * (count - 1));
}
export function frameURL(variant: FrameVariant, index: number) {
  return `${variant.prefix}frame-${String(index).padStart(5, '0')}.webp`;
}
