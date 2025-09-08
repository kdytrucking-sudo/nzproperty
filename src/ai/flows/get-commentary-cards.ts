
'use server';
/**
 * @fileOverview Retrieves commentary card configurations from a JSON file.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';
import { CommentaryCardsSchema, type CommentaryCardsData } from '@/lib/commentary-card-schema';

export async function getCommentaryCards(): Promise<CommentaryCardsData> {
  return getCommentaryCardsFlow();
}

const getCommentaryCardsFlow = ai.defineFlow(
    {
        name: 'getCommentaryCardsFlow',
        inputSchema: z.void(),
        outputSchema: CommentaryCardsSchema,
    },
    async () => {
        const jsonFilePath = path.join(process.cwd(), 'src', 'lib', 'commentary-cards.json');
        try {
          const jsonString = await fs.readFile(jsonFilePath, 'utf-8');
          const data = JSON.parse(jsonString);
          return CommentaryCardsSchema.parse(data);
        } catch (error: any) {
           // If the file doesn't exist, create it with a default empty array.
          if (error.code === 'ENOENT') {
            const defaultData: CommentaryCardsData = [];
            await fs.writeFile(jsonFilePath, JSON.stringify(defaultData, null, 2), 'utf-8');
            return defaultData;
          }
          console.error('Failed to get commentary cards:', error);
          throw new Error(`Failed to read or parse commentary-cards.json file: ${error.message}`);
        }
    }
);
