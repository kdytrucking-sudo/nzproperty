'use server';
/**
 * @fileOverview A flow to merge AI-extracted data with an existing draft.
 *
 * - mergeAiDataWithDraft - Merges new AI data into an existing draft, prioritizing draft data.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import { getDraft } from './get-draft';
import { extractPropertyData } from './extract-property-data-from-pdf';
import { getExtractionConfig } from './get-extraction-config';

const MergeAiDataWithDraftInputSchema = z.object({
  draftId: z.string().describe('The ID of the draft to merge data into.'),
  propertyTitlePdfDataUri: z
    .string()
    .describe('A PDF file for property title, as a data URI.'),
  briefInformationPdfDataUri: z
    .string()
    .describe('A PDF file for brief information, as a data URI.'),
});

export type MergeAiDataWithDraftInput = z.infer<typeof MergeAiDataWithDraftInputSchema>;

export async function mergeAiDataWithDraft(input: MergeAiDataWithDraftInput): Promise<any> {
  return mergeAiDataWithDraftFlow(input);
}

// Recursive helper function to merge data
function mergeObjects(draft: any, ai: any, structure: any): any {
  const merged: any = {};

  for (const key in structure) {
    if (Object.prototype.hasOwnProperty.call(structure, key)) {
      const draftValue = draft?.[key];
      const aiValue = ai?.[key];
      const substructure = structure[key];

      if (typeof substructure === 'object' && !substructure.label) {
        // This is a nested object (like "Info" or "General Info"), recurse
        merged[key] = mergeObjects(draftValue, aiValue, substructure);
      } else {
        // This is a field definition
        const hasDraftValue = draftValue !== undefined && draftValue !== null && draftValue !== '' && draftValue !== 'N/A';
        merged[key] = hasDraftValue ? draftValue : aiValue;
      }
    }
  }

  return merged;
}

const mergeAiDataWithDraftFlow = ai.defineFlow(
  {
    name: 'mergeAiDataWithDraftFlow',
    inputSchema: MergeAiDataWithDraftInputSchema,
    outputSchema: z.any(),
  },
  async ({ draftId, propertyTitlePdfDataUri, briefInformationPdfDataUri }) => {
    // 1. Get existing draft data and AI-extracted data in parallel
    const [draft, aiData, config] = await Promise.all([
      getDraft({ draftId }),
      extractPropertyData({ propertyTitlePdfDataUri, briefInformationPdfDataUri }),
      getExtractionConfig()
    ]);

    if (!draft) {
      throw new Error(`Draft with ID ${draftId} not found.`);
    }
    
    if (!aiData) {
        throw new Error('AI data extraction failed.');
    }

    const jsonStructure = JSON.parse(config.jsonStructure);
    
    // 2. Perform the merge logic: draft data takes precedence
    const mergedData = mergeObjects(draft.formData.data, aiData, jsonStructure);

    // 3. Return the merged data, wrapped in the same structure as a loaded draft
    // This ensures the frontend (Step2Review) receives a consistent object.
    return {
        ...draft.formData, // Carry over other draft properties like selections, etc.
        data: mergedData, // Use the newly merged data
    };
  }
);
