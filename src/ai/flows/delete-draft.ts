'use server';
/**
 * @fileOverview Deletes a draft record from the drafts.json file.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';
import { DraftsFileSchema } from '@/lib/drafts-schema';

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
    const filePath = path.join(process.cwd(), 'src/lib', 'drafts.json');
    try {
      const jsonString = await fs.readFile(filePath, 'utf-8');
      const records = DraftsFileSchema.parse(JSON.parse(jsonString));
      
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
      console.error(`Failed to delete draft record ${draftId}:`, error);
      throw new Error(`Failed to delete from drafts.json: ${error.message}`);
    }
  }
);
