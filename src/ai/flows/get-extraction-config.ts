'use server';
/**
 * @fileOverview Retrieves the current extraction configuration (JSON structure and prompts) from files in Firebase Storage.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { readJSON } from '@/lib/storage';

const ExtractionConfigOutputSchema = z.object({
  jsonStructure: z.string().describe('The JSON structure as a string.'),
  systemPrompt: z.string().describe('The system prompt for the AI.'),
  userPrompt: z.string().describe('The user prompt for the AI.'),
  extractionHintsTitle: z.string().describe('The title for the extraction hints section.'),
  extractionHints: z.string().describe('The extraction hints for the AI.'),
});

export type ExtractionConfigOutput = z.infer<typeof ExtractionConfigOutputSchema>;

export async function getExtractionConfig(): Promise<ExtractionConfigOutput> {
  return getExtractionConfigFlow();
}

const getExtractionConfigFlow = ai.defineFlow(
  {
    name: 'getExtractionConfigFlow',
    inputSchema: z.void(),
    outputSchema: ExtractionConfigOutputSchema,
  },
  async () => {
    try {
      const jsonStructureObj = await readJSON('json/json-structure.json');
      const prompts = await readJSON('json/prompts.json');

      const jsonStructure = JSON.stringify(jsonStructureObj, null, 2);

      return {
        jsonStructure,
        systemPrompt: prompts.system_prompt,
        userPrompt: prompts.user_prompt,
        extractionHintsTitle: prompts.extraction_hints_title,
        extractionHints: prompts.extraction_hints,
      };
    } catch (error: any) {
      console.error('Failed to get extraction config from Storage:', error);
      throw new Error(`Failed to read config files from Firebase Storage: ${error.message}`);
    }
  }
);
