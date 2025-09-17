'use server';
/**
 * @fileOverview Saves the provided global content to a JSON file in Firebase Storage.
 *
 * - saveGlobalContent - A function that saves the content object to a file.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { contentFormSchema, type ContentFormData } from '@/lib/content-config';
import { writeJSON } from '@/lib/storage';


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
    const storagePath = 'json/global-content.json';
    try {
      const contentJsonString = JSON.stringify(content, null, 2);
      await writeJSON(storagePath, JSON.parse(contentJsonString));
    } catch (error: any) {
      console.error('Failed to save global content to Firebase Storage:', error);
      throw new Error(`Failed to write content file: ${error.message}`);
    }
  }
);
