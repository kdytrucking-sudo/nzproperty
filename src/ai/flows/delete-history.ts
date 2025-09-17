
'use server';
/**
 * @fileOverview Deletes a history record from the history.json file in Firebase Storage.
 */

import { getAi } from '@/ai/genkit';
import { z } from 'genkit';
import { HistoryFileSchema } from '@/lib/history-schema';
import { readJSON, writeJSON } from '@/lib/storage';

const ai = await getAi();

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
    const storagePath = 'json/history.json';
    try {
      const jsonData = await readJSON(storagePath);
      const records = HistoryFileSchema.parse(jsonData);
      
      const updatedRecords = records.filter(d => d.draftId !== draftId);

      if (updatedRecords.length === records.length) {
        // No record was found to delete, treat as success.
        return;
      }

      await writeJSON(storagePath, updatedRecords);

    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('No object exists')) {
        return; // File doesn't exist, so nothing to delete.
      }
      console.error(`Failed to delete history record ${draftId}:`, error);
      throw new Error(`Failed to delete from history.json in Firebase Storage: ${error.message}`);
    }
  }
);
