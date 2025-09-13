'use server';
/**
 * @fileOverview Retrieves a specific draft from the drafts.json file.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';
import { DraftSchema, DraftsFileSchema, type Draft } from '@/lib/drafts-schema';

const GetDraftInputSchema = z.object({
  draftId: z.string().describe('The unique ID of the draft to retrieve.'),
});

export async function getDraft(input: { draftId: string }): Promise<Draft | null> {
  return getDraftFlow(input);
}

const getDraftFlow = ai.defineFlow(
  {
    name: 'getDraftFlow',
    inputSchema: GetDraftInputSchema,
    outputSchema: DraftSchema.nullable(),
  },
  async ({ draftId }) => {
    const filePath = path.join(process.cwd(), 'src', 'lib', 'drafts.json');
    try {
      const jsonString = await fs.readFile(filePath, 'utf-8');
      const drafts = DraftsFileSchema.parse(JSON.parse(jsonString));
      const draft = drafts.find(d => d.draftId === draftId);
      return draft || null;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return null; // File doesn't exist, so no draft.
      }
      console.error('Failed to get draft:', error);
      throw new Error(`Failed to read or parse drafts.json: ${error.message}`);
    }
  }
);
