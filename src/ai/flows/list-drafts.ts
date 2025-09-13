'use server';
/**
 * @fileOverview Lists all available drafts from the drafts.json file.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';
import { DraftsFileSchema, DraftSummarySchema, type DraftSummary } from '@/lib/drafts-schema';

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
    const filePath = path.join(process.cwd(), 'src', 'lib', 'drafts.json');
    try {
      const jsonString = await fs.readFile(filePath, 'utf-8');
      const drafts = DraftsFileSchema.parse(JSON.parse(jsonString));
      
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
      if (error.code === 'ENOENT') {
        // If the file doesn't exist, create it with an empty array.
        await fs.writeFile(filePath, '[]', 'utf-8');
        return [];
      }
      console.error('Failed to list drafts:', error);
      throw new Error(`Failed to read or parse drafts.json: ${error.message}`);
    }
  }
);
