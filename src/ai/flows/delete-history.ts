
'use server';
/**
 * @fileOverview Deletes a history record from the history.json file.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';
import { HistoryFileSchema } from '@/lib/history-schema';

const DeleteHistoryInputSchema = z.object({
  draftId: z.string().describe('The unique ID of the history record to delete.'),
});

export async function deleteHistory(input: { draftId: string }): Promise<void> {
  return deleteHistoryFlow(input);
}

const deleteHistoryFlow = ai.defineFlow(
  {
    name: 'deleteHistoryFlow',
    inputSchema: DeleteHistoryInputSchema,
    outputSchema: z.void(),
  },
  async ({ draftId }) => {
    const filePath = path.join(process.cwd(), 'src/lib', 'history.json');
    try {
      const jsonString = await fs.readFile(filePath, 'utf-8');
      const records = HistoryFileSchema.parse(JSON.parse(jsonString));
      
      const updatedRecords = records.filter(d => d.draftId !== draftId);

      if (updatedRecords.length === records.length) {
        // No record was found to delete, treat as success.
        return;
      }

      const contentJsonString = JSON.stringify(updatedRecords, null, 2);
      await fs.writeFile(filePath, contentJsonString, 'utf-8');

    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return; // File doesn't exist, so nothing to delete.
      }
      console.error(`Failed to delete history record ${draftId}:`, error);
      throw new Error(`Failed to delete from history.json: ${error.message}`);
    }
  }
);
