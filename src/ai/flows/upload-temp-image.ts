'use server';
/**
 * @fileOverview Uploads a single image file to a temporary directory on the server.
 */

import { getAi } from '@/ai/genkit';
import { z } from 'zod';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

const ai = await getAi();

const UploadTempImageInputSchema = z.object({
  fileDataUri: z.string().describe('The base64 encoded data URI of the image file.'),
  originalFileName: z.string().describe('The original name of the file for extension purposes.'),
});

export type UploadTempImageInput = z.infer<typeof UploadTempImageInputSchema>;

const UploadTempImageOutputSchema = z.object({
    tempFileName: z.string().describe('The unique temporary file name assigned on the server.'),
    fullPath: z.string().describe('The full absolute path where the file was saved on the server.')
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
      // Use a permanent directory within the project source.
      const permanentDir = path.join(process.cwd(), 'src', 'lib', 'images');
      await fs.mkdir(permanentDir, { recursive: true });

      const extension = path.extname(originalFileName) || '.tmp';
      const uniqueName = `${crypto.randomBytes(16).toString('hex')}${extension}`;
      
      const filePath = path.join(permanentDir, uniqueName);
      const base64Content = fileDataUri.split(',')[1];
      if (!base64Content) {
          throw new Error('Invalid data URI format.');
      }
      const buffer = Buffer.from(base64Content, 'base64');
      
      await fs.writeFile(filePath, buffer);

      // No longer need to clean up the file as it's meant to be permanent.

      return { tempFileName: uniqueName, fullPath: filePath };

    } catch (error: any) {
      console.error(`Failed to upload image:`, error);
      throw new Error(`Failed to save image file: ${error.message}`);
    }
  }
);
