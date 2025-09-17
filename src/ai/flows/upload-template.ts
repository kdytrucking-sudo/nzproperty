'use server';
/**
 * @fileOverview Uploads a .docx template to the server.
 *
 * - uploadTemplate - A function that saves a template file to the server.
 */

import { getAi } from '@/ai/genkit';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';

const ai = await getAi();

const UploadTemplateInputSchema = z.object({
  fileName: z.string().describe('The desired file name for the template.'),
  dataUri: z.string().describe('The base64 encoded data URI of the .docx file.'),
});

export type UploadTemplateInput = z.infer<typeof UploadTemplateInputSchema>;

export async function uploadTemplate(input: UploadTemplateInput): Promise<void> {
  return uploadTemplateFlow(input);
}

const uploadTemplateFlow = ai.defineFlow(
  {
    name: 'uploadTemplateFlow',
    inputSchema: UploadTemplateInputSchema,
    outputSchema: z.void(),
  },
  async ({ fileName, dataUri }) => {
    try {
      const templatesDir = path.join(process.cwd(), 'src', 'lib', 'templates');
      await fs.mkdir(templatesDir, { recursive: true });

      // Basic security check to prevent path traversal
      if (fileName.includes('..') || fileName.includes('/')) {
        throw new Error('Invalid file name.');
      }
      
      const filePath = path.join(templatesDir, fileName);
      const base64Content = dataUri.split(',')[1];
      const buffer = Buffer.from(base64Content, 'base64');
      
      await fs.writeFile(filePath, buffer);

    } catch (error: any) {
      console.error(`Failed to upload template ${fileName}:`, error);
      throw new Error(`Failed to save template file: ${error.message}`);
    }
  }
);
