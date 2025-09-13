import { z } from 'zod';

export const HistoryRecordSchema = z.object({
  draftId: z.string(),
  propertyAddress: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  data: z.any(),
  ifreplacetext: z.boolean().optional().default(false),
  ifreplaceimage: z.boolean().optional().default(false),
});

export type HistoryRecord = z.infer<typeof HistoryRecordSchema>;

export const HistoryFileSchema = z.array(HistoryRecordSchema);
export type HistoryFile = z.infer<typeof HistoryFileSchema>;
