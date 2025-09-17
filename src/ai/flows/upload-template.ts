'use server';
/**
 * @fileOverview Uploads a .docx template to Firebase Storage.
 *
 * - uploadTemplate - A function that saves a template file to the cloud.
 */

import { getAi } from '@/ai/genkit';
import { z } from 'genkit';
import { uploadBinary } from '@/lib/storage';

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
      // Basic security check to prevent path traversal
      if (fileName.includes('/') || fileName.includes('..')) {
        throw new Error('Invalid file name.');
      }
      
      const storagePath = `templates/${fileName}`;
      const mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

      // Convert data URI to ArrayBuffer
      const base64Content = dataUri.split(',')[1];
      if (!base64Content) {
        throw new Error('Invalid data URI provided.');
      }
      const buffer = Buffer.from(base64Content, 'base64');
      
      // Upload to Firebase Storage
      await uploadBinary(storagePath, buffer, mimeType);

    } catch (error: any) {
      console.error(`Failed to upload template ${fileName} to Storage:`, error);
      throw new Error(`Failed to save template file to Firebase Storage: ${error.message}`);
    }
  }
);
