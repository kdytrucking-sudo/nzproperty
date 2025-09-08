'use server';
/**
 * Reads a temporary .docx file, adds images to it, and returns the final file as a data URI.
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
const ImageInfoSchema = z.object({
  placeholder: z.string().describe('Text tag in template, e.g. {%report_logo}'),
  imageDataUri: z.string().describe('Image as data URI, e.g. data:image/png;base64,...'),
  width: z.number().describe('Width in pixels.'),
  height: z.number().describe('Height in pixels.'),
});

const AddImagesInputSchema = z.object({
  tempFileName: z.string().describe('Name of the temporary .docx file in the /tmp directory.'),
  images: z.array(ImageInfoSchema).describe('An array of image information to replace.'),
});
export type AddImagesInput = z.infer<typeof AddImagesInputSchema>;

const AddImagesOutputSchema = z.object({
  generatedDocxDataUri: z.string().describe('The final .docx file with images as a data URI.'),
  imagesReplacedCount: z.number().describe('The number of images replaced.'),
});
export type AddImagesOutput = z.infer<typeof AddImagesOutputSchema>;

export async function addImagesToReport(
  input: AddImagesInput
): Promise<AddImagesOutput> {
  return addImagesToReportFlow(input);
}

/* ------------------------------ Flow ------------------------------ */
const addImagesToReportFlow = ai.defineFlow(
  {
    name: 'addImagesToReportFlow',
    inputSchema: AddImagesInputSchema,
    outputSchema: AddImagesOutputSchema,
  },
  async ({ tempFileName, images }) => {
    const tmpDir = path.join(process.cwd(), 'tmp');
    const tempFilePath = path.join(tmpDir, tempFileName);

    try {
      const templateBuffer = await fs.readFile(tempFilePath);
      
      // If no images are provided, just return the original file as data URI
      if (!images || images.length === 0) {
        await fs.unlink(tempFilePath); // Clean up the temp file
        return {
          generatedDocxDataUri: `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${templateBuffer.toString('base64')}`,
          imagesReplacedCount: 0,
        };
      }

      const zip = new PizZip(templateBuffer);
      
      const imageSizes = new Map<string, { width: number; height: number }>();
      images.forEach(img => {
          const key = img.placeholder.trim().replace(/^\{\%/, '').replace(/\}$/, '');
          imageSizes.set(key, { width: img.width, height: img.height });
      });

      const imageModule = new ImageModule({
        fileType: 'docx',
        centered: false,
        getImage: (tagValue: unknown) => {
          if (typeof tagValue === 'string' && tagValue.startsWith('data:')) {
            return Buffer.from(tagValue.split(',')[1] ?? '', 'base64');
          }
          return Buffer.from([]); // Should not happen with current logic
        },
        getSize: (_img: Buffer, _tagValue: unknown, tagName: string) => {
          const size = imageSizes.get(tagName);
          return size ? [size.width, size.height] : [300, 200];
        },
      });

      const doc = new Docxtemplater(zip, {
        modules: [imageModule],
        delimiters: { start: '{%', end: '}' }, // Use {% and } as delimiters for images
        paragraphLoop: true,
        linebreaks: true,
      });

      const templateData: { [key: string]: string } = {};
      images.forEach(img => {
        const key = img.placeholder.trim().replace(/^\{\%/, '').replace(/\}$/, '');
        templateData[key] = img.imageDataUri;
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
        // Clean up the temporary file
        try {
            await fs.unlink(tempFilePath);
        } catch (cleanupError) {
            console.error(`Failed to clean up temporary file ${tempFileName}:`, cleanupError);
        }
    }
  }
);
