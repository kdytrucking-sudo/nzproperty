import { z } from 'zod';

export const DraftSummarySchema = z.object({
  draftId: z.string(),
  propertyAddress: z.string(),
  placeId: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type DraftSummary = z.infer<typeof DraftSummarySchema>;

export const DraftSchema = DraftSummarySchema.extend({
    formData: z.any(), // Using z.any() for flexibility as the form structure is complex
});
export type Draft = z.infer<typeof DraftSchema>;

export const DraftsFileSchema = z.array(DraftSchema);
export type DraftsFile = z.infer<typeof DraftsFileSchema>;
