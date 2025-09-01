'use server';
/**
 * @fileOverview Saves the provided JSON structure to a file.
 *
 * - saveJsonStructure - A function that saves a JSON string to a file.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';

const SaveJsonInputSchema = z.object({
  jsonStructure: z.string().describe('The JSON structure to save as a string.'),
});
export type SaveJsonInput = z.infer<typeof SaveJsonInputSchema>;

export async function saveJsonStructure(input: SaveJsonInput): Promise<void> {
  return saveJsonStructureFlow(input);
}

const saveJsonStructureFlow = ai.defineFlow(
  {
    name: 'saveJsonStructureFlow',
    inputSchema: SaveJsonInputSchema,
    outputSchema: z.void(),
  },
  async ({ jsonStructure }) => {
    try {
      // Validate that the string is valid JSON before saving.
      JSON.parse(jsonStructure);

      const filePath = path.join(process.cwd(), 'src', 'lib', 'json-structure.json');
      await fs.writeFile(filePath, jsonStructure, 'utf-8');
    } catch (error: any) {
      console.error('Failed to save JSON structure:', error);
      // Throw an error that can be caught by the client.
      throw new Error(`Invalid JSON format or failed to write file: ${error.message}`);
    }
  }
);
