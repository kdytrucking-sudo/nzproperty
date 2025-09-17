'use server';
/**
 * @fileOverview A dedicated flow to perform image replacement on a .docx file from storage.
 */

import { getAi } from '@/ai/genkit';
import { z } from 'zod';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { downloadBinary } from '@/lib/storage';

const ai = await getAi();

/* eslint-disable @typescript-eslint/no-var-requires */
const ImageModule = require('docxtemplater-image-module-free');

/* ----------------------------- Schemas ----------------------------- */

const ImageInfoSchema = z.object({
  placeholder: z.string().describe('The placeholder tag in the document, e.g., {%Image_NatureofProperty1}'),
  imageFileName: z.string().describe('The unique file name of the image in the /images directory.'),
  width: z.number().describe('Width in pixels.'),
  height: z.number().describe('Height in pixels.'),
});

const PerformImageReplacementInputSchema = z.object({
  reportFileName: z.string().describe('The name of the .docx file in the /reports directory.'),
  images: z.array(ImageInfoSchema).describe('An array of image information for replacement.'),
});

const PerformImageReplacementOutputSchema = z.object({
  generatedDocxDataUri: z.string().describe('The final .docx file with images as a data URI.'),
  logs: z.array(z.string()).describe('A log of actions performed during the replacement.'),
  imagesReplacedCount: z.number().describe('Count of images successfully replaced.'),
});

export type PerformImageReplacementInput = z.infer<typeof PerformImageReplacementInputSchema>;
export type PerformImageReplacementOutput = z.infer<typeof PerformImageReplacementOutputSchema>;

export async function performImageReplacement(
  input: PerformImageReplacementInput
): Promise<PerformImageReplacementOutput> {
  return performImageReplacementFlow(input);
}


/* ------------------------------ Flow ------------------------------ */

const performImageReplacementFlow = ai.defineFlow(
  {
    name: 'performImageReplacementFlow',
    inputSchema: PerformImageReplacementInputSchema,
    outputSchema: PerformImageReplacementOutputSchema,
  },
  async ({ reportFileName, images }) => {
    const logs: string[] = [];
    let imagesReplacedCount = 0;

    try {
      logs.push(`Starting replacement process for report: ${reportFileName}`);

      // 1. Download the report template from storage
      const reportStoragePath = `reports/${reportFileName}`;
      logs.push(`Downloading report from: ${reportStoragePath}`);
      const reportArrayBuffer = await downloadBinary(reportStoragePath);
      const reportBuffer = Buffer.from(reportArrayBuffer);
      logs.push(`Report downloaded successfully (${(reportBuffer.length / 1024).toFixed(2)} KB).`);

      const zip = new PizZip(reportBuffer);

      // 2. Prepare image data and sizes
      const imageSizes = new Map<string, { width: number; height: number }>();
      const templateData: { [key: string]: Buffer } = {};
      
      for (const img of images) {
        const key = img.placeholder.replace(/\{%|}/g, '');
        imageSizes.set(key, { width: img.width, height: img.height });
        
        const imagePath = `images/${img.imageFileName}`;
        logs.push(`Downloading image: ${img.imageFileName} for placeholder ${img.placeholder}`);
        const imageArrayBuffer = await downloadBinary(imagePath);
        const imageBuffer = Buffer.from(imageArrayBuffer);
        
        // **FIX:** Directly pass the buffer to the template data.
        templateData[key] = imageBuffer;

        logs.push(`Image ${img.imageFileName} downloaded (${(imageBuffer.length / 1024).toFixed(2)} KB).`);
      }

      // 3. Setup Docxtemplater with the image module
      const imageModule = new ImageModule({
        fileType: 'docx',
        centered: false,
        // **FIX:** The `getImage` function now directly receives the buffer from `templateData`.
        getImage: (tagValue: unknown) => {
          if (Buffer.isBuffer(tagValue)) {
            imagesReplacedCount++;
            return tagValue;
          }
          // This should ideally not be reached if the setup is correct.
          logs.push(`[ERROR] getImage received an unexpected type for a tag. Expected a Buffer.`);
          throw new Error('Image data is not a buffer.');
        },
        getSize: (_img: Buffer, _tagValue: unknown, tagName: string) => {
          const size = imageSizes.get(tagName);
          if (size) {
            logs.push(`Providing size ${size.width}x${size.height} for tag: ${tagName}`);
            return [size.width, size.height];
          }
          logs.push(`[WARNING] No size found for tag: ${tagName}. Using default 300x200.`);
          return [300, 200];
        },
      });

      const doc = new Docxtemplater(zip, {
        modules: [imageModule],
        delimiters: { start: '{%', end: '}' },
        paragraphLoop: true,
        linebreaks: true,
      });

      logs.push(`Setting data for docxtemplater with keys: ${Object.keys(templateData).join(', ')}`);
      doc.setData(templateData);

      // 4. Render the document
      logs.push('Rendering the document...');
      doc.render();
      logs.push('Document rendered successfully.');

      // 5. Generate and return the final document
      const out = doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
      const base64 = out.toString('base64');
      logs.push(`Final document generated (${(out.length / 1024).toFixed(2)} KB). Process complete.`);

      return {
        generatedDocxDataUri: `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${base64}`,
        logs,
        imagesReplacedCount,
      };

    } catch (err: any) {
      logs.push(`[FATAL ERROR] An error occurred: ${err.message}`);
      if (err?.properties?.errors?.length) {
        const firstError = err.properties.errors[0];
        logs.push(`Docxtemplater error details: ${firstError?.properties?.explanation || firstError?.id}`);
      }
      // Still return what we have, so the user can see the logs
      return {
        generatedDocxDataUri: '',
        logs,
        imagesReplacedCount: 0,
      };
    }
  }
);
