'use server';
/**
 * @fileOverview Saves the construction and chattels briefs to a JSON file.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';

const SaveConstructionBriefInputSchema = z.object({
  brief: z.string().optional(),
  chattelsBrief: z.string().optional(),
});

export type SaveConstructionBriefInput = z.infer<typeof SaveConstructionBriefInputSchema>;

export async function saveConstructionBrief(input: SaveConstructionBriefInput): Promise<void> {
  return saveConstructionBriefFlow(input);
}

const saveConstructionBriefFlow = ai.defineFlow(
  {
    name: 'saveConstructionBriefFlow',
    inputSchema: SaveConstructionBriefInputSchema,
    outputSchema: z.void(),
  },
  async (content) => {
    try {
      const jsonFilePath = path.join(process.cwd(), 'src', 'lib', 'construction-brief.json');
      const contentJsonString = JSON.stringify(content, null, 2);
      await fs.writeFile(jsonFilePath, contentJsonString, 'utf-8');
    } catch (error: any) {
      console.error('Failed to save construction brief:', error);
      throw new Error(`Failed to write construction brief file: ${error.message}`);
    }
  }
);
