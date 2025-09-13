
'use server';
/**
 * Reads a .docx template, replaces placeholders with images from the temporary directory,
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


function resolveTempPath(filename: string) {
  // Use the standard /tmp directory, which is reliable in App Hosting environments.
  const safeName = path.basename(filename);
  return path.join('/tmp', safeName);
}

async function assertExists(absPath: string) {
  try {
    await fs.access(absPath);
  } catch {
    throw new Error(`Temp image not found: ${path.basename(absPath)}`);
  }
}

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
    try {
      const templateBuffer = Buffer.from(templateDataUri.split(',')[1], 'base64');
      const zip = new PizZip(templateBuffer);
      
      const imageSizes = new Map<string, { width: number; height: number }>();
      const templateData: { [key: string]: Buffer } = {}; 

      // Prepare data by reading all temp images into buffers
      await Promise.all(images.map(async (img) => {
        const key = img.placeholder.trim().replace(/^\{\%/, '').replace(/\}$/, '');
        
        const tempFilePath = resolveTempPath(img.tempFileName);
        await assertExists(tempFilePath);

        const imageBuffer = await fs.readFile(tempFilePath);
        
        templateData[key] = imageBuffer;
        imageSizes.set(key, { width: img.width, height: img.height });
      }));

      const imageModule = new ImageModule({
        fileType: 'docx',
        centered: false,
        getImage: (tagValue: unknown, tagName: string) => {
          // The `tagName` provided by the module is the clean key (without delimiters).
          // We use it to look up the buffer from our prepared data.
          const imageBuffer = templateData[tagName];
          if (imageBuffer) {
              return imageBuffer;
          }
          // This fallback helps in debugging but shouldn't be hit if logic is correct.
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
      
      // Docxtemplater-Image-Module works by detecting the placeholders in the template
      // and calling `getImage` and `getSize`. We just need to setData with an object
      // whose keys match the placeholders (without delimiters) so the module can trigger.
      // The values themselves don't matter as much as the keys existing.
      const renderData: { [key: string]: any } = {};
      Object.keys(templateData).forEach(key => {
        renderData[key] = true; // Set a truthy value to trigger the module hooks
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
