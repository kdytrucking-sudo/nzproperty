'use server';
/**
 * @fileOverview Lists available .docx templates from Firebase Storage.
 *
 * - listTemplates - A function that returns an array of template file names.
 */

import { getAi } from '@/ai/genkit';
import { z } from 'genkit';
import { listFileNames } from '@/lib/storage';

const ai = await getAi();

const ListTemplatesOutputSchema = z.array(z.string()).describe('An array of template file names.');

export type ListTemplatesOutput = z.infer<typeof ListTemplatesOutputSchema>;

export async function listTemplates(): Promise<ListTemplatesOutput> {
  return listTemplatesFlow();
}

const listTemplatesFlow = ai.defineFlow(
  {
    name: 'listTemplatesFlow',
    inputSchema: z.void(),
    outputSchema: ListTemplatesOutputSchema,
  },
  async () => {
    try {
      // List files from the 'templates/' directory in Firebase Storage
      const docxFiles = await listFileNames('templates');
      return docxFiles.filter(file => file.endsWith('.docx'));
    } catch (error) {
      console.error('Failed to list templates from Firebase Storage:', error);
      // If there's an error (e.g., permissions), return an empty array
      return [];
    }
  }
);
