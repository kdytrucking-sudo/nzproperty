'use server';
/**
 * @fileOverview Lists all available history records from the history.json file.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';
import { HistoryFileSchema, type HistoryRecord } from '@/lib/history-schema';

export async function listHistory(): Promise<HistoryRecord[]> {
  return listHistoryFlow();
}

const listHistoryFlow = ai.defineFlow(
  {
    name: 'listHistoryFlow',
    inputSchema: z.void(),
    outputSchema: z.array(HistoryRecordSchema),
  },
  async () => {
    const filePath = path.join(process.cwd(), 'src', 'lib', 'history.json');
    try {
      const jsonString = await fs.readFile(filePath, 'utf-8');
      const history = HistoryFileSchema.parse(JSON.parse(jsonString));
      
      // Sort records by last updated date, descending
      history.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

      return history;
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // If the file doesn't exist, create it with an empty array.
        await fs.writeFile(filePath, '[]', 'utf-8');
        return [];
      }
      console.error('Failed to list history:', error);
      throw new Error(`Failed to read or parse history.json: ${error.message}`);
    }
  }
);
