
'use server';
/**
 * @fileOverview Lists all available history records from Firebase Storage.
 */

import { getAi } from '@/ai/genkit';
import { z } from 'genkit';
import { HistoryFileSchema } from '@/lib/history-schema';
import { readJSON, writeJSON } from '@/lib/storage'; // Firebase Storage 封装

const ai = await getAi();

export async function listHistory(): Promise<z.infer<typeof HistoryFileSchema>> {
  return listHistoryFlow();
}

const listHistoryFlow = ai.defineFlow(
  {
    name: 'listHistoryFlow',
    inputSchema: z.void(),
    outputSchema: HistoryFileSchema,
  },
  async () => {
    const storagePath = 'json/history.json';
    try {
      const jsonData = await readJSON(storagePath);
      const history = HistoryFileSchema.parse(jsonData);
      
      // Sort records by last updated date, descending
      history.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      return history;
    } catch (error: any) {
      if (error.message.includes('not found') || error.message.includes('No object exists')) {
        // If the file doesn't exist, create it with an empty array.
        await writeJSON(storagePath, []);
        return [];
      }
      console.error('Failed to list history:', error);
      throw new Error(`Failed to read or parse history.json from Firebase Storage: ${error.message}`);
    }
  }
);
