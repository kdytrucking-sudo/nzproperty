
'use server';
/**
 * @fileOverview Retrieves commentary card configurations from a JSON file in Firebase Storage.
 */

import { getAi } from '@/ai/genkit';
import { z } from 'genkit';
import { CommentaryCardsSchema, type CommentaryCardsData } from '@/lib/commentary-card-schema';
import { readJSON, writeJSON } from '@/lib/storage';

const ai = await getAi();

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
        const storagePath = 'json/commentary-cards.json';
        try {
          const jsonString = await readJSON(storagePath);
          const data = CommentaryCardsSchema.parse(jsonString);
          return data;
        } catch (error: any) {
           // If the file doesn't exist, create it with a default empty array.
          if (error.message.includes('not found') || error.message.includes('No object exists')) {
            const defaultData: CommentaryCardsData = [];
            await writeJSON(storagePath, defaultData);
            return defaultData;
          }
          console.error('Failed to get commentary cards from Firebase Storage:', error);
          throw new Error(`Failed to read or parse commentary-cards.json file: ${error.message}`);
        }
    }
);
