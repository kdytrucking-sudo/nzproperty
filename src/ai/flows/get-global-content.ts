'use server';
/**
 * @fileOverview Retrieves the global content from a local JSON file.
 *
 * - getGlobalContent - A function that retrieves the content object from a file.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';
import { contentFormSchema, contentFields, type ContentFormData } from '@/lib/content-config';

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
    const jsonFilePath = path.join(process.cwd(), 'src', 'lib', 'global-content.json');
    try {
      const jsonString = await fs.readFile(jsonFilePath, 'utf-8');
      const data = JSON.parse(jsonString);
      // Ensure all fields from the schema are present, even if the file is old
      const defaultContent = createDefaultContent();
      const validatedData = { ...defaultContent, ...data };
      return contentFormSchema.parse(validatedData);
    } catch (error: any) {
      // If the file doesn't exist, create it with default values.
      if (error.code === 'ENOENT') {
        const defaultContent = createDefaultContent();
        await fs.writeFile(jsonFilePath, JSON.stringify(defaultContent, null, 2), 'utf-8');
        return defaultContent;
      }
      console.error('Failed to get global content:', error);
      throw new Error(`Failed to read or parse global-content.json: ${error.message}`);
    }
  }
);
