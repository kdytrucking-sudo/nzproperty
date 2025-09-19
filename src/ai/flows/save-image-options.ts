'use server';
/**
 * @fileOverview Saves image configurations to a JSON file in Firebase Storage.
 */

import { getAi } from '@/ai/genkit';
import { z } from 'zod';
import { ImageOptionsSchema, type ImageOptionsData } from '@/lib/image-options-schema';
import { writeJSON } from '@/lib/storage';

const ai = await getAi();

export async function saveImageOptions(input: ImageOptionsData): Promise<void> {
  return saveImageOptionsFlow(input);
}

const saveImageOptionsFlow = ai.defineFlow(
  {
    name: 'saveImageOptionsFlow',
    inputSchema: ImageOptionsSchema,
    outputSchema: z.void(),
  },
  async (options: ImageOptionsData) => {
    const storagePath = 'json/image-options.json';
    try {
      await writeJSON(storagePath, options);
    } catch (error: any) {
      console.error('Failed to save image options to Firebase Storage:', error);
      throw new Error(`Failed to write image-options.json file: ${error.message}`);
    }
  }
);
