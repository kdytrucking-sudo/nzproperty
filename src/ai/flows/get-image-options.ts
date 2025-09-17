
'use server';
/**
 * @fileOverview Retrieves image configurations from a JSON file in Firebase Storage.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { ImageOptionsSchema, type ImageOptionsData } from '@/lib/image-options-schema';
import { readJSON, writeJSON } from '@/lib/storage';

export async function getImageOptions(): Promise<ImageOptionsData> {
  return getImageOptionsFlow();
}

const getImageOptionsFlow = ai.defineFlow(
  {
    name: 'getImageOptionsFlow',
    inputSchema: z.void(),
    outputSchema: ImageOptionsSchema,
  },
  async () => {
    const storagePath = 'json/image-options.json';
    try {
      const jsonData = await readJSON(storagePath);
      return ImageOptionsSchema.parse(jsonData);
    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('No object exists')) {
        const defaultOptions: ImageOptionsData = [];
        await writeJSON(storagePath, defaultOptions);
        return defaultOptions;
      }
      console.error('Failed to get image options from Firebase Storage:', error);
      throw new Error(`Failed to read or parse image-options.json file: ${error.message}`);
    }
  }
);
