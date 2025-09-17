
'use server';
/**
 * @fileOverview Saves multi-option configurations to a JSON file in Firebase Storage.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { MultiOptionsSchema, type MultiOptionsData } from '@/lib/multi-options-schema';
import { writeJSON } from '@/lib/storage';

export async function saveMultiOptions(input: MultiOptionsData): Promise<void> {
  return saveMultiOptionsFlow(input);
}

const saveMultiOptionsFlow = ai.defineFlow(
  {
    name: 'saveMultiOptionsFlow',
    inputSchema: MultiOptionsSchema,
    outputSchema: z.void(),
  },
  async (options) => {
    const storagePath = 'json/multi-options.json';
    try {
      await writeJSON(storagePath, options);
    } catch (error: any) {
      console.error('Failed to save multi-options to Firebase Storage:', error);
      throw new Error(`Failed to write multi-options file: ${error.message}`);
    }
  }
);
