'use server';
/**
 * @fileOverview Saves the provided JSON structure and prompts to their respective files.
 *
 * - saveExtractionConfig - A function that saves the config strings to files.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';

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
      JSON.parse(jsonStructure);

      const jsonFilePath = path.join(process.cwd(), 'src', 'lib', 'json-structure.json');
      await fs.writeFile(jsonFilePath, jsonStructure, 'utf-8');

      const promptsFilePath = path.join(process.cwd(), 'src', 'lib', 'prompts.json');
      const promptData = {
        system_prompt: systemPrompt,
        user_prompt: userPrompt,
        extraction_hints_title: extractionHintsTitle,
        extraction_hints: extractionHints,
      };
      await fs.writeFile(promptsFilePath, JSON.stringify(promptData, null, 2), 'utf-8');

    } catch (error: any) {
      console.error('Failed to save configuration:', error);
      // Throw an error that can be caught by the client.
      throw new Error(`Invalid format or failed to write file: ${error.message}`);
    }
  }
);
