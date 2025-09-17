'use server';
/**
 * @fileOverview Deletes a draft record from the drafts.json file in Firebase Storage.
 */

import { getAi } from '@/ai/genkit';
import { z } from 'genkit';
import { DraftsFileSchema } from '@/lib/drafts-schema';
import { readJSON, writeJSON } from '@/lib/storage';

const ai = await getAi();

const DeleteDraftInputSchema = z.object({
  draftId: z.string().describe('The unique ID of the draft record to delete.'),
});

export async function deleteDraft(input: { draftId: string }): Promise<void> {
  return deleteDraftFlow(input);
}

const deleteDraftFlow = ai.defineFlow(
  {
    name: 'deleteDraftFlow',
    inputSchema: DeleteDraftInputSchema,
    outputSchema: z.void(),
  },
  async ({ draftId }) => {
    const storagePath = 'json/drafts.json';
    try {
      const jsonData = await readJSON(storagePath);
      const records = DraftsFileSchema.parse(jsonData);
      
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
      console.error(`Failed to delete draft record ${draftId}:`, error);
      throw new Error(`Failed to delete from drafts.json in Firebase Storage: ${error.message}`);
    }
  }
);
