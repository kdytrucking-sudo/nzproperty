
'use server';
/**
 * @fileOverview Retrieves multi-option configurations from a JSON file in Firebase Storage.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { MultiOptionsSchema, type MultiOptionsData } from '@/lib/multi-options-schema';
import { readJSON, writeJSON } from '@/lib/storage';

export async function getMultiOptions(): Promise<MultiOptionsData> {
  return getMultiOptionsFlow();
}

const getMultiOptionsFlow = ai.defineFlow(
  {
    name: 'getMultiOptionsFlow',
    inputSchema: z.void(),
    outputSchema: MultiOptionsSchema,
  },
  async () => {
    const storagePath = 'json/multi-options.json';
    try {
      const jsonData = await readJSON(storagePath);
      return MultiOptionsSchema.parse(jsonData);
    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('No object exists')) {
        const defaultOptions: MultiOptionsData = [];
        await writeJSON(storagePath, defaultOptions);
        return defaultOptions;
      }
      console.error('Failed to get multi-options from Firebase Storage:', error);
      throw new Error(`Failed to read or parse multi-options file: ${error.message}`);
    }
  }
);
