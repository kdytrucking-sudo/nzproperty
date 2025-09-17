'use server';
/**
 * @fileOverview Retrieves the global content from a JSON file in Firebase Storage.
 *
 * - getGlobalContent - A function that retrieves the content object from a file.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { contentFormSchema, contentFields, type ContentFormData } from '@/lib/content-config';
import { readJSON, writeJSON } from '@/lib/storage';

// Create a default object with empty strings for all fields
const createDefaultContent = (): ContentFormData => {
  const defaultContent: Partial<ContentFormData> = {};
  contentFields.forEach(field => {
    defaultContent[field.name] = '';
  });
  return defaultContent as ContentFormData;
};

export async function getGlobalContent(): Promise<ContentFormData> {
  return getGlobalContentFlow();
}

const getGlobalContentFlow = ai.defineFlow(
  {
    name: 'getGlobalContentFlow',
    inputSchema: z.void(),
    outputSchema: contentFormSchema,
  },
  async () => {
    const storagePath = 'json/global-content.json';
    try {
      const jsonData = await readJSON(storagePath);
      // Ensure all fields from the schema are present, even if the file is old
      const defaultContent = createDefaultContent();
      const validatedData = { ...defaultContent, ...jsonData };
      return contentFormSchema.parse(validatedData);
    } catch (error: any) {
      // If the file doesn't exist, create it with default values.
      if (error.message.includes('not found') || error.message.includes('No object exists')) {
        const defaultContent = createDefaultContent();
        await writeJSON(storagePath, defaultContent);
        return defaultContent;
      }
      console.error('Failed to get global content from Firebase Storage:', error);
      throw new Error(`Failed to read or parse global-content.json: ${error.message}`);
    }
  }
);
