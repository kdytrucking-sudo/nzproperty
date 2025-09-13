'use server';
/**
 * @fileOverview Saves or updates a history record to the history.json file.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';
import { HistoryRecordSchema, HistoryFileSchema } from '@/lib/history-schema';
import * as crypto from 'crypto';

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
    const filePath = path.join(process.cwd(), 'src/lib', 'history.json');
    const now = new Date().toISOString();

    // Use provided draftId or generate a new one if not available
    const draftId = inputDraftId || crypto.randomUUID();

    try {
      let historyRecords: z.infer<typeof HistoryFileSchema> = [];
      try {
        const jsonString = await fs.readFile(filePath, 'utf-8');
        historyRecords = HistoryFileSchema.parse(JSON.parse(jsonString));
      } catch (e: any) {
        if (e.code !== 'ENOENT') throw e;
        await fs.writeFile(filePath, '[]', 'utf-8');
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
      
      const contentJsonString = JSON.stringify(historyRecords, null, 2);
      await fs.writeFile(filePath, contentJsonString, 'utf-8');

    } catch (error: any) {
      console.error('Failed to save history:', error);
      throw new Error(`Failed to write to history.json: ${error.message}`);
    }
  }
);
