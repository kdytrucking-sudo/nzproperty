'use server';
/**
 * @fileOverview Lists available .docx templates from the server directory.
 *
 * - listTemplates - A function that returns an array of template file names.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';

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
    const templatesDir = path.join(process.cwd(), 'src', 'lib', 'templates');
    try {
      // Ensure the directory exists
      await fs.mkdir(templatesDir, { recursive: true });
      const files = await fs.readdir(templatesDir);
      // Filter for .docx files only
      const docxFiles = files.filter(file => file.endsWith('.docx'));
      return docxFiles;
    } catch (error) {
      console.error('Failed to list templates:', error);
      // If there's an error (e.g., directory not accessible), return an empty array
      return [];
    }
  }
);
