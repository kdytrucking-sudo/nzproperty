'use server';
/**
 * @fileOverview Saves the provided global content to a JSON file.
 *
 * - saveGlobalContent - A function that saves the content object to a file.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';
import { contentFormSchema, type ContentFormData } from '@/lib/content-config';


export async function saveGlobalContent(input: ContentFormData): Promise<void> {
  return saveGlobalContentFlow(input);
}

const saveGlobalContentFlow = ai.defineFlow(
  {
    name: 'saveGlobalContentFlow',
    inputSchema: contentFormSchema,
    outputSchema: z.void(),
  },
  async (content) => {
    try {
      const jsonFilePath = path.join(process.cwd(), 'src', 'lib', 'global-content.json');
      const contentJsonString = JSON.stringify(content, null, 2);
      await fs.writeFile(jsonFilePath, contentJsonString, 'utf-8');
    } catch (error: any) {
      console.error('Failed to save global content:', error);
      throw new Error(`Failed to write content file: ${error.message}`);
    }
  }
);
