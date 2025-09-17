'use server';
/**
 * @fileOverview Saves the provided JSON structure and prompts to their respective files in Firebase Storage.
 *
 * - saveExtractionConfig - A function that saves the config strings to files.
 */

import { getAi } from '@/ai/genkit';
import { z } from 'genkit';
import { writeJSON } from '@/lib/storage';

const ai = await getAi();

const SaveConfigInputSchema = z.object({
  jsonStructure: z.string().describe('The JSON structure to save as a string.'),
  systemPrompt: z.string().describe('The system prompt for the AI.'),
  userPrompt: z.string().describe('The user prompt for the AI.'),
  extractionHintsTitle: z.string().describe('The title for the extraction hints section.'),
  extractionHints: z.string().describe('The extraction hints for the AI.'),
});

export type SaveConfigInput = z.infer<typeof SaveConfigInputSchema>;

export async function saveExtractionConfig(input: SaveConfigInput): Promise<void> {
  return saveExtractionConfigFlow(input);
}

const saveExtractionConfigFlow = ai.defineFlow(
  {
    name: 'saveExtractionConfigFlow',
    inputSchema: SaveConfigInputSchema,
    outputSchema: z.void(),
  },
  async ({ jsonStructure, systemPrompt, userPrompt, extractionHintsTitle, extractionHints }) => {
    try {
      // Validate that the JSON structure string is valid JSON before saving.
      const jsonStructureObject = JSON.parse(jsonStructure);

      const promptData = {
        system_prompt: systemPrompt,
        user_prompt: userPrompt,
        extraction_hints_title: extractionHintsTitle,
        extraction_hints: extractionHints,
      };

      // Write both files to Firebase Storage in parallel
      await Promise.all([
        writeJSON('json/json-structure.json', jsonStructureObject),
        writeJSON('json/prompts.json', promptData),
      ]);

    } catch (error: any) {
      console.error('Failed to save configuration to Storage:', error);
      // Throw an error that can be caught by the client.
      throw new Error(`Invalid format or failed to write files to Firebase Storage: ${error.message}`);
    }
  }
);
