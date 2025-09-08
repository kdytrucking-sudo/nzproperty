'use server';
/**
 * @fileOverview Retrieves the current extraction configuration (JSON structure and prompts) from files.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';

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
      const jsonFilePath = path.join(process.cwd(), 'src', 'lib', 'json-structure.json');
      const promptsFilePath = path.join(process.cwd(), 'src', 'lib', 'prompts.json');

      const jsonStructure = await fs.readFile(jsonFilePath, 'utf-8');
      const promptsJsonString = await fs.readFile(promptsFilePath, 'utf-8');
      const prompts = JSON.parse(promptsJsonString);

      return {
        jsonStructure,
        systemPrompt: prompts.system_prompt,
        userPrompt: prompts.user_prompt,
        extractionHintsTitle: prompts.extraction_hints_title,
        extractionHints: prompts.extraction_hints,
      };
    } catch (error: any) {
      console.error('Failed to get extraction config:', error);
      throw new Error(`Failed to read config files: ${error.message}`);
    }
  }
);

    