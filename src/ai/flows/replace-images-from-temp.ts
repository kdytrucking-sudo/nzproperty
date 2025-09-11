'use server';
/**
 * Reads a .docx template, replaces placeholders with images from the temporary directory,
 * and returns the final file.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import fs from 'fs/promises';
import path from 'path';

/* eslint-disable @typescript-eslint/no-var-requires */
const ImageModule = require('docxtemplater-image-module-free');

/* ----------------------------- Schemas ----------------------------- */
const TempImageInfoSchema = z.object({
  placeholder: z.string().describe('Text tag in template, e.g. {%report_logo}'),
  tempFileName: z.string().describe('The temporary file name on the server.'),
  width: z.number().describe('Width in pixels.'),
  height: z.number().describe('Height in pixels.'),
});

const ReplaceImagesFromTempInputSchema = z.object({
  templateDataUri: z.string().describe('The .docx template as a data URI.'),
  images: z.array(TempImageInfoSchema).describe('An array of image information to replace.'),
});
export type ReplaceImagesFromTempInput = z.infer<typeof ReplaceImagesFromTempInputSchema>;

const ReplaceImagesFromTempOutputSchema = z.object({
  generatedDocxDataUri: z.string().describe('The final .docx file with images as a data URI.'),
  imagesReplacedCount: z.number().describe('The number of images replaced.'),
});
export type ReplaceImagesFromTempOutput = z.infer<typeof ReplaceImagesFromTempOutputSchema>;

export async function replaceImagesFromTemp(
  input: ReplaceImagesFromTempInput
): Promise<ReplaceImagesFromTempOutput> {
  return replaceImagesFromTempFlow(input);
}

/* ------------------------------ Flow ------------------------------ */
const replaceImagesFromTempFlow = ai.defineFlow(
  {
    name: 'replaceImagesFromTempFlow',
    inputSchema: ReplaceImagesFromTempInputSchema,
    outputSchema: ReplaceImagesFromTempOutputSchema,
  },
  async ({ templateDataUri, images }) => {
    const tmpDir = path.join(process.cwd(), 'tmp');
    const tempFilePaths: string[] = [];

    try {
      const templateBuffer = Buffer.from(templateDataUri.split(',')[1], 'base64');
      const zip = new PizZip(templateBuffer);
      
      const imageSizes = new Map<string, { width: number; height: number }>();
      const templateData: { [key: string]: Buffer } = {};

      // Prepare data and gather file paths for cleanup
      await Promise.all(images.map(async (img) => {
        const key = img.placeholder.trim().replace(/^\{\%/, '').replace(/\}$/, '');
        const tempFilePath = path.join(tmpDir, img.tempFileName);
        tempFilePaths.push(tempFilePath);

        const imageBuffer = await fs.readFile(tempFilePath);
        templateData[key] = imageBuffer;
        imageSizes.set(key, { width: img.width, height: img.height });
      }));

      const imageModule = new ImageModule({
        fileType: 'docx',
        centered: false,
        getImage: (tagValue: unknown) => {
           if (Buffer.isBuffer(tagValue)) {
            return tagValue;
          }
          // This should not happen if templateData is prepared correctly
          throw new Error('Image data not found or not a buffer.');
        },
        getSize: (_img: Buffer, _tagValue: unknown, tagName: string) => {
          const size = imageSizes.get(tagName);
          return size ? [size.width, size.height] : [300, 200];
        },
      });

      const doc = new Docxtemplater(zip, {
        modules: [imageModule],
        paragraphLoop: true,
        linebreaks: true,
      });

      doc.setData(templateData);
      doc.render();

      const out = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
      const base64 = out.toString('base64');

      return {
        generatedDocxDataUri: `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${base64}`,
        imagesReplacedCount: images.length,
      };
    } catch (err: any) {
      if (err?.properties?.errors?.length) {
        const first = err.properties.errors[0];
        throw new Error(first?.properties?.explanation || first?.id || 'Template render error during image replacement.');
      }
      throw new Error(err?.message || 'Failed to process the document for image replacement.');
    } finally {
        // Clean up the temporary image files
        for (const filePath of tempFilePaths) {
            try {
                await fs.unlink(filePath);
            } catch (cleanupError) {
                // Log but don't throw, as the main operation might have succeeded
                console.error(`Failed to clean up temporary file ${filePath}:`, cleanupError);
            }
        }
    }
  }
);
