
'use server';
/**
 * @fileOverview Saves or updates a history record to the history.json file in Firebase Storage.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { HistoryRecordSchema, HistoryFileSchema } from '@/lib/history-schema';
import * as crypto from 'crypto';
import { readJSON, writeJSON } from '@/lib/storage';

const SaveHistoryInputSchema = z.object({
  draftId: z.string().optional(),
  propertyAddress: z.string(),
  data: z.any(),
  ifreplacetext: z.boolean().optional(),
  ifreplaceimage: z.boolean().optional(),
});

export async function saveHistory(input: z.infer<typeof SaveHistoryInputSchema>): Promise<void> {
  return saveHistoryFlow(input);
}

const saveHistoryFlow = ai.defineFlow(
  {
    name: 'saveHistoryFlow',
    inputSchema: SaveHistoryInputSchema,
    outputSchema: z.void(),
  },
  async ({ draftId: inputDraftId, propertyAddress, data, ifreplacetext, ifreplaceimage }) => {
    const storagePath = 'json/history.json';
    const now = new Date().toISOString();

    // Use provided draftId or generate a new one if not available
    const draftId = inputDraftId || crypto.randomUUID();

    try {
      let historyRecords: z.infer<typeof HistoryFileSchema> = [];
      try {
        const jsonData = await readJSON(storagePath);
        historyRecords = HistoryFileSchema.parse(jsonData);
      } catch (e: any) {
        if (e.message.includes('not found') || e.message.includes('No object exists')) {
            // File doesn't exist, start with an empty array
            historyRecords = [];
        } else {
            throw e; // Re-throw other errors
        }
      }

      const existingRecordIndex = historyRecords.findIndex(r => r.draftId === draftId);

      if (existingRecordIndex !== -1) {
        // Update existing record
        const existingRecord = historyRecords[existingRecordIndex];
        
        historyRecords[existingRecordIndex] = HistoryRecordSchema.parse({
          ...existingRecord,
          propertyAddress: propertyAddress || existingRecord.propertyAddress,
          updatedAt: now,
          data: { ...existingRecord.data, ...data }, // Simple merge, could be deeper
          ifreplacetext: ifreplacetext !== undefined ? ifreplacetext : existingRecord.ifreplacetext,
          ifreplaceimage: ifreplaceimage !== undefined ? ifreplaceimage : existingRecord.ifreplaceimage,
        });

      } else {
        // Add new record
        const newRecord = {
          draftId,
          propertyAddress,
          createdAt: now,
          updatedAt: now,
          data,
          ifreplacetext: !!ifreplacetext,
          ifreplaceimage: !!ifreplaceimage,
        };
        HistoryRecordSchema.parse(newRecord);
        historyRecords.push(newRecord);
      }
      
      await writeJSON(storagePath, historyRecords);

    } catch (error: any) {
      console.error('Failed to save history:', error);
      throw new Error(`Failed to write to history.json in Firebase Storage: ${error.message}`);
    }
  }
);
