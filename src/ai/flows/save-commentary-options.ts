'use server';
/**
 * @fileOverview Saves commentary options to a JSON file.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';
import { CommentaryOptionsSchema, type CommentaryOptionsData } from '@/lib/commentary-schema';


export async function saveCommentaryOptions(input: CommentaryOptionsData): Promise<void> {
  return saveCommentaryOptionsFlow(input);
}

const saveCommentaryOptionsFlow = ai.defineFlow(
  {
    name: 'saveCommentaryOptionsFlow',
    inputSchema: CommentaryOptionsSchema,
    outputSchema: z.void(),
  },
  async (options) => {
    try {
      const jsonFilePath = path.join(process.cwd(), 'src', 'lib', 'commentary-options.json');
      const contentJsonString = JSON.stringify(options, null, 2);
      await fs.writeFile(jsonFilePath, contentJsonString, 'utf-8');
    } catch (error: any) {
      console.error('Failed to save commentary options:', error);
      throw new Error(`Failed to write commentary options file: ${error.message}`);
    }
  }
);
