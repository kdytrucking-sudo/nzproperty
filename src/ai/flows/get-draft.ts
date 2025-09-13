'use server';
/**
 * @fileOverview Retrieves a specific draft from the drafts.json file.
 * Can query by draftId or propertyAddress.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';
import { DraftSchema, DraftsFileSchema, type Draft } from '@/lib/drafts-schema';

const GetDraftInputSchema = z.object({
  draftId: z.string().optional(),
  propertyAddress: z.string().optional(),
}).refine(data => data.draftId || data.propertyAddress, {
  message: "Either draftId or propertyAddress must be provided.",
});


export async function getDraft(input: z.infer<typeof GetDraftInputSchema>): Promise<Draft | null> {
  return getDraftFlow(input);
}

const getDraftFlow = ai.defineFlow(
  {
    name: 'getDraftFlow',
    inputSchema: GetDraftInputSchema,
    outputSchema: DraftSchema.nullable(),
  },
  async ({ draftId, propertyAddress }) => {
    const filePath = path.join(process.cwd(), 'src', 'lib', 'drafts.json');
    try {
      const jsonString = await fs.readFile(filePath, 'utf-8');
      const drafts = DraftsFileSchema.parse(JSON.parse(jsonString));
      
      let draft: Draft | undefined;
      if (draftId) {
        draft = drafts.find(d => d.draftId === draftId);
      } else if (propertyAddress) {
        // Find the most recently updated draft for a given address
        const matchingDrafts = drafts.filter(d => d.propertyAddress === propertyAddress);
        if (matchingDrafts.length > 0) {
            matchingDrafts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
            draft = matchingDrafts[0];
        }
      }
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
