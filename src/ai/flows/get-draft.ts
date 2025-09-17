'use server';
/**
 * @fileOverview Retrieves a specific draft from Firebase Storage.
 */

import { getAi } from '@/ai/genkit';
import { z } from 'zod';
import { DraftSchema, DraftsFileSchema, type Draft } from '@/lib/drafts-schema';
import { readJSON } from '@/lib/storage'; // Firebase Storage 封装

const ai = await getAi();

const GetDraftInputSchema = z.object({
  draftId: z.string().optional(),
  propertyAddress: z.string().optional(),
}).refine(data => data.draftId || data.propertyAddress, {
  message: "Either draftId or propertyAddress must be provided.",
});

export async function getDraft(input: z.infer<typeof GetDraftInputSchema>) {
  return getDraftFlow(input);
}

const getDraftFlow = ai.defineFlow(
  {
    name: 'getDraftFlow',
    inputSchema: GetDraftInputSchema,
    outputSchema: z.object({
      draft: DraftSchema.nullable(),
      debugLogs: z.array(z.string())
    }),
  },
  async ({ draftId, propertyAddress }) => {
    const storagePath = 'json/drafts.json'; // CORRECTED PATH
    const debugLogs: string[] = [];
    debugLogs.push(`Attempting to read from Firebase Storage path: ${storagePath}`);

    try {
      // Directly read the JSON file from Firebase Storage using the helper
      const jsonData = await readJSON(storagePath);
      debugLogs.push(`Successfully read and parsed drafts.json.`);
      
      const drafts = DraftsFileSchema.parse(jsonData);
      debugLogs.push(`Found ${drafts.length} drafts in the file.`);

      let foundDraft: Draft | undefined;
      
      if (draftId) {
        const normalizedDraftId = draftId.trim();
        foundDraft = drafts.find(d => d.draftId?.trim() === normalizedDraftId);
        debugLogs.push(`Searching by draftId: "${normalizedDraftId}". Found: ${foundDraft ? 'YES' : 'NO'}`);
      } else if (propertyAddress) {
        const normalizedAddress = propertyAddress.trim();
        const matchingDrafts = drafts.filter(d => d.propertyAddress?.trim() === normalizedAddress);
        debugLogs.push(`Searching by address: "${normalizedAddress}". Found ${matchingDrafts.length} match(es).`);

        if (matchingDrafts.length > 0) {
          // If multiple drafts have the same address, return the most recently updated one.
          matchingDrafts.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
          foundDraft = matchingDrafts[0];
          debugLogs.push(`Selected the most recent draft, updated at: ${foundDraft.updatedAt}`);
        }
      }

      return { draft: foundDraft || null, debugLogs };

    } catch (err: any) {
      debugLogs.push(`Error during process: ${err.message}`);
      // Distinguish between file-not-found and other errors
      if (err.message.includes('not found') || err.message.includes('No object exists')) {
         throw new Error(`Drafts file not found on the server at path: ${storagePath}. Ensure a draft has been saved first.`);
      }
      throw new Error(`Failed to read or process drafts from Firebase Storage: ${err.message}`);
    }
  }
);
