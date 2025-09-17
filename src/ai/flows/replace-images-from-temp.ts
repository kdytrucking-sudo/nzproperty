
'use server';
/**
 * Reads a .docx template, replaces placeholders with images from the permanent directory,
 * and returns the final file.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import path from 'path';
import { promises as fs } from 'fs';


/* eslint-disable @typescript-eslint/no-var-requires */
const ImageModule = require('docxtemplater-image-module-free');


function resolveImagePath(filename: string) {
  const safeName = path.basename(filename);
  return path.join(process.cwd(), 'src', 'lib', 'images', safeName);
}

async function assertExists(absPath: string) {
  try {
    await fs.access(absPath);
  } catch {
    throw new Error(`Image not found: ${path.basename(absPath)}`);
  }
}

/* ----------------------------- Schemas ----------------------------- */
const ImageInfoSchema = z.object({
  placeholder: z.string().describe('Text tag in template, e.g. {%report_logo}'),
  tempFileName: z.string().describe('The unique file name on the server.'),
  width: z.number().describe('Width in pixels.'),
  height: z.number().describe('Height in pixels.'),
});

const ReplaceImagesInputSchema = z.object({
  templateDataUri: z.string().describe('The .docx template as a data URI.'),
  images: z.array(ImageInfoSchema).describe('An array of image information to replace.'),
});
export type ReplaceImagesFromTempInput = z.infer<typeof ReplaceImagesInputSchema>;

const ReplaceImagesOutputSchema = z.object({
  generatedDocxDataUri: z.string().describe('The final .docx file with images as a data URI.'),
  imagesReplacedCount: z.number().describe('The number of images replaced.'),
});
export type ReplaceImagesFromTempOutput = z.infer<typeof ReplaceImagesOutputSchema>;

export async function replaceImagesFromTemp(
  input: ReplaceImagesFromTempInput
): Promise<ReplaceImagesFromTempOutput> {
  return replaceImagesFromTempFlow(input);
}


/* ------------------------------ Flow ------------------------------ */
const replaceImagesFromTempFlow = ai.defineFlow(
  {
    name: 'replaceImagesFromTempFlow',
    inputSchema: ReplaceImagesInputSchema,
    outputSchema: ReplaceImagesOutputSchema,
  },
  async ({ templateDataUri, images }) => {
    try {
      const templateBuffer = Buffer.from(templateDataUri.split(',')[1], 'base64');
      const zip = new PizZip(templateBuffer);
      
      const imageSizes = new Map<string, { width: number; height: number }>();
      const templateData: { [key: string]: Buffer } = {}; 

      // Prepare data by reading all images into buffers from the permanent store
      await Promise.all(images.map(async (img) => {
        const key = img.placeholder.trim().replace(/^\{\%/, '').replace(/\}$/, '');
        
        const imagePath = resolveImagePath(img.tempFileName);
        await assertExists(imagePath);

        const imageBuffer = await fs.readFile(imagePath);
        
        templateData[key] = imageBuffer;
        imageSizes.set(key, { width: img.width, height: img.height });
      }));

      const imageModule = new ImageModule({
        fileType: 'docx',
        centered: false,
        getImage: (tagValue: unknown, tagName: string) => {
          const imageBuffer = templateData[tagName];
          if (imageBuffer) {
              return imageBuffer;
          }
          throw new Error(`Image data could not be found for tag: ${tagName}`);
        },
        getSize: (_img: Buffer, _tagValue: unknown, tagName: string) => {
          const size = imageSizes.get(tagName);
          return size ? [size.width, size.height] : [300, 200]; // Fallback size
        },
      });

      const doc = new Docxtemplater(zip, {
        modules: [imageModule],
        delimiters: { start: '{%', end: '}' },
        paragraphLoop: true,
        linebreaks: true,
      });
      
      const renderData: { [key: string]: any } = {};
      Object.keys(templateData).forEach(key => {
        renderData[key] = true;
      });

      doc.setData(renderData);
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
    }
  }
);
