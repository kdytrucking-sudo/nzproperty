'use server';
/**
 * @fileOverview Lists all available drafts from the drafts.json file in Firebase Storage.
 */

import { getAi } from '@/ai/genkit';
import { z } from 'genkit';
import { DraftsFileSchema, DraftSummarySchema, type DraftSummary } from '@/lib/drafts-schema';
import { readJSON, writeJSON } from '@/lib/storage'; // Firebase Storage 封装

const ai = await getAi();

export async function listDrafts(): Promise<DraftSummary[]> {
  return listDraftsFlow();
}

const listDraftsFlow = ai.defineFlow(
  {
    name: 'listDraftsFlow',
    inputSchema: z.void(),
    outputSchema: z.array(DraftSummarySchema),
  },
  async () => {
    const storagePath = 'json/drafts.json';
    try {
      const jsonData = await readJSON(storagePath);
      const drafts = DraftsFileSchema.parse(jsonData);
      
      // Sort drafts by last updated date, descending
      drafts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      // Return only the summary fields
      return drafts.map(({ draftId, propertyAddress, placeId, createdAt, updatedAt }) => ({
        draftId,
        propertyAddress,
        placeId,
        createdAt,
        updatedAt
      }));
    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('No object exists')) {
        // If the file doesn't exist, create it with an empty array.
        await writeJSON(storagePath, []);
        return [];
      }
      console.error('Failed to list drafts:', error);
      throw new Error(`Failed to read or parse drafts.json from Firebase Storage: ${error.message}`);
    }
  }
);
