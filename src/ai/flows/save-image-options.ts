'use server';
/**
 * @fileOverview Saves image configurations to a JSON file.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';
import { ImageOptionsSchema, type ImageOptionsData } from '@/lib/image-options-schema';

export async function saveImageOptions(input: ImageOptionsData): Promise<void> {
  return saveImageOptionsFlow(input);
}

const saveImageOptionsFlow = ai.defineFlow(
  {
    name: 'saveImageOptionsFlow',
    inputSchema: ImageOptionsSchema,
    outputSchema: z.void(),
  },
  async (options) => {
    try {
      const jsonFilePath = path.join(process.cwd(), 'src', 'lib', 'image-options.json');
      const contentJsonString = JSON.stringify(options, null, 2);
      await fs.writeFile(jsonFilePath, contentJsonString, 'utf-8');
    } catch (error: any) {
      console.error('Failed to save image options:', error);
      throw new Error(`Failed to write image-options.json file: ${error.message}`);
    }
  }
);
