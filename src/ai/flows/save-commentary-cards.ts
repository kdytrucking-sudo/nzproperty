
'use server';
/**
 * @fileOverview Saves commentary card configurations to a JSON file in Firebase Storage.
 */

import { getAi } from '@/ai/genkit';
import { z } from 'genkit';
import { CommentaryCardsSchema, type CommentaryCardsData } from '@/lib/commentary-card-schema';
import { writeJSON } from '@/lib/storage';

const ai = await getAi();

export async function saveCommentaryCards(input: CommentaryCardsData): Promise<void> {
  return saveCommentaryCardsFlow(input);
}

const saveCommentaryCardsFlow = ai.defineFlow(
  {
    name: 'saveCommentaryCardsFlow',
    inputSchema: CommentaryCardsSchema,
    outputSchema: z.void(),
  },
  async (cards) => {
    const storagePath = 'json/commentary-cards.json';
    try {
      await writeJSON(storagePath, cards);
    } catch (error: any)
    {
      console.error('Failed to save commentary cards to Firebase Storage:', error);
      throw new Error(`Failed to write commentary-cards.json file: ${error.message}`);
    }
  }
);
