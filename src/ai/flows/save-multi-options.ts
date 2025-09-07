
'use server';
/**
 * @fileOverview Saves multi-option configurations to a JSON file.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';
import { MultiOptionsSchema, type MultiOptionsData } from '@/lib/multi-options-schema';

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
    try {
      const jsonFilePath = path.join(process.cwd(), 'src', 'lib', 'multi-options.json');
      const contentJsonString = JSON.stringify(options, null, 2);
      await fs.writeFile(jsonFilePath, contentJsonString, 'utf-8');
    } catch (error: any)
    {
      console.error('Failed to save multi-options:', error);
      throw new Error(`Failed to write multi-options file: ${error.message}`);
    }
  }
);
