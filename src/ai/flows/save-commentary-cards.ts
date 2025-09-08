
'use server';
/**
 * @fileOverview Saves commentary card configurations to a JSON file.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';
import { CommentaryCardsSchema, type CommentaryCardsData } from '@/lib/commentary-card-schema';

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
    try {
      const jsonFilePath = path.join(process.cwd(), 'src', 'lib', 'commentary-cards.json');
      const contentJsonString = JSON.stringify(cards, null, 2);
      await fs.writeFile(jsonFilePath, contentJsonString, 'utf-8');
    } catch (error: any)
    {
      console.error('Failed to save commentary cards:', error);
      throw new Error(`Failed to write commentary-cards.json file: ${error.message}`);
    }
  }
);

    
