'use server';
/**
 * @fileOverview Uploads a single image file to a temporary directory on the server.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const UploadTempImageInputSchema = z.object({
  fileDataUri: z.string().describe('The base64 encoded data URI of the image file.'),
  originalFileName: z.string().describe('The original name of the file for extension purposes.'),
});

export type UploadTempImageInput = z.infer<typeof UploadTempImageInputSchema>;

const UploadTempImageOutputSchema = z.object({
    tempFileName: z.string().describe('The unique temporary file name assigned on the server.')
});
export type UploadTempImageOutput = z.infer<typeof UploadTempImageOutputSchema>;


export async function uploadTempImage(input: UploadTempImageInput): Promise<UploadTempImageOutput> {
  return uploadTempImageFlow(input);
}

const uploadTempImageFlow = ai.defineFlow(
  {
    name: 'uploadTempImageFlow',
    inputSchema: UploadTempImageInputSchema,
    outputSchema: UploadTempImageOutputSchema,
  },
  async ({ fileDataUri, originalFileName }) => {
    try {
      const tmpDir = path.join(process.cwd(), 'tmp');
      await fs.mkdir(tmpDir, { recursive: true });

      const extension = path.extname(originalFileName) || '.tmp';
      const uniqueName = `${crypto.randomBytes(16).toString('hex')}${extension}`;
      
      const filePath = path.join(tmpDir, uniqueName);
      const base64Content = fileDataUri.split(',')[1];
      if (!base64Content) {
          throw new Error('Invalid data URI format.');
      }
      const buffer = Buffer.from(base64Content, 'base64');
      
      await fs.writeFile(filePath, buffer);

      // Clean up the file after a timeout (e.g., 1 hour)
      setTimeout(async () => {
          try {
              await fs.unlink(filePath);
          } catch (cleanupError) {
              // Ignore errors if file is already deleted
          }
      }, 3600 * 1000);

      return { tempFileName: uniqueName };

    } catch (error: any) {
      console.error(`Failed to upload temporary image:`, error);
      throw new Error(`Failed to save temporary file: ${error.message}`);
    }
  }
);
