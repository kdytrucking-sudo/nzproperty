'use server';
/**
 * Insert multiple images at specified TEXT tags like {%report_logo} using
 * docxtemplater-image-module-free.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

/* eslint-disable @typescript-eslint/no-var-requires */
const ImageModule = require('docxtemplater-image-module-free');

/* ----------------------------- Schemas ----------------------------- */
const ImageInfoSchema = z.object({
  placeholder: z.string().describe('Text tag in template, e.g. {%report_logo}'),
  imageDataUri: z.string().describe('Image as data URI, e.g. data:image/png;base64,...'),
  width: z.number().describe('Width in pixels.'),
  height: z.number().describe('Height in pixels.'),
});

const TestImageReplacementInputSchema = z.object({
  templateDataUri: z.string().describe('docx template as data URI'),
  images: z.array(ImageInfoSchema).describe('An array of image information to replace.'),
});
export type TestImageReplacementInput = z.infer<typeof TestImageReplacementInputSchema>;

const TestImageReplacementOutputSchema = z.object({
  generatedDocxDataUri: z.string(),
});
export type TestImageReplacementOutput = z.infer<typeof TestImageReplacementOutputSchema>;

export async function testImageReplacement(
  input: TestImageReplacementInput
): Promise<TestImageReplacementOutput> {
  return testImageReplacementFlow(input);
}

/* ------------------------------ Flow ------------------------------ */
const testImageReplacementFlow = ai.defineFlow(
  {
    name: 'testImageReplacementFlow',
    inputSchema: TestImageReplacementInputSchema,
    outputSchema: TestImageReplacementOutputSchema,
  },
  async ({ templateDataUri, images }) => {
    try {
      const templateBuffer = Buffer.from(templateDataUri.split(',')[1], 'base64');
      const zip = new PizZip(templateBuffer);
      
      const imageSizes = new Map<string, { width: number; height: number }>();
      images.forEach(img => {
          const key = img.placeholder.trim().replace(/^\{\%/, '').replace(/\}$/, '');
          imageSizes.set(key, { width: img.width, height: img.height });
      });

      const imageModule = new ImageModule({
        fileType: 'docx',
        centered: false,

        getImage(tagValue: unknown) {
          if (Buffer.isBuffer(tagValue)) return tagValue;
          if (typeof tagValue === 'string' && tagValue.startsWith('data:')) {
            const b64 = tagValue.split(',')[1] ?? '';
            return Buffer.from(b64, 'base64');
          }
          throw new Error('getImage: expected Buffer or data URI string');
        },

        getSize(_img: Buffer, _tagValue: unknown, tagName: string) {
          const size = imageSizes.get(tagName);
          if (size) {
            return [size.width, size.height];
          }
          // Fallback if size not found, though it should always be present with this logic
          return [300, 200];
        },
      });

      const doc = new Docxtemplater(zip, {
        modules: [imageModule],
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
        generatedDocxDataUri:
          `data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,${base64}`,
      };
    } catch (err: any) {
      if (err?.properties?.errors?.length) {
        const first = err.properties.errors[0];
        throw new Error(first?.properties?.explanation || first?.id || 'Template render error');
      }
      throw new Error(err?.message || 'Failed to process the document.');
    }
  }
);
