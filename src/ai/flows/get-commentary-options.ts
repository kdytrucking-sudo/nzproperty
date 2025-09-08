'use server';
/**
 * @fileOverview Retrieves commentary options from a JSON file.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';
import { CommentaryOptionsSchema, type CommentaryOptionsData } from '@/lib/commentary-schema';

export async function getCommentaryOptions(): Promise<CommentaryOptionsData> {
  return getCommentaryOptionsFlow();
}

const getCommentaryOptionsFlow = ai.defineFlow(
  {
    name: 'getCommentaryOptionsFlow',
    inputSchema: z.void(),
    outputSchema: CommentaryOptionsSchema,
  },
  async () => {
    try {
      const jsonFilePath = path.join(process.cwd(), 'src', 'lib', 'commentary-options.json');
      const jsonString = await fs.readFile(jsonFilePath, 'utf-8');
      const data = JSON.parse(jsonString);
      return CommentaryOptionsSchema.parse(data);
    } catch (error: any) {
       // If the file doesn't exist, create it with a default structure
      if (error.code === 'ENOENT') {
        const defaultOptions: CommentaryOptionsData = {
            PreviousSale: [],
            ContractSale: [],
            SuppliedDocumentation: [],
            RecentOrProvided: [],
            LIM: [],
            PC78: [],
            OperativeZone: [],
        };
        const jsonFilePath = path.join(process.cwd(), 'src', 'lib', 'commentary-options.json');
        await fs.writeFile(jsonFilePath, JSON.stringify(defaultOptions, null, 2), 'utf-8');
        return defaultOptions;
      }
      console.error('Failed to get commentary options:', error);
      throw new Error(`Failed to read or parse commentary options file: ${error.message}`);
    }
  }
);
